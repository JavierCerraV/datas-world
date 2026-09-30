// Estilo de respuesta (spec 045 R-006, decisión del usuario del 2026-09-30): sale de cómo vivió la persona, no del
// azar ni del temperamento. Quien aprendió que expresar malestar trae castigo o burla lo minimiza (deseabilidad);
// quien aprendió a obedecer sin premio o sigue reglas por quien las dice tiende a asentir (aquiescencia); quien
// aprendió a nombrar sus emociones y a confiarlas las informa con más exactitud.
import type { DevelopmentEpisode, WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';

/** Episodios de desarrollo (041) que empujan cada tendencia, con su peso [M]. */
export const STYLE_EPISODES = Object.freeze({
  minimiza: ['crianza.expresion_castigada', 'adolescencia.confidencia_burlada', 'pares.burla_silencio', 'colegio.defensa_castigada', 'crianza.gritos', 'crianza.castigo_fisico'],
  expresa: ['crianza.nombrar_emocion', 'crianza.consuelo', 'adolescencia.confidente', 'adulto.apoyo_pareja'],
  asiente: ['crianza.regla_obediencia', 'adolescencia.obedecer_sin_premio'],
} as const);

/** Parámetros [M] del estilo; se calibran con el test-retest y la validez (045 §9). */
export const STYLE_PARAMS = Object.freeze({
  /** Aporte de cada episodio a su tendencia. */
  perEpisode: 0.12,
  /** Tope de cada tendencia. */
  max: 0.6,
  /** Peso de la obediencia a reglas por quien las dice (038) en la aquiescencia. */
  pliance: 0.3,
});

export interface ResponseStyle {
  /** [0,1]: tiende a elegir las opciones de acuerdo. */
  acquiescence: number;
  /** [0,1]: minimiza lo que se ve mal (los síntomas). */
  desirability: number;
  /** Desviación del ruido de la respuesta. */
  noise: number;
  /** Episodios que lo explican (ids de sus `DEVELOPMENT_YEAR`), para el «¿por qué respondió así?». */
  basis: EntityId[];
}

const clamp = (x: number, max: number) => Math.max(0, Math.min(max, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** El estilo de una persona a partir de sus episodios de desarrollo y de sus reglas (038). */
export function responseStyle(view: WorldView, id: EntityId, events: readonly WorldEvent[], noise: number): ResponseStyle {
  const count = { minimiza: 0, expresa: 0, asiente: 0 };
  const basis = new Set<EntityId>();
  for (const e of events) {
    if (e.type !== 'DEVELOPMENT_YEAR') continue;
    const p = e.payload as { citizenId: string; episodes: DevelopmentEpisode[] };
    if (p.citizenId !== id) continue;
    for (const ep of p.episodes) {
      for (const k of ['minimiza', 'expresa', 'asiente'] as const) {
        if ((STYLE_EPISODES[k] as readonly string[]).includes(ep[1])) {
          count[k]++;
          basis.add(e.id);
        }
      }
    }
  }
  const rules = view.citizens.get(id)?.rules ?? [];
  const followed = rules.reduce((s, r) => s + r.hist.followed, 0);
  const bySpeaker = rules.reduce((s, r) => s + r.hist.bySpeaker, 0);
  const pliance = followed > 0 ? bySpeaker / followed : 0;
  const { perEpisode, max } = STYLE_PARAMS;
  const expresses = count.expresa * perEpisode;
  return {
    acquiescence: r3(clamp(count.asiente * perEpisode + STYLE_PARAMS.pliance * pliance, max)),
    desirability: r3(clamp(count.minimiza * perEpisode - expresses, max)),
    // Quien nombra sus emociones responde con menos ruido (hasta la mitad).
    noise: r3(noise * (1 - clamp(expresses, 0.5))),
    basis: [...basis].sort(),
  };
}
