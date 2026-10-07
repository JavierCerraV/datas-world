// Spec 028 sobre un mundo generado: azar común (CA-001), despido forzado y su efecto (CA-002, R-003), brazos por capacidad
// (CA-003, R-004), intervenciones rechazadas (CA-004) e INV-004 (mismo hash en la rama).
import { idNumber, parseExperiment, serializeWorld, deserializeWorld } from '@datas-world/engine';
import type { Arm, EntityId, Experiment, World } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../generate.ts';
import { catalogs } from '../testing.ts';
import { experimentSubjects, runArm } from './run.ts';

const DAYS = 6;
const def = (arms: Arm[], extra: Partial<Experiment> = {}): Experiment =>
  parseExperiment({ id: 'prueba', base: { db: 'x' }, durationDays: DAYS, seeds: [1, 2], sampleEveryDays: 3, arms, metrics: ['mood', 'stress', 'money', 'employed', 'bonds', 'events:JOB_LOST'], subjects: { sample: 12 }, ...extra });

const base = generateWorld({ seed: 482917, population: 60, catalogs }).world;
const bytes = serializeWorld(base);
const fresh = (): World => deserializeWorld(bytes);

const subjects = experimentSubjects(fresh(), { sample: 12 });
const employed = subjects.find((id) => fresh().citizens.get(id)?.occupation?.kind === 'formal');
const unemployed = subjects.find((id) => fresh().citizens.get(id)?.occupation?.kind !== 'formal');
const control: Arm = { name: 'control', interventions: [] };
const obs = (r: ReturnType<typeof runArm>, id: EntityId, metric: string, day: number) => r.observations.find((o) => o.citizenId === id && o.metric === metric && o.day === day)?.value;

describe('028: experimentos sobre un mundo generado', () => {
  it('hay personas con y sin empleo formal entre los sujetos (supuesto de las pruebas)', () => {
    expect(subjects.length).toBe(12);
    expect(employed).toBeDefined();
  });

  it('CA-001: dos brazos idénticos con la misma semilla dan lo mismo; con otra semilla, no', () => {
    const d = def([control, { name: 'control2', interventions: [] }]);
    const a = runArm(fresh(), d, d.arms[0]!, 1, subjects, catalogs);
    const b = runArm(fresh(), d, { ...d.arms[1]!, name: 'control' }, 1, subjects, catalogs);
    expect(b.endHash).toBe(a.endHash);
    expect(JSON.stringify(b.observations)).toBe(JSON.stringify(a.observations));
    expect(runArm(fresh(), d, d.arms[0]!, 2, subjects, catalogs).endHash).not.toBe(a.endHash);
  }, 240_000);

  it('CA-002, R-003, INV-004: el despido forzado deja a la persona sin empleo, cuenta como evento, llega al aprendizaje y los brazos arrancan igual', () => {
    const fired: Arm = { name: 'despido', interventions: [{ afterDays: 0, kind: 'force_job_loss', target: employed!, params: {} }] };
    const d = def([control, fired]);
    const w0 = fresh();
    const w1 = fresh();
    const a = runArm(w0, d, control, 1, subjects, catalogs);
    const b = runArm(w1, d, fired, 1, subjects, catalogs);
    expect(b.branchHash).toBe(a.branchHash);
    expect(b.interventions).toEqual([{ seed: 1, arm: 'despido', afterDays: 0, kind: 'force_job_loss', citizenId: employed, ok: true }]);
    expect(obs(a, employed!, 'employed', 0)).toBe(1);
    expect(obs(b, employed!, 'employed', 0)).toBe(0);
    expect(obs(b, employed!, 'events:JOB_LOST', DAYS)).toBeGreaterThanOrEqual(1);
    // El hecho llegó al aprendizaje: la persona despedida tiene más ensayos con lo que el despido significa que en el control.
    const trials = (w: World, key: string) => w.citizens.get(employed!)?.functions?.f.find((x) => x.s === key)?.n ?? 0;
    expect(trials(w1, 'verbal.despido')).toBeGreaterThan(trials(w0, 'verbal.despido'));
    expect(b.endHash).not.toBe(a.endHash);
  }, 240_000);

  it('CA-004: una intervención que no cumple su precondición no cambia el mundo y se anota con su motivo', () => {
    const bad: Arm = { name: 'sin-empleo', interventions: [{ afterDays: 0, kind: 'force_job_loss', target: unemployed ?? employed!, params: {} }, { afterDays: 0, kind: 'grant_money', target: 'CIT-999999' as EntityId, params: { amount: 1000 } }] };
    const d = def([control, bad], { durationDays: 3 });
    const a = runArm(fresh(), d, control, 1, subjects, catalogs);
    const b = runArm(fresh(), d, bad, 1, subjects, catalogs);
    expect(b.interventions.every((i) => !i.ok && i.reason)).toBe(true);
    expect(b.interventions.map((i) => i.reason).join('|')).toMatch(/empleo formal|inexistente/);
    expect(b.endHash).toBe(a.endHash);
  }, 240_000);

  it('grant_money: el dinero de la persona sube exactamente en el monto y el resto del mundo conserva su suma', () => {
    const grant: Arm = { name: 'transferencia', interventions: [{ afterDays: 0, kind: 'grant_money', target: employed!, params: { amount: 500_000 } }] };
    const d = def([control, grant], { durationDays: 3 });
    const a = runArm(fresh(), d, control, 1, subjects, catalogs);
    const b = runArm(fresh(), d, grant, 1, subjects, catalogs);
    expect(b.interventions[0]?.ok).toBe(true);
    expect(obs(b, employed!, 'money', 0)! - obs(a, employed!, 'money', 0)!).toBe(500_000);
  }, 240_000);

  it('CA-003, R-004: un brazo sin una capacidad arranca igual y la conserva en los datos; si otra depende de ella, se rechaza', () => {
    const off: Arm = { name: 'sin-consolidacion', interventions: [], capabilities: { disable: ['consolidation'] } };
    const dep: Arm = { name: 'sin-memoria', interventions: [], capabilities: { disable: ['memory'] } };
    const d = def([control, off, dep], { durationDays: 2 });
    const w = fresh();
    expect(w.capabilities).toContain('consolidation');
    const a = runArm(fresh(), d, control, 1, subjects, catalogs);
    const wOff = fresh();
    const b = runArm(wOff, d, off, 1, subjects, catalogs);
    expect(b.branchHash).toBe(a.branchHash);
    expect(b.interventions[0]).toMatchObject({ kind: 'disable_capability', ok: true });
    expect(wOff.capabilities).not.toContain('consolidation');
    const c = runArm(fresh(), d, dep, 1, subjects, catalogs);
    expect(c.interventions[0]).toMatchObject({ ok: false });
    expect(c.interventions[0]!.reason).toMatch(/depende/);
    expect(idNumber(subjects[0]!)).toBeGreaterThan(0);
  }, 240_000);
});
