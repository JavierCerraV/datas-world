// Vínculos familiares de partida (spec 012 R-007): cada pariente vivo del mundo es un vínculo `familia` (y `pareja`
// la pareja del hogar), con la familiaridad de la convivencia. El afecto no va aquí: es la función de `cit.<id>` que
// dejó el desarrollo (generate.ts). Un compañero o un vecino parten de cero (los forma el sistema de encuentros).
import { CLAIM_DEFAULTS } from '@datas-world/engine';
import type { Bond, BondLabel, EntityId, World } from '@datas-world/engine';
import type { Kin } from './context.ts';

/** [M] Familiaridad de partida: quien convive se conoce mucho; el resto de la familia, a medias. */
export const KIN_FAMILIARITY = Object.freeze({ household: 0.8, other: 0.4 });

export function kinBonds(world: World, id: EntityId, kin: Kin): Bond[] {
  const me = world.citizens.get(id);
  const all = [kin.mother, kin.father, ...kin.grandparents, ...kin.siblings, kin.partner, ...kin.children];
  const ids = [...new Set(all.filter((x): x is EntityId => !!x && x !== id))].sort();
  const bonds: Bond[] = [];
  for (const other of ids) {
    const o = world.citizens.get(other);
    if (!o || o.ancestor || o.status !== 'active') continue;
    const home = me?.householdId !== undefined && me.householdId === o.householdId;
    const labels: BondLabel[] = other === kin.partner ? ['familia', 'pareja'] : ['familia'];
    bonds.push({
      with: other, tension: 0, trust: CLAIM_DEFAULTS.trust0Family, at: world.now,
      familiarity: home ? KIN_FAMILIARITY.household : KIN_FAMILIARITY.other, labels, encounters: 0,
    });
  }
  return bonds;
}
