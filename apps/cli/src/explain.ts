// `citizen:explain EVT-…` (spec 035 CA-001): la cadena del documento rector §12 para una conducta elegida, de la
// conducta hasta los hechos del registro o del desarrollo que la explican. Solo lee el estado y el registro.
import { parseArgs } from 'node:util';
import { EVENT_LEARNING, derive, eventText, leisureResponse, why, whyLines } from '@datas-world/engine';
import type { DevelopmentEpisode, EntityId, FunctionStore, RelationalNetwork, World, WorldEvent } from '@datas-world/engine';
import { WorldRepository, eventsById, openReadonly } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dayOf, withDb, withNames } from './common.ts';
import type { Io } from './common.ts';

export interface ChainStep {
  step: string;
  lines: string[];
}

/** Las conductas que se explican: las elegidas con fuentes de control (040 R-006). */
export const isChosenBehavior = (e: WorldEvent): boolean => e.causes.some((c) => 'state' in c && c.state.startsWith('fuente.'));

const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const SOURCE: Record<string, string> = {
  reforzador: 'lo que consigue ahora', fuerza: 'la fuerza de la costumbre', demorado: 'lo que consigue después', regla: 'una regla',
  valor: 'un valor', aversion: 'lo que le desagrada', coste: 'lo que le cuesta', alivio: 'el alivio de no pensar',
};

/**
 * La cadena (035 §1, documento rector §12): qué emite → contexto → fuentes de control → repertorio → estímulos con
 * función hoy → relaciones aprendidas → qué ocurrió (los hechos que lo formaron) → qué recibe → cómo cambia su
 * historia. `get` busca un evento del registro por id.
 */
export function behaviorChain(world: World, get: (id: string) => WorldEvent | undefined, e: WorldEvent): ChainStep[] {
  const p = e.payload as { citizenId: EntityId; activity?: string; placeId?: EntityId };
  const person = world.citizens.get(p.citizenId);
  const store = (person?.functions ?? { f: [], r: [], pruned: 0 }) as FunctionStore;
  const net = (person?.network ?? { e: [], pruned: 0 }) as RelationalNetwork;
  const place = p.placeId ? world.places.get(p.placeId) : undefined;
  const response = p.activity ? leisureResponse(p.activity) : undefined;
  const stims = [p.activity ? `actividad.${p.activity}` : '', place ? `lugar.${place.kind}` : '', 'cuerpo.disfrute', 'verbal.aprobacion', 'rol.par'].filter(Boolean);
  const steps: ChainStep[] = [];
  steps.push({ step: 'Qué emite', lines: [`${dayOf(e.at, world.config.epoch)} ${withNames(world, eventText(e))}`] });
  steps.push({ step: 'Contexto', lines: [`${place ? `${place.name} (${place.kind})` : 'sin lugar'}, a las ${String(Math.floor((((e.at % 1440) + 1440) % 1440) / 60)).padStart(2, '0')} h`] });
  steps.push({
    step: 'Fuentes de control',
    lines: e.causes.flatMap((c) => ('state' in c && c.state.startsWith('fuente.') ? [`${SOURCE[c.state.slice(7).split(':')[0]!] ?? c.state} (${c.state.split(':')[1] ?? ''}): ${r2(c.value ?? 0)}`] : [])),
  });
  const rep = response ? store.r.find((x) => x.r === response && x.c === '') : undefined;
  steps.push({ step: 'Repertorio', lines: rep ? [`${response}: fuerza ${r2(rep.w)} tras ${rep.n} veces`] : [] });
  const fns = store.f.filter((f) => stims.includes(f.s) && Math.abs(f.v) >= 0.01);
  steps.push({ step: 'Estímulos con función hoy', lines: fns.map((f) => `${f.s}: ${f.v > 0 ? '+' : ''}${r2(f.v)} (${f.n} ensayos)`) });
  const rels = stims.flatMap((s) => derive(net, s).slice(0, 3).map((d) => `${s} → ${d.to} (${d.t}, fuerza ${r2(d.s)})`));
  steps.push({ step: 'Relaciones aprendidas', lines: rels });
  // Qué ocurrió: los hechos que formaron la respuesta y las funciones (su origen, `src`), sin la propia conducta.
  const origins = [...new Set([...(rep?.src ?? []), ...fns.flatMap((f) => f.src)])].filter((id) => id !== e.id);
  const happened: string[] = [];
  for (const id of origins.slice(0, 6)) {
    const o = get(id);
    if (!o) continue;
    if (o.type === 'DEVELOPMENT_YEAR') {
      const eps = (o.payload as { episodes: DevelopmentEpisode[] }).episodes.filter((ep) => ep[6].some(([k]) => stims.includes(k) || k === response));
      happened.push(`${dayOf(o.at, world.config.epoch)} a los ${(o.payload as { age: number }).age} años: ${eps.length} episodios (${[...new Set(eps.map((ep) => ep[1]))].slice(0, 3).join(', ')})`);
    } else happened.push(`${dayOf(o.at, world.config.epoch)} ${withNames(world, eventText(o))}`);
  }
  steps.push({ step: 'Qué ocurrió', lines: happened });
  const rule = EVENT_LEARNING[e.type];
  const lambda = rule ? (typeof rule.lambda === 'number' ? rule.lambda : rule.lambda(e, world)) : 0;
  steps.push({ step: 'Qué recibe', lines: rule ? [`${rule.us} (λ ${lambda > 0 ? '+' : ''}${r2(lambda)}) con ${rule.stims(e, world).join(', ')}`] : [] });
  const touched = fns.filter((f) => f.src.includes(e.id));
  steps.push({
    step: 'Cómo cambia su historia',
    lines: [...touched.map((f) => `${f.s} queda en ${r2(f.v)} con esta conducta como origen`), ...(rep ? [`${response}: ${rep.n} veces, fuerza ${r2(rep.w)}`] : [])],
  });
  return steps;
}

