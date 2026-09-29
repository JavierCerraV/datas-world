// Capítulos objetivos y divergencias con los recordados (spec 020 R-004, R-005).
import type { DevelopmentEpisode, WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { MEMORY_KINDS } from '../memory/kinds.ts';
import type { Chapter } from '../memory/types.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';
import { DAY, YEAR, clamp1, lambdaOf, pointAt, r3 } from './types.ts';
import type { DayPoint, Divergence, LifeChapter, ReportInput } from './types.ts';

/** Si un hecho le toca a la persona como capítulo: el suyo, el de un hijo que nace o la muerte de su familia. */
export function concerns(view: WorldView, e: DeepReadonly<WorldEvent>, id: EntityId): boolean {
  if (e.type === 'CITIZEN_DIED') {
    const dead = (e.payload as { citizenId: EntityId }).citizenId;
    const me = view.citizens.get(id);
    const d = view.citizens.get(dead);
    if (!me || dead === id) return false;
    return me.motherId === dead || me.fatherId === dead || d?.motherId === id || d?.fatherId === id || (!!me.motherId && me.motherId === d?.motherId)
      || !!(me.householdId && view.households.get(me.householdId)?.kinship.some((k) => k.kind === 'partner' && (k.from === dead || k.to === dead) && (k.from === id || k.to === id)));
  }
  if (e.type === 'CITIZEN_BORN') return e.participants.some((p) => p.id === id && p.role !== 'nacido');
  return e.participants.some((p) => p.id === id);
}

/** Temas que en el pasado abren capítulo una sola vez (el primer empleo, el primer hijo), como en la memoria de partida. */
const ONCE = new Set(['trabajo', 'crianza']);
const MERGE_DAYS = 182;

/**
 * R-004: los capítulos objetivos, con los mismos hechos que abren los recordados (013 R-010): etapas por edad,
 * hechos con tema del pasado (fundiendo los que distan menos de medio año) y de la vida diaria.
 */
export function objectiveChapters(input: ReportInput): LifeChapter[] {
  const { view, id, events, trajectory, now } = input;
  const birth = view.components.i32['demo.birthMinute']?.[Number(id.slice(4))] ?? 0;
  // Las etapas por edad salen de su nacimiento: es el hecho que las fecha (CA-002).
  const born = events.find((e) => e.type === 'CITIZEN_BORN' && (e.payload as { citizenId: string }).citizenId === id);
  const past: { at: number; theme: string; cause?: DeepReadonly<WorldEvent> }[] = [
    { at: birth, theme: 'infancia', ...(born ? { cause: born } : {}) },
    { at: birth + 12 * YEAR, theme: 'adolescencia', ...(born ? { cause: born } : {}) },
    { at: birth + 18 * YEAR, theme: 'juventud', ...(born ? { cause: born } : {}) },
  ];
  const lived: typeof past = [];
  const seen = new Set<string>();
  for (const e of events) {
    const theme = MEMORY_KINDS[e.type]?.theme;
    if (!theme || !concerns(view, e, id)) continue;
    if (e.at < 0) {
      if (ONCE.has(theme) && seen.has(theme)) continue;
      seen.add(theme);
      past.push({ at: e.at, theme, cause: e });
    } else lived.push({ at: e.at, theme, cause: e });
  }
  const sortedPast = past.filter((m) => m.at < Math.min(now, 0)).sort((a, b) => a.at - b.at);
  const merged = sortedPast.filter((m, i) => !(sortedPast[i + 1] && sortedPast[i + 1]!.at - m.at < MERGE_DAYS * DAY));
  const marks = [...merged, ...lived.sort((a, b) => a.at - b.at)];
  return marks.map((m, i) => {
    const to = marks[i + 1]?.at;
    const span = events.filter((e) => e.at >= m.at && (to === undefined || e.at < to));
    return {
      from: m.at, ...(to !== undefined ? { to } : {}), theme: m.theme, ...(m.cause ? { openedBy: m.cause.id } : {}),
      tone: toneOf(span, trajectory, m.at, to ?? now),
      events: span.filter((e) => lambdaOf(e) !== 0 || e.type === 'DEVELOPMENT_YEAR').map((e) => e.id).slice(0, 12),
    };
  });
}

/** [M] Valor de un episodio del desarrollo por su valencia de catálogo (−1, 0, 1), en la escala de las λ de la 013. */
const DEV_SCALE = 0.6;

/** Tono objetivo: el valor de sus hechos (y de lo vivido en su desarrollo) y el cambio real de ánimo si hay trayectoria. */
function toneOf(span: readonly DeepReadonly<WorldEvent>[], t: readonly DayPoint[], from: number, to: number): number {
  const values: number[] = [];
  for (const e of span) {
    const l = lambdaOf(e);
    if (l !== 0) values.push(l);
    if (e.type === 'DEVELOPMENT_YEAR')
      for (const ep of (e.payload as { episodes: readonly DevelopmentEpisode[] }).episodes) if (ep[4] !== 0 && ep[0] >= from && ep[0] < to) values.push(DEV_SCALE * ep[4]);
  }
  const facts = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const a = pointAt(t, Math.floor(Math.max(from, 0) / DAY));
  const b = pointAt(t, Math.floor(to / DAY));
  const mood = a && b && b.day > a.day ? b.mood - a.mood : 0;
  return r3(clamp1(values.length ? 0.5 * facts + mood : 2 * mood));
}

/**
 * [M] Calibrado en 100 personas × 1 año: con 0,4 salían 3,3 divergencias de tono por persona. La memoria de partida
 * es más positiva que lo vivido (se recuerdan los episodios más salientes, y el catálogo tiene más buenos que malos),
 * así que el umbral pide una diferencia clara: signo opuesto con ambos tonos marcados, o más de 0,5.
 */
const TONE_GAP = 0.5;
const TONE_MARKED = 0.15;
/** [M] Tono absoluto desde el que una etapa recordada al revés de como fue se marca siempre. */
const REVERSED = 0.3;
/** [M] Diferencia media entre lo recordado y lo vivido desde la que se dice el sesgo general. */
const GENERAL_BIAS = 0.3;
const BOUNDARY_DAYS = 30;
const THEME: Readonly<Record<string, string>> = {
  infancia: 'la infancia', adolescencia: 'la adolescencia', juventud: 'la juventud', vida_adulta: 'la vida adulta', trabajo: 'el trabajo',
  desempleo: 'el desempleo', jubilacion: 'la jubilación', pareja: 'la pareja', ruptura: 'la ruptura', crianza: 'la crianza', duelo: 'el duelo', migracion: 'la migración',
};
const word = (x: number) => (x <= -0.3 ? 'muy mala' : x < -0.1 ? 'mala' : x >= 0.3 ? 'muy buena' : x > 0.1 ? 'buena' : 'neutra');

/**
 * R-005: por cada capítulo objetivo, el recordado con más solapamiento, y en qué difieren. El tono se compara en el
 * patrón de cada persona (cada tono menos la media de su lado): la memoria suele ser en conjunto más amable que lo
 * vivido, y ese sesgo general se dice una vez (capítulo −1) en vez de marcar todas las etapas.
 */
export function divergences(objective: readonly LifeChapter[], remembered: readonly DeepReadonly<Chapter>[], now: number): Divergence[] {
  const out: Divergence[] = [];
  const pairs = objective.map((c) => {
    const end = c.to ?? now;
    let best: DeepReadonly<Chapter> | undefined;
    let overlap = 0;
    for (const r of remembered) {
      const o = Math.min(end, r.to ?? now) - Math.max(c.from, r.from);
      if (o > overlap) {
        overlap = o;
        best = r;
      }
    }
    return best;
  });
  const matched = objective.flatMap((c, i) => (pairs[i] ? [{ o: c.tone, r: pairs[i]!.tone }] : []));
  const meanO = matched.length ? matched.reduce((s, x) => s + x.o, 0) / matched.length : 0;
  const meanR = matched.length ? matched.reduce((s, x) => s + x.r, 0) / matched.length : 0;
  if (matched.length >= 2 && Math.abs(meanR - meanO) > GENERAL_BIAS)
    out.push({ chapter: -1, kind: 'tone', note: `En general recuerda su vida ${meanR > meanO ? 'mejor' : 'peor'} de lo que fue.` });
  objective.forEach((c, i) => {
    const best = pairs[i];
    const name = THEME[c.theme] ?? c.theme;
    if (!best) {
      out.push({ chapter: i, kind: 'missing', note: `No cuenta ${name} como una etapa de su vida.` });
      return;
    }
    const o = c.tone - meanO;
    const r = best.tone - meanR;
    const opposite = Math.sign(o) !== Math.sign(r) && Math.abs(o) > TONE_MARKED && Math.abs(r) > TONE_MARKED;
    // También en valor absoluto, si lo recordado y lo vivido van en sentido contrario y los dos están marcados.
    const reversed = Math.sign(c.tone) !== Math.sign(best.tone) && Math.abs(c.tone) > REVERSED && Math.abs(best.tone) > REVERSED;
    if (opposite || reversed || Math.abs(o - r) > TONE_GAP)
      out.push({
        chapter: i, kind: 'tone', remembered: best.id,
        note: word(best.tone) !== word(c.tone)
          ? `Recuerda ${name} como una etapa ${word(best.tone)}; lo que vivió fue ${word(c.tone)}.`
          : `Comparada con el resto de su vida, recuerda ${name} ${r < o ? 'peor' : 'mejor'} de lo que fue.`,
      });
    if (Math.abs(c.from - best.from) > BOUNDARY_DAYS * DAY)
      out.push({ chapter: i, kind: 'boundary', remembered: best.id, note: `Sitúa el comienzo de ${name} ${Math.round(Math.abs(c.from - best.from) / DAY)} días ${best.from < c.from ? 'antes' : 'después'} de cuando fue.` });
  });
  return out;
}
