// `why` (spec 019 R-004, R-006): el árbol de causas de un evento hasta la profundidad pedida, en español. Los estados
// son hojas con su texto (su hecho de origen ya va como causa hermana, R-005); las fuentes de control de una conducta
// se siguen hasta los hechos que formaron hoy esa función o respuesta. Puro: recibe la búsqueda del registro.
import { eventText } from '../events.ts';
import type { CauseRef, WorldEvent } from '../events.ts';
import type { WorldView } from '../simulation/system.ts';

export interface WhyNode {
  kind: 'event' | 'state' | 'source';
  ref: string;
  text: string;
  /** Aporte relativo a sus hermanos (R-003). */
  weight: number;
  at?: number;
  children: WhyNode[];
}

export interface WhyOptions {
  depth?: number;
  minWeight?: number;
  maxNodes?: number;
  /** Cambia ids por nombres en los textos. */
  names?: (text: string) => string;
  /** Estado actual del mundo, para seguir las fuentes de control hasta su origen (R-006). */
  view?: WorldView;
}

export const WHY_DEFAULTS = Object.freeze({ depth: 4, minWeight: 0.1, maxNodes: 60 });

const r2 = (x: number) => Math.round(x * 100) / 100;
const SOURCE: Readonly<Record<string, string>> = {
  reforzador: 'lo que conseguía en ese momento', fuerza: 'la fuerza de la costumbre', demorado: 'lo que conseguiría después', regla: 'una regla aprendida',
  valor: 'un valor', aversion: 'lo que le desagrada', coste: 'lo que le costaba', alivio: 'el alivio de no pensar', postura: 'su forma de responder',
  funcion: 'lo que esa persona o cosa significa para ella', red: 'una relación aprendida',
};
/** Texto de los estados más citados [M]; el resto, su clave en palabras. */
const STATE: Readonly<Record<string, (v?: number) => string>> = {
  deuda_de_sueno: (v) => `venía durmiendo poco (deuda de sueño de ${Math.round((v ?? 0) / 60 * 10) / 10} h)`,
  horario_de_sueno: () => 'su horario le deja dormir menos de lo que necesita',
  estres: (v) => `estaba estresado/a (${r2(v ?? 0)})`,
  estresores: (v) => `tenía motivos de estrés: dinero, empleo, salud o cansancio (${r2(v ?? 0)})`,
  carga_privada: (v) => `le daba vueltas a algo (${r2(v ?? 0)})`,
  energia: (v) => `tenía poca energía (${r2(v ?? 0)})`,
  descuento: () => 'le cuesta esperar recompensas lejanas',
  salud_fisica: (v) => `su salud física (${r2(v ?? 0)})`,
  saldo_insuficiente: () => 'no tenía dinero suficiente',
  deficit: () => 'le faltaba dinero para sus gastos',
  tension: (v) => `había tensión entre ellos (${r2(v ?? 0)})`,
  funcion: (v) => `lo que esa persona significa para ella (${r2(v ?? 0)})`,
  mismo_lugar: () => 'coincidieron en el mismo lugar',
  sin_contacto: (v) => `llevaban ${v ?? 0} días sin verse`,
  duracion_viaje: (v) => `el trayecto duró ${v ?? 0} min`,
  rng: () => 'azar',
  clock: () => 'el paso del tiempo',
  tiempo: () => 'el paso del tiempo',
};

function stateText(c: Extract<CauseRef, { state: string }>): string {
  if (c.state.startsWith('fuente.')) {
    const [src, ref] = c.state.slice(7).split(':');
    return `${SOURCE[src!] ?? src}${ref ? ` (${ref})` : ''}${c.value !== undefined ? `: ${r2(c.value)}` : ''}`;
  }
  if (c.state.startsWith('etapa.')) return `su etapa de vida: ${c.state.slice(6).replace(/_/g, ' ')}`;
  const t = STATE[c.state];
  return t ? t(c.value) : `${c.state.replace(/_/g, ' ')}${c.value !== undefined ? ` (${r2(c.value)})` : ''}`;
}

