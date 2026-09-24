// Codificación binaria de componentes e instantáneas (spec 027 R-004, R-008).
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { deserializeWorld, serializeWorld } from '@mundo-social/engine';
import type { ColumnType, World, WorldSnapshot } from '@mundo-social/engine';

type Column = Float32Array | Int32Array | Uint8Array;

const ALLOC = { f32: Float32Array, i32: Int32Array, u8: Uint8Array } as const;
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** Bytes little-endian de una columna. En máquinas little-endian (x86, ARM) es una vista sin copia. */
export function columnToLE(data: Column): Buffer {
  const view = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (LITTLE_ENDIAN || data.BYTES_PER_ELEMENT === 1) return view;
  return Buffer.from(view).swap32();
}

/** Inversa de `columnToLE`: siempre devuelve una copia con su propio buffer. */
export function columnFromLE(type: ColumnType, bytes: Uint8Array, length: number): Column {
  const Ctor = ALLOC[type];
  if (bytes.byteLength !== length * Ctor.BYTES_PER_ELEMENT) {
    throw new Error(`Columna ${type}: ${bytes.byteLength} bytes no corresponden a ${length} filas`);
  }
  const copy = Buffer.from(bytes);
  if (!LITTLE_ENDIAN && Ctor.BYTES_PER_ELEMENT === 4) copy.swap32();
  const out = new Ctor(length);
  new Uint8Array(out.buffer).set(copy);
  return out;
}

const MAGIC = 'MSS1';

/**
 * Instantánea: `MSS1` + u32 LE con la longitud de la cabecera + cabecera JSON (el WorldSnapshot sin las filas
 * de las columnas) + las columnas en binario LE, una tras otra y en el orden de la cabecera. Todo en zstd.
 */
export function encodeSnapshot(world: World): Buffer {
  const snap = serializeWorld(world);
  const bodies: Buffer[] = [];
  const header = {
    ...snap,
    components: snap.components.map(({ type, name, initial, rows }) => {
      bodies.push(columnToLE(ALLOC[type].from(rows)));
      return { type, name, initial, length: rows.length };
    }),
  };
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.byteLength);
  return zstdCompressSync(Buffer.concat([Buffer.from(MAGIC, 'ascii'), len, json, ...bodies]));
}

export function decodeSnapshot(data: Uint8Array): World {
  const raw = zstdDecompressSync(data);
  if (raw.toString('ascii', 0, 4) !== MAGIC) throw new Error('Instantánea con formato desconocido');
  const hlen = raw.readUInt32LE(4);
  type Header = Omit<WorldSnapshot, 'components'> & {
    components: { type: ColumnType; name: string; initial: number; length: number }[];
  };
  const header = JSON.parse(raw.toString('utf8', 8, 8 + hlen)) as Header;
  let offset = 8 + hlen;
  const snap: WorldSnapshot = {
    ...header,
    components: header.components.map(({ type, name, initial, length }) => {
      const size = length * ALLOC[type].BYTES_PER_ELEMENT;
      const rows = Array.from(columnFromLE(type, raw.subarray(offset, offset + size), length));
      offset += size;
      return { type, name, initial, rows };
    }),
  };
  if (offset !== raw.byteLength) throw new Error('Instantánea con bytes sobrantes');
  return deserializeWorld(snap);
}
