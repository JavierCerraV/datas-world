// Spec 047 (CA-002, CA-003, CA-005 a CA-007, INV-002): `study:pilot` hace el piloto de punta a punta: tomas de línea
// base, sesiones semanales con su dosis decidida por el motor, práctica, seguimiento y un brazo de espera para comparar.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReadonly, queryEvents } from '@datas-world/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run, runAsync } from './commands.ts';
import { withDb } from './common.ts';
import { stopsOf } from './study-pilot.ts';

let dir: string;
let db: string;
const io = { out: () => undefined, err: () => undefined, now: () => '2026-10-08T00:00:00Z' };
const PEOPLE = ['CIT-000019', 'CIT-000021'];
const INSTRUMENTS = ['AAQ-II', 'DASS-21', 'SWLS', 'GPQ-9'];

interface Measure {
  citizenId: string; arm: string; take: number; day: number; date: string; mode: string; practices: number;
  instruments: Record<string, { truthful: number; target: number; said: number }>;
  mechanisms?: { selfFraming: number; avoidance: number };
}
interface Session {
  meta: { citizen: string; session: number; date: string };
  result: { ended: string };
  history: { session: number }[];
  usage: Record<string, { calls: number; inputTokens: number; costMicros: number }>;
}
const json = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const days = (a: string, b: string) => (Date.parse(`${b.replace(' ', 'T')}Z`) - Date.parse(`${a.replace(' ', 'T')}Z`)) / 86_400_000;
const eventsOf = (path: string, type: string) => withDb(openReadonly(path), (d) => queryEvents(d, { types: [type], limit: 100_000 }));
const args = (name: string) => [
  'study:pilot', '--db', db, '--work', join(dir, `${name}.db`), '--citizens', PEOPLE.join(','), '--max-turns', '3', '--baseline-weeks', '2', '--followup-weeks', '1',
  '--practice-until-day', '18', '--out', join(dir, name),
];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'piloto-'));
  db = join(dir, 'w.db');
  expect(run(['world:new', '--seed', '482917', '--population', '60', '--db', db], io)).toBe(0);
  expect(await runAsync(args('p'), io)).toBe(0);
}, 300_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('study:pilot (047)', () => {
  it('el calendario por defecto: 3 tomas de línea base, 3 con las sesiones y una a las 5 semanas', () => {
    const stops = stopsOf(3, 5);
    expect(stops.map((s) => s.day)).toEqual([-21, -14, -7, 0, 7, 14, 49]);
    expect(stops.map((s) => s.session ?? 0)).toEqual([0, 0, 0, 1, 2, 3, 0]);
    expect(stops.map((s) => s.phase)).toEqual(['línea base', 'línea base', 'línea base', 'tratamiento', 'tratamiento', 'tratamiento', 'seguimiento']);
  });

  it('cada toma mide a todas en los dos brazos con las cuatro pruebas, a la hora de consulta y con una semana entre tomas', () => {
    const takes = [1, 2, 3, 4, 5, 6].map((i) => json<Measure[]>(join(dir, 'p', `toma-${i}.json`)));
    for (const [i, t] of takes.entries()) {
      expect(t).toHaveLength(PEOPLE.length * 2);
      expect(new Set(t.map((m) => m.arm))).toEqual(new Set(['protocolo', 'espera']));
      for (const m of t) {
        expect(Object.keys(m.instruments)).toEqual(INSTRUMENTS);
        expect(m.date.endsWith(' 10:00')).toBe(true);
        expect(m.mode).toBe(m.arm === 'protocolo' ? 'llm' : 'motor');
      }
      if (i > 0) expect(days(takes[i - 1]![0]!.date, t[0]!.date)).toBe(7);
    }
  });

  it('CA-002, INV-002: antes de la primera sesión los dos brazos son idénticos; después, solo el del protocolo tiene sesiones', () => {
    for (const i of [1, 2, 3]) {
      const t = json<Measure[]>(join(dir, 'p', `toma-${i}.json`));
      for (const id of PEOPLE) {
        const a = t.find((m) => m.citizenId === id && m.arm === 'protocolo')!, b = t.find((m) => m.citizenId === id && m.arm === 'espera')!;
        expect(a.mechanisms).toEqual(b.mechanisms);
        for (const k of INSTRUMENTS) expect(a.instruments[k]!.truthful).toBe(b.instruments[k]!.truthful);
      }
    }
    expect(eventsOf(join(dir, 'p-espera.db'), 'PROTOCOL_SESSION')).toHaveLength(0);
    expect(eventsOf(join(dir, 'p-espera.db'), 'PRACTICE_DONE')).toHaveLength(0);
    expect(eventsOf(join(dir, 'p.db'), 'PROTOCOL_SESSION')).toHaveLength(PEOPLE.length * 3);
    expect(eventsOf(join(dir, 'p.db'), 'PROTOCOL_ENDED')).toHaveLength(PEOPLE.length);
  });

  it('CA-003: la dosis la aplica el motor y mueve el «Yo» en proporción a lo que la persona estuvo presente', () => {
    const applied = eventsOf(join(dir, 'p.db'), 'PROTOCOL_SESSION').map((e) => e.payload as { attended: boolean; dose: { yo: number }; engagement: number; yo: { from: number; to: number } });
    for (const p of applied) {
      if (p.dose.yo > 0) expect(p.yo.to).toBeGreaterThan(p.yo.from);
      else expect(p.yo.to).toBe(p.yo.from);
      if (!p.attended) expect(p.engagement).toBe(0);
    }
  });

  it('CA-005, CA-006: cada sesión guarda su transcripción con tokens y coste, y el informe trae medidas, mecanismos, episodios y uso', () => {
    for (const id of PEOPLE) {
      const all = [1, 2, 3].map((n) => json<Session>(join(dir, 'p', `${id}-s${n}.json`)));
      expect(all.map((s) => s.meta.session)).toEqual([1, 2, 3]);
      for (const s of all.filter((x) => x.result.ended !== 'no_asistio')) {
        expect(s.usage.therapist!.calls).toBe(4); // 3 turnos y la nota
        expect(s.usage.therapist!.inputTokens).toBeGreaterThan(0);
        expect(s.usage.dialogue!.calls).toBe(3);
        expect(readFileSync(join(dir, 'p', `${id}-s${s.meta.session}.md`), 'utf8')).toMatch(/## Uso del LLM en esta sesión[\s\S]*\| therapist \| `mock-terapeuta` \| 4 \|/);
      }
    }
    const summary = readFileSync(join(dir, 'p', 'resumen.md'), 'utf8');
    for (const part of ['## Qué es y qué no', '## Calendario', '## Sesiones', '### AAQ-II', '### DASS-21', '### SWLS', '### GPQ-9', '### Mecanismos del motor', '### Episodios de rumia en su vida', '## Uso del LLM y coste'])
      expect(summary).toContain(part);
    const csv = readFileSync(join(dir, 'p', 'medidas.csv'), 'utf8').trim().split('\n');
    expect(csv).toHaveLength(1 + 6 * PEOPLE.length * 2 * INSTRUMENTS.length);
    const results = json<{ usage: Record<string, { calls: number }>; sessions: { dose: { yo: number } }[] }>(join(dir, 'p', 'resultados.json'));
    expect(results.sessions).toHaveLength(PEOPLE.length * 3);
    // Una llamada de medida por persona y toma (las cuatro pruebas juntas), solo en el brazo del protocolo.
    expect(results.usage.dialogue!.calls).toBeGreaterThanOrEqual(6 * PEOPLE.length);
  });

  it('CA-007: con mock, el piloto repetido da el mismo informe; y reanudar no repite nada', async () => {
    expect(await runAsync(args('q'), io)).toBe(0);
    expect(readFileSync(join(dir, 'q', 'resumen.md'), 'utf8')).toBe(readFileSync(join(dir, 'p', 'resumen.md'), 'utf8'));
    expect(readFileSync(join(dir, 'q', 'medidas.csv'), 'utf8')).toBe(readFileSync(join(dir, 'p', 'medidas.csv'), 'utf8'));
    const file = join(dir, 'q', 'toma-1.json');
    const before = statSync(file).mtimeMs;
    expect(await runAsync([...args('q'), '--resume'], io)).toBe(0);
    expect(statSync(file).mtimeMs).toBe(before);
    expect(readFileSync(join(dir, 'q', 'resumen.md'), 'utf8')).toBe(readFileSync(join(dir, 'p', 'resumen.md'), 'utf8'));
  }, 300_000);

  it('rechaza una lista vacía, una persona que no existe y un instrumento desconocido', async () => {
    expect(await runAsync(['study:pilot', '--db', db, '--work', join(dir, 'x.db'), '--out', join(dir, 'x')], io)).toBe(2);
    expect(await runAsync(['study:pilot', '--db', db, '--work', join(dir, 'x.db'), '--citizens', 'CIT-999999', '--out', join(dir, 'x')], io)).toBe(2);
    expect(await runAsync(['study:pilot', '--db', db, '--work', join(dir, 'x.db'), '--citizens', PEOPLE[0]!, '--instruments', 'OTRO', '--out', join(dir, 'x')], io)).toBe(2);
    expect(existsSync(join(dir, 'x', 'resumen.md'))).toBe(false);
  });
});
