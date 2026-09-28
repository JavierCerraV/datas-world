// Afirmaciones del visitante sobre terceros (spec 044 R-001 a R-004): de quién habla, cuánto lo cree y cuánto le
// pega según su historia. Puro y sin azar. Nunca lee lo que el tercero piensa o hizo (044 INV-001, regla de oro 3):
// solo la estructura que la persona conoce (su hogar, su familia y su trabajo) y su propia historia.
import type { EntityId } from '../ids.ts';
import { directValue } from '../functions/learn.ts';
import { functionalValue } from '../relations/derive.ts';
import { valueContribution } from '../rules/values.ts';
import type { WorldView } from '../simulation/system.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { ClaimParams } from './params.ts';
import { visitorValue } from './tone.ts';
import type { LearnerCtx } from './tone.ts';
import type { ChatCatalog, ClaimAssessment, ConversationState, HeardClaim, RelationResolve } from './types.ts';

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 1000) / 1000;

/** Lo que se lee de la persona: su aprendizaje y su red relacional (la `PersonCtx` de la postura la cumple). */
export type ClaimCtx = LearnerCtx & { net?: RelationalNetwork | undefined };

const FAMILY: ReadonlySet<RelationResolve> = new Set(['partner', 'mother', 'father', 'child', 'sibling']);

/** La primera por id de las personas activas que cumplen `pick` (orden estable, 023). */
function firstCitizen(view: WorldView, pick: (id: EntityId) => boolean): EntityId | undefined {
  const ids = [...view.citizens.values()].filter((c) => c.status === 'active' && pick(c.id)).map((c) => c.id).sort();
  return ids[0];
}

/**
 * R-001: la persona real a la que se refiere la relación, desde lo que el ciudadano conoce. Si tiene varias (hijos,
 * hermanos, compañeros), la primera por id, hasta que la 012 dé la más cercana.
 */
export function resolveRelation(view: WorldView, citizenId: EntityId, resolve: RelationResolve): EntityId | undefined {
  const me = view.citizens.get(citizenId);
  if (!me) return undefined;
  const active = (id: EntityId | undefined) => (id && view.citizens.get(id)?.status === 'active' ? id : undefined);
  switch (resolve) {
    case 'partner': {
      const h = me.householdId ? view.households.get(me.householdId) : undefined;
      const k = h?.kinship.find((x) => x.kind === 'partner' && (x.from === citizenId || x.to === citizenId));
      return active(k ? (k.from === citizenId ? k.to : k.from) : undefined);
    }
    case 'mother':
      return active(me.motherId);
    case 'father':
      return active(me.fatherId);
    case 'child':
      return firstCitizen(view, (id) => {
        const c = view.citizens.get(id)!;
        return c.motherId === citizenId || c.fatherId === citizenId;
      });
    case 'sibling':
      return firstCitizen(view, (id) => {
        const c = view.citizens.get(id)!;
        return id !== citizenId && ((me.motherId !== undefined && c.motherId === me.motherId) || (me.fatherId !== undefined && c.fatherId === me.fatherId));
      });
    case 'boss':
    case 'coworker': {
      if (me.occupation?.kind !== 'formal') return undefined;
      const org = view.organizations.get(me.occupation.orgId);
      const mine = org?.positions.find((p) => p.holderId === citizenId);
      if (!org || !mine) return undefined;
      if (resolve === 'boss') return active(org.positions.find((p) => p.id === mine.supervisorPositionId)?.holderId);
      const others = org.positions.filter((p) => p.holderId && p.holderId !== citizenId).map((p) => p.holderId!);
      return firstCitizen(view, (id) => others.includes(id));
    }
  }
}

/** Son familia cercana: mismo hogar, padre o madre, o comparten padre o madre (hasta la 012). */
export function areFamily(view: WorldView, a: EntityId, b: EntityId): boolean {
  const x = view.citizens.get(a);
  const y = view.citizens.get(b);
  if (!x || !y) return false;
  if (x.householdId !== undefined && x.householdId === y.householdId) return true;
  if (x.motherId === b || x.fatherId === b || y.motherId === a || y.fatherId === a) return true;
  return (x.motherId !== undefined && x.motherId === y.motherId) || (x.fatherId !== undefined && x.fatherId === y.fatherId);
}

