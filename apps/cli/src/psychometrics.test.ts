// Spec 045: CA-002 (determinismo), CA-003 (muestra y que medir no cambia el mundo), CA-006 (cordura) y CA-007 (libro de Excel).
import { inflateRawSync } from 'node:zlib';
import { INSTRUMENT_IDS, adults, createRng, dispose, indicatorsOf, scoreInstrument, selectSample, stateHash, truthfulResponses } from '@datas-world/engine';
import type { EmergentProfile, WorldView } from '@datas-world/engine';
import { generateWorld } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { sanity, workbookOf } from './psychometrics-report.ts';
import type { Battery, TakeRecord } from './psychometrics-report.ts';

const gen = generateWorld({ seed: 482917 });
const world = gen.world as unknown as WorldView;
const NONE: EmergentProfile = { values: { jobStability: null, relationshipStability: null, socialNetwork: null, stressorExposure: null, economicTrajectory: null, resilience: null }, basis: { jobStability: [], relationshipStability: [], socialNetwork: [], stressorExposure: [], economicTrajectory: [], resilience: [] } };

function run(): { battery: Battery; hash: string } {
  const root = createRng(world.config.seed);
  const sample = selectSample(adults(world), 50, root.fork('measure:sample'));
  const takes: TakeRecord[] = sample.map((p) => {
    const ind = indicatorsOf({ world, id: p.id, profile: NONE, trajectory: [], events: gen.events });
    const instruments = {} as NonNullable<TakeRecord['instruments']>;
    for (const id of INSTRUMENT_IDS) {
      const t = truthfulResponses(id, ind, root.fork(`measure:${id}:${p.id}:0`));
      const d = dispose(id, t.t, ind, root.fork(`measure:candor:${p.id}:0:${id}`), 0);
      instruments[id] = {
        items: t.t.map((x, k) => ({ n: k + 1, truthful: x, p: t.p[k]!, disposition: d.disposition[k]!, target: d.r[k]!, reported: d.r[k]!, reply: 'ok', source: 'plantilla' as const })),
        reported: scoreInstrument(id, d.r), truthful: scoreInstrument(id, t.t),
      };
    }
    return { citizenId: p.id, toma: 0, alive: true, indicators: ind, instruments };
  });
  const battery: Battery = {
    meta: { world: world.id, seed: world.config.seed, provider: 'mock', nSample: 50, generatedFor: 'prueba' },
    participants: sample.map((p) => ({ id: p.id, name: p.id, sex: p.sex, age: p.age, stratum: p.stratum, occupation: 'x' })),
    tomas: [{ toma: 0, minute: world.now, date: '2027-03-02', hash: stateHash(gen.world) }], takes, events: [],
  };
  return { battery, hash: stateHash(gen.world) };
}

describe('045 sobre un mundo generado', () => {
  const before = stateHash(gen.world);
  const a = run();

  it('CA-003: 50 adultas vivas, sin repetir, con todos los grupos de edad; medir no cambia el mundo', () => {
    const ps = a.battery.participants;
    expect(ps.length).toBe(50);
    expect(new Set(ps.map((p) => p.id)).size).toBe(50);
    expect(ps.every((p) => p.age >= 18)).toBe(true);
    for (const g of ['18–29', '30–44', '45–59', '60 o más']) expect(ps.some((p) => p.stratum.endsWith(g))).toBe(true);
    expect(a.hash).toBe(before);
    expect(stateHash(gen.world)).toBe(before);
  });

  it('CA-002: mismas entradas, mismo informe', () => {
    expect(JSON.stringify(run().battery)).toBe(JSON.stringify(a.battery));
  });

  it('CA-006: las correlaciones se calculan para los pares de R-010 en cada toma (sin tomas 1 y 2, quedan sin dato)', () => {
    const s = sanity(a.battery);
    expect(s.length).toBe(27);
    expect(s.filter((x) => x.toma === 0).every((x) => Number.isFinite(x.r))).toBe(true);
  });

  it('CA-007: el libro abre, con sus hojas y su contenido', () => {
    const buf = workbookOf(a.battery);
    // Directorio central del ZIP.
    const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buf.readUInt16LE(end + 10);
    let off = buf.readUInt32LE(end + 16);
    const files = new Map<string, string>();
    for (let i = 0; i < count; i++) {
      const nameLen = buf.readUInt16LE(off + 28);
      const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
      const local = buf.readUInt32LE(off + 42);
      const size = buf.readUInt32LE(off + 20);
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      files.set(name, inflateRawSync(buf.subarray(start, start + size)).toString('utf8'));
      off += 46 + nameLen;
    }
    const wb = files.get('xl/workbook.xml')!;
    for (const sheet of ['Método y límites', 'Participantes', 'Puntajes', 'Estadísticos', 'Cambios', 'Dicho vs verdadero', 'Respuestas', 'Indicadores']) expect(wb).toContain(`name="${sheet}"`);
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('NO son datos humanos');
    const items = files.get('xl/worksheets/sheet8.xml')!;
    expect((items.match(/<row /g) ?? []).length).toBe(1 + 50 * 65);
  });
});