/** R-006: los hechos que formaron hoy la función, la respuesta o la regla que cita una fuente de control. */
function sourceOrigins(view: WorldView | undefined, c: Extract<CauseRef, { state: string }>): string[] {
  if (!view || !c.entity || !c.state.startsWith('fuente.')) return [];
  const ref = c.state.split(':')[1];
  if (!ref) return [];
  const p = view.citizens.get(c.entity);
  const f = p?.functions?.f.find((x) => x.s === ref);
  const r = p?.functions?.r.find((x) => x.r === ref && x.c === '');
  return [...new Set([...(f?.src ?? []), ...(r?.src ?? [])])].slice(0, 3);
}

/** R-004: el árbol de causas, por niveles (lo cercano primero), sin repetir eventos y con `maxNodes` como tope. */
export function why(get: (id: string) => WorldEvent | undefined, id: string, o: WhyOptions = {}): WhyNode | undefined {
  const depth = o.depth ?? WHY_DEFAULTS.depth;
  const minWeight = o.minWeight ?? WHY_DEFAULTS.minWeight;
  const maxNodes = o.maxNodes ?? WHY_DEFAULTS.maxNodes;
  const names = o.names ?? ((s: string) => s);
  const root = get(id);
  if (!root) return undefined;
  const node = (e: WorldEvent, weight: number): WhyNode => ({ kind: 'event', ref: e.id, text: names(eventText(e)), weight, at: e.at, children: [] });
  const top = node(root, 1);
  const seen = new Set<string>([root.id]);
  let count = 1;
  let level: { n: WhyNode; causes: readonly CauseRef[] }[] = [{ n: top, causes: root.causes }];
  for (let d = 0; d < depth && level.length && count < maxNodes; d++) {
    const next: typeof level = [];
    for (const { n, causes } of level) {
      const total = causes.reduce((s, c) => s + c.weight, 0) || 1;
      const sorted = [...causes].map((c) => ({ c, w: r2(c.weight / total) })).sort((a, b) => b.w - a.w || (JSON.stringify(a.c) < JSON.stringify(b.c) ? -1 : 1));
      for (const [i, { c, w }] of sorted.entries()) {
        if (count >= maxNodes) break;
        if (i > 0 && w < minWeight) continue;
        if ('event' in c) {
          if (seen.has(c.event)) continue;
          const e = get(c.event);
          if (!e) continue;
          seen.add(c.event);
          const child = node(e, w);
          n.children.push(child);
          count++;
          next.push({ n: child, causes: e.causes });
        } else {
          const origins = sourceOrigins(o.view, c).filter((x) => !seen.has(x));
          const child: WhyNode = { kind: c.state.startsWith('fuente.') ? 'source' : 'state', ref: c.state, text: stateText(c), weight: w, children: [] };
          n.children.push(child);
          count++;
          for (const x of origins) {
            const e = get(x);
            if (!e || count >= maxNodes) continue;
            seen.add(x);
            const g = node(e, r2(1 / origins.length));
            g.text = `${g.text} (origen actual de esa función)`;
            child.children.push(g);
            count++;
            next.push({ n: g, causes: e.causes });
          }
        }
      }
    }
    level = next;
  }
  return top;
}

/** Recorre el árbol en profundidad (para textos y pruebas). */
export function* walk(n: WhyNode, d = 0): Generator<{ n: WhyNode; d: number }> {
  yield { n, d };
  for (const c of n.children) yield* walk(c, d + 1);
}

/** El árbol en líneas con sangría: `← texto (peso)`. */
export function whyLines(n: WhyNode, date?: (at: number) => string): string[] {
  return [...walk(n)].map(({ n: x, d }) => `${'  '.repeat(d)}${d ? '← ' : ''}${x.at !== undefined && date ? `${date(x.at)} ` : ''}${x.text}${d ? ` [${Math.round(x.weight * 100)} %]` : ''}`);
}
