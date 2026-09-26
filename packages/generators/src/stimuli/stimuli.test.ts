// Ontología compartida de estímulos (036 R-004, MF2.1) y enganche del aprendizaje con la vida diaria (MF2.5).
import { LEARNING_DEFAULTS, WORLD_STIMULI, distance, gradient, idNumber } from '@datas-world/engine';
import type { EntityId, WorldEvent } from '@datas-world/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../country/profile.ts';
import { generateWorld } from '../generate.ts';
import { lifeRunner } from '../life.ts';
import { catalogs } from '../testing.ts';
import { buildOntology } from './ontology.ts';

describe('ontología de estímulos (036 R-004)', () => {
  const onto = buildOntology(catalogs);

  it('tiene las clases del motor, una por tipo de lugar y una por actividad de ocio', () => {
    for (const k of WORLD_STIMULI) expect(onto.classes.has(k)).toBe(true);
    for (const e of catalogs.place_kinds.entries) expect(onto.classes.get(`lugar.${e.key}`)?.kind).toBe('place_kind');
    for (const e of catalogs.leisure_activities.entries) expect(onto.classes.get(`actividad.${e.key}`)?.kind).toBe('activity');
    expect(onto.dims).toBe(6);
    expect([...onto.classes.keys()].some((k) => k.startsWith('familia.'))).toBe(false);
  });

  it('generaliza más dentro de una familia que entre familias, y el dinero más a la deuda que al dolor', () => {
    const g = (a: string, b: string) => gradient(distance(onto, a, b), LEARNING_DEFAULTS.sigma);
    expect(g('lugar.ocio.bar', 'lugar.ocio.cafe')).toBeGreaterThan(g('lugar.ocio.bar', 'lugar.salud.hospital'));
    expect(g('verbal.dinero', 'verbal.deuda')).toBeGreaterThan(g('verbal.dinero', 'cuerpo.dolor'));
  });

  it('lanza si falta la familia de un lugar', () => {
    const broken = { ...catalogs, stimulus_classes: { ...catalogs.stimulus_classes, entries: catalogs.stimulus_classes.entries.filter((e) => e.key !== 'familia.lugar.ocio') } };
    expect(() => buildOntology(broken)).toThrow(/familia\.lugar\.ocio/);
  });
});

describe('aprendizaje en la vida diaria (036 R-001, MF2.5)', () => {
  it('las consecuencias de 14 días dejan funciones con su evento de origen, sin pasar de los topes', () => {
    const { world } = generateWorld({ seed: 482917, profileId: DEFAULT_PROFILE, population: 60, catalogs });
    const runner = lifeRunner(world, catalogs);
    runner.advanceDays(14);
    const events: WorldEvent[] = runner.drainEvents();
    const ids = new Set(events.map((e) => e.id));
    const learned = [...world.citizens.values()].filter((c) => c.functions && c.functions.f.length > 0);
    expect(learned.length).toBeGreaterThan(10);
    for (const c of learned) {
      expect(c.functions!.f.length).toBeLessThanOrEqual(LEARNING_DEFAULTS.maxFunctions);
      for (const f of c.functions!.f) for (const src of f.src) expect(ids.has(src as EntityId)).toBe(true);
    }
    // Quien disfrutó de su ocio tiene el disfrute como función apetitiva de la actividad.
    const leisure = events.find((e) => e.type === 'LEISURE_DONE')!;
    const who = world.citizens.get(leisure.participants[0]!.id)!;
    const act = (leisure.payload as { activity: string }).activity;
    expect(who.functions!.f.find((f) => f.s === `actividad.${act}`)!.v).toBeGreaterThan(0);
    // 040 CA-005: toda salida de ocio cita sus fuentes; cuando pesa la fuerza, también los eventos que la formaron.
    const done = events.filter((e) => e.type === 'LEISURE_DONE');
    for (const e of done) expect(e.causes.some((c) => 'state' in c && c.state.startsWith('fuente.'))).toBe(true);
    expect(done.some((e) => e.causes.some((c) => 'event' in c && ids.has(c.event)))).toBe(true);
    // 040 R-011: los estados aprendidos existen y parten del temperamento.
    expect(world.components.f32['hist.discountK']![idNumber(who.id)]).toBeGreaterThan(0);
  }, 120_000);
});
