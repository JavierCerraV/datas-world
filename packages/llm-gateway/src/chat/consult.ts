// Lo que la persona sabe de sí misma al llegar a una consulta (spec 047 R-013): sus episodios de rumia recientes, las
// sesiones a las que fue y si practicó. Sale solo de sus propios hechos y va a SU vista: el terapeuta no lo recibe, lo
// sabrá si ella lo cuenta (CA-012). Sin números del motor ni nombres internos.
import type { WorldEvent } from '@datas-world/engine';
import type { ViewFact } from './view.ts';

const DAY = 1440;
/** Ventana de «últimamente» para los episodios. */
const RECENT_DAYS = 30;

/** Tipos que en consulta se resumen aquí (o no dicen nada a la persona) y no van como hechos sueltos. */
export const CONSULT_SUMMARIZED: ReadonlySet<string> = new Set(['PNR_EPISODE', 'PROTOCOL_SESSION', 'PRACTICE_DONE', 'PROTOCOL_ENDED', 'DEVELOPMENT_YEAR', 'CHAPTER_OPENED']);

/** «verbal.no_pagar» → «no pagar»; la deuda, con su artículo. */
const topicOf = (trigger: string): string => {
  const t = trigger.replace(/^[a-z]+\./, '').replace(/_/g, ' ');
  return t === 'deuda' ? 'la deuda' : t === 'despido' ? 'el despido' : t;
};
const ENDED: Record<string, string> = {
  yo: 'tomó distancia del pensamiento y siguió con lo suyo',
  evitacion: 'se distrajo o se fue a dormir para no pensar',
  bajo: 'se le fue pasando',
  tope: 'le dio vueltas hasta agotarse',
};
const times = (n: number) => (n === 1 ? 'una vez' : `${n} veces`);

export function consultFacts(mine: readonly WorldEvent[], id: string, now: number, dateOf: (at: number) => string, ageAt: (at: number) => number | null): ViewFact[] {
  const own = (type: string) => mine.filter((e) => e.type === type && (e.payload as { citizenId?: string }).citizenId === id).sort((a, b) => a.at - b.at);
  const out: ViewFact[] = [];
  const fact = (key: string, at: number, text: string): void => void out.push({ id: key, date: dateOf(at), age: ageAt(at), level: 2, text });

  for (const e of own('PROTOCOL_SESSION')) {
    const p = e.payload as { session: number; attended: boolean };
    fact(`SESION-${p.session}`, e.at, p.attended ? `Fue a la sesión ${p.session} con el psicólogo.` : `No fue a la sesión ${p.session} con el psicólogo.`);
  }

  const episodes = own('PNR_EPISODE').filter((e) => e.at >= now - RECENT_DAYS * DAY);
  const last = episodes.at(-1);
  if (last) {
    const p = last.payload as { trigger: string; minutes: number; ended: string };
    const others = episodes.slice(0, -1).map((e) => (e.payload as { ended: string }).ended);
    const how = [...new Set(others)].map((k) => `${times(others.filter((x) => x === k).length)} ${ENDED[k] ?? 'se le pasó'}`);
    fact('RUMIA-RECIENTE', last.at,
      `En el último mes se quedó dándole vueltas a ${topicOf(p.trigger)} ${times(episodes.length)}. La última, unos ${p.minutes} minutos: al final ${ENDED[p.ended] ?? 'se le pasó'}.${how.length ? ` Antes, ${how.join('; ')}.` : ''}`);
  }

  // La práctica se cuenta desde la última sesión a la que fue.
  const attended = own('PROTOCOL_SESSION').filter((e) => (e.payload as { attended: boolean }).attended).at(-1);
  if (attended) {
    const days = Math.floor((now - attended.at) / DAY);
    const done = own('PRACTICE_DONE').filter((e) => e.at > attended.at).length;
    if (days > 0) fact('PRACTICA', now, done === 0 ? `Desde la última sesión no hizo la práctica que le dejó el psicólogo (${days} días).` : `Desde la última sesión hizo la práctica ${done} de los ${days} días.`);
  }
  return out;
}
