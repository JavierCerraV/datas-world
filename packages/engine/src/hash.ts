// Serialización canónica y hash estable (spec 001 R-004).

/**
 * JSON canónico: claves de objeto ordenadas, Map como lista de pares ordenada por clave, Set ordenado,
 * arreglos tipados como arreglos. Falla con NaN, ±Infinity, undefined en arreglos, funciones y símbolos.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'number':
      if (!Number.isFinite(value)) throw new RangeError('canonicalize: número no finito');
      return Object.is(value, -0) ? '0' : String(value);
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalize: tipo no serializable (${typeof value})`);
  }
  if (ArrayBuffer.isView(value)) return canonicalize(Array.from(value as unknown as ArrayLike<number>));
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value instanceof Map) {
    const entries = [...value.entries()].sort(([a], [b]) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
    return canonicalize(entries);
  }
  if (value instanceof Set) return canonicalize([...value].sort());
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

/**
 * Hash de 64 bits en hexadecimal (16 caracteres): dos carriles de 32 bits con mezcla final tipo murmur3.
 * No es criptográfico; basta para comparar estados y detectar divergencias.
 */
export function hashString(s: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  h1 ^= s.length;
  h2 ^= s.length;
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  h2 ^= h2 >>> 16;
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