/** R-007: el vínculo con el tercero; si aún no se tocó, la confianza de partida [M] (hasta la 012). */
export function bondOf(view: WorldView, citizenId: EntityId, other: EntityId, family: boolean, p: ClaimParams): { tension: number; trust: number } {
  const b = view.citizens.get(citizenId)?.bonds?.find((x) => x.with === other);
  return b ? { tension: b.tension, trust: b.trust } : { tension: 0, trust: family ? p.trust0Family : p.trust0Other };
}

const discarded = (c: HeardClaim, why: string): ClaimAssessment => ({
  predicate: c.predicate, relation: c.about, discarded: why, credibility: 0, value: 0, impact: 0, valueSource: 'direct',
});

/**
 * R-002 y R-003:
 * - credibilidad = `credBase + credSource × v(visitante) ± credTrust × (confianza − 0,5) − credContra × contradicción`.
 *   La confianza en el tercero sube la credibilidad de lo bueno y baja la de lo malo (signo del valor de partida).
 *   La contradicción con su historia llega con la memoria episódica (013): hoy es 0.
 * - función del estímulo = `prior + f` en [−1,1], con `f` la aprendida o la derivada por la red (037), la de mayor
 *   magnitud; impacto = `credibilidad × |función| × cercanía × (1 + valueAmp × valor opuesto)`.
 */
export function assessClaim(
  s: ConversationState, pc: ClaimCtx, view: WorldView, citizenId: EntityId, cat: ChatCatalog, c: HeardClaim, now: number, p: ClaimParams,
): ClaimAssessment {
  const def = cat.claims?.find((x) => x.key === c.predicate);
  if (!def) return discarded(c, 'afirmación desconocida');
  const rel = cat.relations?.find((x) => x.key === c.about);
  if (!rel || !def.about.includes(rel.key)) return discarded(c, `no se puede decir de ${c.about}`);
  const about = resolveRelation(view, citizenId, rel.resolve);
  if (!about) return discarded(c, `no tiene ${rel.key}`);
  const directOf = (x: string) => directValue(s.store, pc.onto, x, '', now, pc.P);
  const fv = functionalValue(pc.net, directOf, def.stimulus);
  const value = clamp1(def.prior + fv.value);
  const sign = def.prior < 0 ? -1 : 1;
  const { trust } = bondOf(view, citizenId, about, FAMILY.has(rel.resolve), p);
  const credibility = clamp01(p.credBase + p.credSource * visitorValue(s) + sign * p.credTrust * (trust - 0.5));
  const opposed = value < 0 ? valueContribution(pc.net, directOf, def.stimulus) : undefined;
  const impact = clamp01(credibility * Math.abs(value) * rel.closeness * (1 + p.valueAmp * (opposed?.value ?? 0)));
  return {
    predicate: def.key, relation: rel.key, about, credibility: round(credibility), value: round(value), impact: round(impact),
    valueSource: fv.source, ...(fv.derived ? { derivedFrom: fv.derived.to } : {}), ...(opposed ? { opposedValue: opposed.root } : {}),
  };
}

/**
 * R-004: las afirmaciones del turno. Las que le pegan en contra suman su impacto a la carga aversiva de la charla
 * en este turno, así que la 040 elige con más fuerza contraatacar, poner un límite o terminar si su historia lo
 * reforzó. Se anotan en el turno para la consolidación y la explicación.
 */
export function claimsHeard(
  s: ConversationState, pc: ClaimCtx, view: WorldView, citizenId: EntityId, cat: ChatCatalog, claims: readonly HeardClaim[], now: number, p: ClaimParams,
): ClaimAssessment[] {
  const seen = new Set<string>();
  const out: ClaimAssessment[] = [];
  for (const c of claims) {
    const k = `${c.predicate}/${c.about}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const a = assessClaim(s, pc, view, citizenId, cat, c, now, p);
    if (!a.discarded && a.value < 0) s.aversiveLoad += a.impact;
    out.push(a);
  }
  s.maxLoad = Math.max(s.maxLoad, s.aversiveLoad);
  const last = s.turns.at(-1);
  if (last && out.length > 0) {
    last.aversiveLoad = s.aversiveLoad;
    last.claims = out;
  }
  return out;
}
