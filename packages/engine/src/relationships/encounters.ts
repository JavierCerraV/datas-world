// Sistema de encuentros (spec 012 R-001 a R-005): en cada lugar, las personas despiertas se encuentran según la
// fuerza de acercarse y la familiaridad; el intercambio (exchange.ts) forma la función del otro en cada lado, y el
// encuentro deja familiaridad, confianza, tensión, etiquetas y, si toca, pareja. Fase `interactions`.
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { pickIndex } from '../decision/select.ts';
import { CHAT_UNTIL } from '../conversation/inputs.ts';
import { areFamily } from '../conversation/claims.ts';
import { tensionNow } from '../conversation/encounter.ts';
import type { ChatParams, ClaimParams } from '../conversation/params.ts';
import type { PersonCtx } from '../conversation/stance.ts';
import type { ChatCatalog } from '../conversation/types.ts';
import { variabilityOf } from '../functions/history.ts';
import { sensitivityOf } from '../functions/sensitivity.ts';
import { learningParams, storeOf } from '../functions/system.ts';
import type { FunctionStore, Ontology } from '../functions/types.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import type { Rng } from '../rng.ts';
import { rulesOf } from '../rules/routine.ts';
import type { CauseRef } from '../events.ts';
import type { DeepReadonly, Patch, System, SystemEvent, SystemOutput, TickCtx, WorldView } from '../simulation/system.ts';
import type { Belief, Bond } from '../world.ts';
import { tellInEncounter } from '../knowledge/tell.ts';
import type { TellDeps, TellSide } from '../knowledge/tell.ts';
import { affectionFor, bondCauses, bondWith, hasPartner, relabel, sameOrg, setLabel, touch } from './bonds.ts';
import { exchange } from './exchange.ts';
import { APPROACH, CLASH, personStimulus } from './params.ts';
import { directValue } from '../functions/learn.ts';
import { functionalValue } from '../relations/derive.ts';
import type { RelationshipParams } from './params.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 1000) / 1000;
const DAY = 1440;
const YEAR = 365.25 * DAY;
/** Actividades en las que no hay encuentro: dormir, estar enfermo, ir de camino o estar en una charla. */
const BUSY = new Set<number>([ACTIVITY.sleep, ACTIVITY.sick, ACTIVITY.commute, ACTIVITY.conversation]);

/** Fuerza aprendida de acercarse a alguien (036 R-002), sin contexto; la de partida si nunca se aprendió. */
export const approachOf = (store: DeepReadonly<FunctionStore> | undefined, p: RelationshipParams): number =>
  store?.r.find((x) => x.r === APPROACH && x.c === '')?.w ?? p.approachW0;

export interface EncounterDeps {
  cat: ChatCatalog;
  onto: Ontology;
  chat: ChatParams;
  claim: ClaimParams;
  p: RelationshipParams;
  /** 025: lo que se cuenta en los encuentros; sin esto, nadie cuenta nada. */
  knowledge?: TellDeps;
}

