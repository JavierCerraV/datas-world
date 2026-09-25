// Afiliación al SGSSS (spec 031 R-001; Ley 100 de 1993). Va después del empleo (006), del que depende.
import { ageInYears, idNumber, makeEvent } from '@datas-world/engine';
import type { CauseRef, EntityId, Rng, World, WorldEvent } from '@datas-world/engine';
import { INSURANCE, INSURANCE_NAMES } from './params.ts';
import type { HealthParams } from './params.ts';

const DAY = 1440;

/** Régimen especial o de excepción: policía (CIUO 5412) y docentes oficiales (sectores de educación básica). */
const SPECIAL_OCCUPATIONS = new Set(['ciuo.5412']);
const SPECIAL_SECTORS = new Set(['ciiu.8512', 'ciiu.8521']);

/**
 * 1. Cotizantes: quien tiene empleo formal (especial si es policía o docente oficial) y quien tiene pensión.
 * 2. Beneficiarios del mismo hogar: la pareja y los hijos menores de 18 (o de 25 que estudian) de un cotizante,
 *    con el régimen de ese cotizante.
 * 3. El resto: subsidiado con la probabilidad del perfil por estrato; si no, sin afiliación.
 * Cada afiliación lleva `HEALTH_INSURANCE_SET`, causada por la contratación, la pensión, el cotizante o el estrato.
 */
export function generateInsurance(
  world: World,
  livingIds: readonly EntityId[],
  priorEvents: readonly WorldEvent[],
  P: HealthParams,
  rng: Rng,
): WorldEvent[] {
  const c = world.components;
  const col = c.u8['health.insurance']!;
  const birth = (id: EntityId) => c.i32['demo.birthMinute']![idNumber(id)]!;
  const age = (id: EntityId) => ageInYears(birth(id), world.now, world.config.epoch);
  const origin = new Map<EntityId, WorldEvent>(); // evento que explica la afiliación de cada cotizante
  for (const e of priorEvents) {
    if (e.type !== 'JOB_HIRED' && e.type !== 'RETIRED') continue;
    const id = (e.payload as { citizenId: EntityId }).citizenId;
    if (e.type === 'JOB_HIRED' || !origin.has(id)) origin.set(id, e);
  }
  const events: WorldEvent[] = [];
  const affiliated = new Map<EntityId, WorldEvent>();
  const set = (id: EntityId, regime: number, at: number, causes: CauseRef[]) => {
    col[idNumber(id)] = regime;
    const e = makeEvent(world.counters, Math.min(Math.max(at, birth(id) + DAY), -DAY), {
      type: 'HEALTH_INSURANCE_SET',
      payload: { citizenId: id, regime: INSURANCE_NAMES[regime]! },
      participants: [{ id, role: 'afiliado' }],
      causes,
    });
    events.push(e);
    world.citizens.get(id)!.backstory?.push(e.id);
    affiliated.set(id, e);
  };

  // 1. Cotizantes.
  for (const id of livingIds) {
    const occ = world.citizens.get(id)!.occupation;
    const pensioned = c.u8['demo.pensioned']![idNumber(id)] === 1;
    const src = origin.get(id);
    if (occ?.kind === 'formal') {
      const org = world.organizations.get(occ.orgId)!;
      const position = org.positions.find((p) => p.id === occ.positionId)!;
      const special = SPECIAL_OCCUPATIONS.has(position.occupation) || SPECIAL_SECTORS.has(org.sector);
      set(id, special ? INSURANCE.special : INSURANCE.contributor, src?.at ?? -DAY, src ? [{ event: src.id, weight: 1 }] : [{ state: 'empleo_formal', entity: id, weight: 1 }]);
    } else if (pensioned) {
      set(id, INSURANCE.contributor, src?.at ?? -DAY, src ? [{ event: src.id, weight: 1 }] : [{ state: 'pension', entity: id, weight: 1 }]);
    }
  }

  // 2. Beneficiarios en el hogar de un cotizante.
  for (const h of [...world.households.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const holders = h.memberIds.filter((m) => affiliated.has(m));
    for (const holder of holders) {
      const regime = col[idNumber(holder)] === INSURANCE.special ? INSURANCE.special : INSURANCE.beneficiary;
      const dependents = h.kinship
        .filter((k) => k.from === holder && (k.kind === 'partner' || k.kind === 'parent'))
        .map((k) => ({ id: k.to, kind: k.kind }))
        .concat(h.kinship.filter((k) => k.to === holder && k.kind === 'partner').map((k) => ({ id: k.from, kind: 'partner' as const })));
      for (const d of dependents) {
        if (affiliated.has(d.id)) continue;
        const a = age(d.id);
        const studying = world.citizens.get(d.id)!.occupation?.kind === 'none' && (world.citizens.get(d.id)!.occupation as { reason?: string }).reason === 'student';
        if (d.kind === 'parent' && !(a < 18 || (a < 25 && studying))) continue;
        const holderEvent = affiliated.get(holder)!;
        set(d.id, regime, holderEvent.at, [{ event: holderEvent.id, weight: 1 }]);
      }
    }
  }

  // 3. Subsidiado o sin afiliación, según el estrato del barrio.
  for (const id of livingIds) {
    if (affiliated.has(id)) continue;
    const r = rng.fork('gen:health/insurance').fork(id);
    const hh = world.households.get(world.citizens.get(id)!.householdId!)!;
    const stratum = world.places.get(world.places.get(hh.dwellingId)!.districtId!)!.stratum!;
    if (r.chance(P.subsidizedP[String(stratum)] ?? 0.95))
      set(id, INSURANCE.subsidized, -r.int(1, 3650) * DAY, [{ state: 'estrato', value: stratum, weight: 1 }]);
    else col[idNumber(id)] = INSURANCE.none;
  }
  return events;
}
