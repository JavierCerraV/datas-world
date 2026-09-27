import { describe, expect, it } from 'vitest';
import { loadCatalogs } from './load.ts';

// Catálogos de la charla con ciudadanos (spec 043 §3, R-005, R-008, R-015; bloque L0.2).
const catalogs = loadCatalogs();
const tones = catalogs.chat_tones.entries;
const stances = catalogs.chat_stances.entries;
const scripts = catalogs.chat_scripts.entries;
const num = (v: unknown) => (typeof v === 'number' ? v : NaN);

/** Valores sociales de partida aprobados por el usuario (043 §8, PA-135). */
const PRIOR: Record<string, number> = {
  amable: 0.5, burla: -0.5, culpabilizador: -0.4, curioso: 0.1, desagradable: -0.4, grosero: -0.6,
  hostil: -0.8, intimo: 0.2, invasivo: -0.3, neutro: 0, presion: -0.3, victimizante: -0.1,
};

describe('catálogos de la charla (043)', () => {
  it('chat_tones tiene los 12 tonos, cada uno con su estímulo verbal, magnitud y valor de partida aprobado', () => {
    expect(tones.map((t) => t.key).sort()).toEqual(Object.keys(PRIOR).sort());
    const stimuli = new Map(catalogs.stimulus_classes.entries.map((e) => [e.key, e]));
    for (const t of tones) {
      const a = t.attrs ?? {};
      const stim = stimuli.get(String(a.stimulus));
      expect(stim?.attrs?.kind, `${t.key}: estímulo ${String(a.stimulus)}`).toBe('verbal_term');
      expect(num(a.magnitude)).toBeGreaterThanOrEqual(0);
      expect(num(a.magnitude)).toBeLessThanOrEqual(1);
      expect(num(a.prior), t.key).toBe(PRIOR[t.key]);
      expect(String(a.description).length).toBeGreaterThan(10);
      expect(Array.isArray(a.examples) && a.examples.length >= 2, `${t.key}: ejemplos`).toBe(true);
    }
    // El ejemplo del usuario define el tono victimizante (043 §3).
    const victim = tones.find((t) => t.key === 'victimizante')!;
    expect((victim.attrs!.examples as string[]).some((x) => x.includes('soy muy perdedora'))).toBe(true);
  });

  it('los estímulos de los tonos son distintos entre sí y ninguno es primario (su función se aprende, 043 R-005)', () => {
    const keys = tones.map((t) => String(t.attrs!.stimulus));
    expect(new Set(keys).size).toBe(keys.length);
    const stimuli = new Map(catalogs.stimulus_classes.entries.map((e) => [e.key, e]));
    for (const k of keys) expect(stimuli.get(k)!.attrs!.primary, k).toBeUndefined();
  });

  it('chat_stances tiene las 8 posturas con guía, escape y fuerza inicial en [0,1]', () => {
    expect(stances.map((s) => s.key)).toEqual([
      'abrirse', 'aplacar', 'callar', 'contraatacar', 'evadir', 'poner_limite', 'responder_breve', 'terminar',
    ]);
    for (const s of stances) {
      const a = s.attrs ?? {};
      for (const f of ['escape', 'w0']) {
        expect(num(a[f]), `${s.key}.${f}`).toBeGreaterThanOrEqual(0);
        expect(num(a[f]), `${s.key}.${f}`).toBeLessThanOrEqual(1);
      }
      expect(String(a.guidance).length).toBeGreaterThan(20);
    }
    // Abrirse no escapa de nada; terminar es el escape completo (R-007).
    expect(stances.find((s) => s.key === 'abrirse')!.attrs!.escape).toBe(0);
    expect(stances.find((s) => s.key === 'terminar')!.attrs!.escape).toBe(1);
  });

  it('chat_scripts cubre cada tono al menos una vez, con turnos válidos (R-015)', () => {
    const toneKeys = new Set(tones.map((t) => t.key));
    const covered = new Set<string>();
    for (const sc of scripts) {
      const turns = sc.attrs!.turns as { text: string; tone: string }[];
      expect(turns.length, sc.key).toBeGreaterThanOrEqual(3);
      for (const t of turns) {
        expect(toneKeys.has(t.tone), `${sc.key}: tono ${t.tone}`).toBe(true);
        expect(t.text.length).toBeGreaterThan(0);
        expect(t.text.length).toBeLessThanOrEqual(1000); // MAX_TURN_CHARS
        covered.add(t.tone);
      }
    }
    expect([...covered].sort()).toEqual([...toneKeys].sort());
  });
});