/** Eventos de relación (012 §5) que se explican por la historia del par. */
export const RELATIONSHIP_EVENTS: ReadonlySet<string> = new Set(['ARGUMENT', 'BREAKUP', 'FRIENDSHIP_FORMED', 'RELATIONSHIP_STARTED', 'ENCOUNTER']);

/**
 * 012 CA-005, R-009: la cadena de un evento de relación. El vínculo de cada lado (el afecto sale del almacén de cada
 * uno, INV-003) y la historia del par hacia atrás por las causas: los roces, discusiones y encuentros que llevaron ahí.
 */
export function relationshipChain(world: World, get: (id: string) => WorldEvent | undefined, e: WorldEvent): ChainStep[] {
  const { a, b } = e.payload as { a: EntityId; b: EntityId };
  const side = (x: EntityId, y: EntityId) => {
    const bond = world.citizens.get(x)?.bonds?.find((z) => z.with === y);
    const fn = world.citizens.get(x)?.functions?.f.find((f) => f.s === `cit.${y}`)?.v ?? 0;
    return bond
      ? `${withNames(world, x)} → ${withNames(world, y)}: afecto ${r2(fn)}, trato ${r2(bond.familiarity ?? 0)}, tensión ${r2(bond.tension)}, confianza ${r2(bond.trust)}, ${bond.encounters ?? 0} encuentros${bond.labels?.length ? ` (${bond.labels.join(', ')})` : ''}`
      : `${withNames(world, x)} → ${withNames(world, y)}: sin vínculo hoy`;
  };
  // Historia del par: las causas del evento y las de sus causas, hasta 12 eventos, del más reciente al más antiguo.
  const seen = new Set<string>([e.id]);
  const queue = e.causes.flatMap((c) => ('event' in c ? [c.event as string] : []));
  const past: WorldEvent[] = [];
  while (queue.length && past.length < 12) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const o = get(id);
    if (!o) continue;
    past.push(o);
    queue.push(...o.causes.flatMap((c) => ('event' in c ? [c.event as string] : [])));
  }
  past.sort((x, y) => y.at - x.at);
  return [
    { step: 'Qué pasa', lines: [`${dayOf(e.at, world.config.epoch)} ${withNames(world, eventText(e))}`] },
    { step: 'Qué lo explica ahora', lines: e.causes.flatMap((c) => ('state' in c ? [`${c.state}${c.value !== undefined ? ` ${r2(c.value)}` : ''}`] : [])) },
    { step: 'El vínculo de cada lado', lines: [side(a, b), side(b, a)] },
    { step: 'Historia del par', lines: past.map((o) => `${dayOf(o.at, world.config.epoch)} ${withNames(world, eventText(o))}`) },
  ];
}

/** Una cadena está completa si ningún paso está vacío (035 CA-001). */
export const isComplete = (steps: readonly ChainStep[]): boolean => steps.every((s) => s.lines.length > 0);

export function citizenExplain(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { db: { type: 'string', default: DEFAULT_DB } } });
  const id = positionals[0];
  if (!id || !/^EVT-\d+$/.test(id)) throw new UsageError('Uso: citizen:explain EVT-00000012345');
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    const [e] = eventsById(db, [id as EntityId]);
    if (!e) throw new UsageError(`No existe ${id}`);
    const relational = RELATIONSHIP_EVENTS.has(e.type);
    if (!relational && !isChosenBehavior(e)) throw new UsageError(`${id} no es una conducta elegida (sin fuentes de control) ni un evento de relación`);
    const get = (x: string) => eventsById(db, [x as EntityId])[0];
    for (const s of relational ? relationshipChain(world, get, e) : behaviorChain(world, get, e)) {
      io.out(s.step);
      for (const l of s.lines.length ? s.lines : ['(vacío)']) io.out(`  ${l}`);
    }
  });
}

/** `event:why EVT-… [--depth 4]` (spec 019 R-004, R-007): el árbol de causas de cualquier evento, hasta su origen. */
export function eventWhy(args: string[], io: Io): void {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { db: { type: 'string', default: DEFAULT_DB }, depth: { type: 'string', default: '4' } } });
  const id = positionals[0];
  const depth = Number(v.depth);
  if (!id || !/^EVT-\d+$/.test(id) || !Number.isInteger(depth) || depth < 1) throw new UsageError('Uso: event:why EVT-00000012345 [--depth 4]');
  withDb(openReadonly(v.db), (db) => {
    const world = new WorldRepository(db).loadWorld();
    const tree = why((x) => eventsById(db, [x as EntityId])[0], id, { depth, names: (s) => withNames(world, s), view: world });
    if (!tree) throw new UsageError(`No existe ${id}`);
    for (const l of whyLines(tree, (at) => dayOf(at, world.config.epoch))) io.out(l);
  });
}