export function createSocialEncounterSystem(d: EncounterDeps): System {
  const { p } = d;
  return {
    id: 'social_encounters', phase: 'interactions', order: 50, capability: 'relationships', cadence: 'tick', minLevel: 0,
    run: (view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput => {
      const now = ctx.now;
      const u8 = view.components.u8[ACTIVITY_COLUMN];
      const loc = view.components.i32['loc.place'];
      const chatUntil = view.components.i32[CHAT_UNTIL];
      const byPlace = new Map<number, number[]>();
      for (const row of ctx.citizens) {
        const place = loc?.[row] ?? 0;
        if (place === 0 || BUSY.has(u8?.[row] ?? 0) || (chatUntil?.[row] ?? 0) > now) continue;
        if (view.citizens.get(formatId('CIT', row) as EntityId)?.status !== 'active') continue;
        (byPlace.get(place) ?? byPlace.set(place, []).get(place)!).push(row);
      }
      const P = learningParams(view.config.profile, view.config.epoch.slice(0, 10));
      const stores = new Map<number, FunctionStore>();
      const bonds = new Map<number, Bond[]>();
      const pcs = new Map<number, PersonCtx>();
      const used = new Map<number, number>();
      const met = new Set<number>();
      const storeFor = (row: number) => stores.get(row) ?? stores.set(row, storeOf(view, row)).get(row)!;
      const bondsFor = (row: number) =>
        bonds.get(row) ?? bonds.set(row, JSON.parse(JSON.stringify(view.citizens.get(formatId('CIT', row) as EntityId)?.bonds ?? [])) as Bond[]).get(row)!;
      const beliefs = new Map<number, Belief[]>();
      const beliefsFor = (row: number) =>
        beliefs.get(row) ?? beliefs.set(row, JSON.parse(JSON.stringify(view.citizens.get(formatId('CIT', row) as EntityId)?.beliefs ?? [])) as Belief[]).get(row)!;
      const pcFor = (row: number): PersonCtx => {
        const hit = pcs.get(row);
        if (hit) return hit;
        const net = view.citizens.get(formatId('CIT', row) as EntityId)?.network;
        const pc: PersonCtx = {
          onto: d.onto, P, sens: sensitivityOf(view, row), rules: rulesOf(view, row), variability: variabilityOf(view, row),
          // La postura solo lee la red (valueContribution): no hace falta copiarla.
          ...(net ? { net: net as RelationalNetwork } : {}),
        };
        pcs.set(row, pc);
        return pc;
      };
      // R-001: tope por hora, con los encuentros ya registrados en los vínculos en esta hora.
      const hourStart = now - (now % 60);
      const usedBy = (row: number) => {
        const hit = used.get(row);
        if (hit !== undefined) return hit;
        const list = bonds.get(row) ?? view.citizens.get(formatId('CIT', row) as EntityId)?.bonds ?? [];
        let n = 0;
        for (const b of list) if ((b.lastEncounter ?? -1) >= hourStart) n++;
        used.set(row, n);
        return n;
      };
      // Valor de un estímulo para una persona (037 R-003): el directo o el derivado de su red, el de mayor magnitud.
      const valueOf = (row: number, stim: string) => {
        const c = view.citizens.get(formatId('CIT', row) as EntityId);
        const own = (stores.get(row) ?? c?.functions) as FunctionStore | undefined;
        return functionalValue(c?.network as RelationalNetwork | undefined, (s) => directValue(own, d.onto, s, '', now, P), stim).value;
      };
      const live = (row: number) => ({ energy: view.components.f32['need.energy']?.[row] ?? 1, stress: view.components.f32['state.stress']?.[row] ?? 0 });
      const adult = (row: number) => (now - (view.components.i32['demo.birthMinute']?.[row] ?? 0)) / YEAR >= 18;
      const events: SystemEvent[] = [];

      const meet = (ra: number, rb: number, place: number, r: Rng) => {
        const a = formatId('CIT', ra) as EntityId;
        const b = formatId('CIT', rb) as EntityId;
        const plc = formatId('PLC', place) as EntityId;
        const fam = areFamily(view, a, b);
        const trust0 = fam ? d.claim.trust0Family : d.claim.trust0Other;
        const ab = bondWith(bondsFor(ra), b, now, trust0).bond;
        const ba = bondWith(bondsFor(rb), a, now, trust0).bond;
        const first = (ab.encounters ?? 0) === 0 && (ba.encounters ?? 0) === 0 && (ab.familiarity ?? 0) === 0 && !fam;
        // La tensión vigente se fija antes de mover `at` (su decaimiento es perezoso, 044 R-007).
        const t0 = Math.max(tensionNow(ab, now, d.claim), tensionNow(ba, now, d.claim));
        ab.tension = t0;
        ba.tension = t0;
        const sa = storeFor(ra);
        const sb = storeFor(rb);
        const ex = exchange(
          { id: a, store: sa, pc: pcFor(ra), live: live(ra), tension: t0 },
          { id: b, store: sb, pc: pcFor(rb), live: live(rb), tension: t0 },
          d.cat, d.chat, p, now, r,
        );
        touch(ab, now, p);
        touch(ba, now, p);
        used.set(ra, usedBy(ra) + 1);
        used.set(rb, usedBy(rb) + 1);
        met.add(ra);
        met.add(rb);
        // R-003: la confianza sube si el otro se abre o aplaca, y baja si contraataca.
        const trustDelta = (s: string) => (s === 'abrirse' || s === 'aplacar' ? p.trustStep : s === 'contraatacar' ? -p.trustStep : 0);
        ab.trust = clamp01(ab.trust + trustDelta(ex.stanceB));
        ba.trust = clamp01(ba.trust + trustDelta(ex.stanceA));
        const who = [{ id: a, role: 'persona' }, { id: b, role: 'persona' }];
        const here: CauseRef = { state: 'mismo_lugar', entity: plc, weight: first ? 1 : 0.3 };
        const history = () => [...new Map([...bondCauses(ab, 0.5), ...bondCauses(ba, 0.5)].map((c) => [c.event, c])).values()];
        if (first) events.push({ type: 'MET', payload: { a, b, placeId: plc }, causes: [here], participants: who, placeId: plc });
        // R-005: un choque sube la tensión; con tensión previa alta y sin discusión reciente, es una discusión.
        if (CLASH.has(ex.stanceA) || CLASH.has(ex.stanceB)) {
          const t1 = clamp01(t0 + Math.min(p.clashTension, d.claim.maxTensionDelta));
          ab.tension = t1;
          ba.tension = t1;
          const cooled = now - (ab.lastArgument ?? -Infinity) >= p.argumentCooldownDays * DAY;
          if (t0 > p.argumentTension && cooled) {
            ab.lastArgument = now;
            ba.lastArgument = now;
            events.push({
              type: 'ARGUMENT', payload: { a, b, stanceA: ex.stanceA, stanceB: ex.stanceB, tension: round(t0) },
              causes: [{ state: 'tension', entity: b, value: round(t0), weight: 1 }, ...history()], participants: who, placeId: plc,
            });
          } else {
            events.push({ type: 'ENCOUNTER', payload: { a, b, stanceA: ex.stanceA, stanceB: ex.stanceB }, causes: [here, ...history()], participants: who, placeId: plc });
          }
        } else if (t0 > 0 && [ex.stanceA, ex.stanceB].some((s) => s === 'abrirse' || s === 'aplacar')) {
          // R-003: un buen rato sin choque repara parte del conflicto vivo.
          ab.tension = t0 * (1 - p.repair);
          ba.tension = t0 * (1 - p.repair);
        }
        // R-004: etiquetas de cada lado, con el afecto de su propio almacén (INV-003).
        const org = sameOrg(view, a, b);
        const fnAB = affectionFor(sa, b);
        const fnBA = affectionFor(sb, a);
        for (const [x, y, bond, fn] of [[a, b, ab, fnAB], [b, a, ba, fnBA]] as const) {
          if (relabel(bond, fn, org, p).becameFriend)
            events.push({ type: 'FRIENDSHIP_FORMED', payload: { a: x, b: y }, causes: [{ state: 'funcion', entity: y, value: round(fn), weight: 1 }, ...bondCauses(bond, 0.5)], participants: who });
        }
        // R-004 (P3): pareja nueva entre adultos sin pareja que no son familia, con afecto alto en ambos lados.
        if (!fam && adult(ra) && adult(rb) && Math.min(fnAB, fnBA) >= p.partnerFn && Math.min(ab.familiarity ?? 0, ba.familiarity ?? 0) >= p.partnerFam
          && !hasPartner(view, a, bondsFor(ra)) && !hasPartner(view, b, bondsFor(rb))) {
          setLabel(ab, 'pareja', true);
          setLabel(ba, 'pareja', true);
          events.push({ type: 'RELATIONSHIP_STARTED', payload: { a, b }, causes: [{ state: 'funcion_mutua', entity: b, value: round(Math.min(fnAB, fnBA)), weight: 1 }, ...history()], participants: who });
        }
        // 025 R-003 a R-006: quien se abre corrige o cuenta algo de un tercero (el oyente lo aplica el sistema de
        // conocimiento al final del tick).
        if (d.knowledge && view.capabilities.includes('beliefs')) {
          const side = (row: number, id: EntityId, stance: string): TellSide => ({
            id, store: storeFor(row), beliefs: beliefsFor(row), net: view.citizens.get(id)?.network as RelationalNetwork | undefined, stance, P, sens: pcFor(row).sens,
          });
          const sa = side(ra, a, ex.stanceA);
          const sb = side(rb, b, ex.stanceB);
          events.push(...tellInEncounter(view, sa, sb, here, d.knowledge, now, r.fork('cuenta-a')));
          events.push(...tellInEncounter(view, sb, sa, here, d.knowledge, now, r.fork('cuenta-b')));
        }
      };

      // R-001: por lugar (en orden de id) y por persona (en orden de fila); azar `relationships/<lugar>`.
      for (const place of [...byPlace.keys()].sort((x, y) => x - y)) {
        const rows = byPlace.get(place)!;
        if (rows.length < 2) continue;
        const r = rng.fork(place);
        for (const row of rows) {
          const roll = r.next();
          if (usedBy(row) >= p.maxEncountersHour || roll >= p.pInitiate * approachOf(stores.get(row) ?? view.citizens.get(formatId('CIT', row) as EntityId)?.functions, p)) continue;
          const others = rows.filter((o) => o !== row && usedBy(o) < p.maxEncountersHour);
          if (others.length === 0) continue;
          const me = bondsFor(row);
          // R-001 con la 013 R-009: la función del otro (directa o derivada de lo que la experiencia enseñó en la
          // red) acerca o aparta, aunque los episodios que la formaron ya se olvidaran.
          const w = others.map((o) => {
            const oid = formatId('CIT', o) as EntityId;
            return (0.3 + (me.find((b) => b.with === oid)?.familiarity ?? 0)) * Math.max(0.1, 1 + valueOf(row, personStimulus(oid)));
          });
          const total = w.reduce((s, x) => s + x, 0);
          const other = others[pickIndex(w.map((x) => x / total), r.next())]!;
          meet(row, other, place, r.fork(`${row}/${other}`));
        }
      }
      const patches: Patch[] = [];
      for (const row of [...met].sort((x, y) => x - y)) {
        const id = formatId('CIT', row) as EntityId;
        patches.push({ op: 'entity', id, owned: true, fields: { bonds: bonds.get(row), functions: stores.get(row), ...(beliefs.has(row) ? { beliefs: beliefs.get(row) } : {}) } });
      }
      return { patches, events };
    },
  };
}
