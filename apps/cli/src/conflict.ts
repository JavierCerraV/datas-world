// Sección de `citizen:report` para las consecuencias de la charla (spec 044 CA-005): lo que la persona cree de
// otros, lo que piensa hacer, cómo están sus vínculos y, por cada conflicto, la cadena de causas completa hasta lo
// que oyó en la charla. Solo lee el estado persistido y el registro de eventos (CLAUDE.md §8).
import { CLAIM_DEFAULTS, affectionFor, eventText, tensionNow } from '@datas-world/engine';
import type { Citizen, EntityId, World, WorldEvent } from '@datas-world/engine';
import { eventsById, queryEvents } from '@datas-world/persistence';
import type { Db } from '@datas-world/persistence';
import { dayOf, nameOf, withNames } from './common.ts';

const CHAIN_TYPES = new Set(['CONFRONTATION', 'BOND_STRAINED', 'INTENTION_EXPIRED']);
const MAX_DEPTH = 10;

/** La cadena de causas de un evento, siguiendo su causa de evento de más peso hasta el origen (o `MAX_DEPTH`). */
export function causalChain(db: Db, e: WorldEvent): WorldEvent[] {
  const chain = [e];
  let cur = e;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const next = cur.causes
      .filter((c): c is { event: EntityId; weight: number } => 'event' in c)
      .sort((a, b) => b.weight - a.weight)[0];
    if (!next) break;
    const [found] = eventsById(db, [next.event]);
    if (!found || found.type === 'EXTERNAL_INPUT_APPLIED') break;
    chain.push(found);
    cur = found;
  }
  return chain;
}

const who = (world: World, id: string) => (id.startsWith('CIT-') ? `${nameOf(world, id as EntityId)} (${id})` : id.startsWith('EXT-') ? `un visitante (${id})` : id);

/** Líneas de la sección; vacía si la persona no tiene creencias, intenciones, vínculos ni conflictos. */
export function conflictLines(world: World, db: Db, c: Citizen): string[] {
  const conflicts = queryEvents(db, { participant: c.id, types: [...CHAIN_TYPES], limit: 100 });
  if (!c.beliefs?.length && !c.intentions?.length && !c.bonds?.length && conflicts.length === 0) return [];
  const epoch = world.config.epoch;
  const out = ['', 'Creencias, intenciones y vínculos (044)'];
  for (const b of c.beliefs ?? [])
    out.push(`  Cree que ${who(world, b.about)}: ${b.predicate.replace(/_/g, ' ')} · se lo dijo ${who(world, b.source)} · credibilidad ${b.credibility.toFixed(2)} · ${dayOf(b.at, epoch)}`);
  for (const it of c.intentions ?? [])
    out.push(`  Piensa ${it.kind} a ${who(world, it.target)} por «${it.topic.replace(/_/g, ' ')}» · urgencia ${it.urgency.toFixed(2)} · hasta ${dayOf(it.expiresAt, epoch)}`);
  // Vínculos (012): etiquetas, trato y afecto (del almacén de la persona, INV-003), más tensión y confianza (044).
  const bonds = [...(c.bonds ?? [])].sort((x, y) => (y.familiarity ?? 0) - (x.familiarity ?? 0) || (x.with < y.with ? -1 : 1));
  for (const b of bonds) {
    const labels = b.labels?.length ? ` (${b.labels.join(', ')})` : '';
    const fn = affectionFor(c.functions, b.with);
    out.push(`  Vínculo con ${who(world, b.with)}${labels}: trato ${(b.familiarity ?? 0).toFixed(2)} · afecto ${fn > 0 ? '+' : ''}${fn.toFixed(2)} · tensión ${tensionNow(b, world.now, CLAIM_DEFAULTS).toFixed(2)} · confianza ${b.trust.toFixed(2)}`);
  }
  for (const e of conflicts) {
    out.push(`  Por qué: ${dayOf(e.at, epoch)}`);
    for (const [i, x] of causalChain(db, e).entries()) out.push(`    ${i === 0 ? '' : '← '}${withNames(world, eventText(x))}`);
  }
  return out;
}
