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

describe('catálogos de las consecuencias de la charla (044)', () => {
  const claims = catalogs.chat_claims.entries;
  const relations = catalogs.chat_relations.entries;
  const stimuli = new Map(catalogs.stimulus_classes.entries.map((e) => [e.key, e]));

  it('chat_claims tiene las 8 afirmaciones de P1, cada una con estímulo verbal sin valor primario, magnitud, valor de partida y relaciones válidas', () => {
    expect(claims.map((c) => c.key)).toEqual([
      'consiente_relacion_abierta', 'habla_mal_de_ti', 'infiel', 'quiere_separarse',
      'te_admira', 'te_extrana', 'te_miente_con_dinero', 'te_van_a_despedir',
    ]);
    const relKeys = new Set(relations.map((r) => r.key));
    for (const c of claims) {
      const a = c.attrs ?? {};
      const stim = stimuli.get(String(a.stimulus));
      expect(stim?.attrs?.kind, `${c.key}: estímulo ${String(a.stimulus)}`).toBe('verbal_term');
      expect(stim!.attrs!.primary, c.key).toBeUndefined();
      expect(num(a.magnitude)).toBeGreaterThan(0);
      expect(num(a.magnitude)).toBeLessThanOrEqual(1);
      expect(Math.abs(num(a.prior))).toBeLessThanOrEqual(1);
      const about = a.about as string[];
      expect(about.length, c.key).toBeGreaterThan(0);
      for (const r of about) expect(relKeys.has(r), `${c.key}: relación ${r}`).toBe(true);
      expect((a.examples as string[]).length).toBeGreaterThanOrEqual(2);
      expect((a.keywords as string[]).length).toBeGreaterThanOrEqual(3);
    }
    // Las revelaciones sobre la pareja pesan en contra; las buenas noticias, a favor (R-003).
    const prior = (k: string) => num(claims.find((c) => c.key === k)!.attrs!.prior);
    expect(prior('infiel')).toBeLessThan(0);
    expect(prior('te_extrana')).toBeGreaterThan(0);
  });

  it('chat_relations resuelve cada relación desde la vista del ciudadano, con cercanía en [0,1] y la pareja como la más cercana', () => {
    const resolves = new Set(['partner', 'mother', 'father', 'child', 'sibling', 'boss', 'coworker']);
    for (const r of relations) {
      expect(resolves.has(String(r.attrs!.resolve)), r.key).toBe(true);
      expect(num(r.attrs!.closeness)).toBeGreaterThan(0);
      expect(num(r.attrs!.closeness)).toBeLessThanOrEqual(1);
      expect((r.attrs!.keywords as string[]).length).toBeGreaterThan(0);
    }
    expect(num(relations.find((r) => r.key === 'pareja')!.attrs!.closeness)).toBe(1);
  });
});
