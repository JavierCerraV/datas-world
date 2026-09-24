// Composición de un hogar a partir de su plantilla (spec 008 R-001 a R-003). Puro: recibe el azar.
import type { KinshipKind, Rng } from '@datas-world/engine';
import { TEMPLATES } from './params.ts';
import type { PopulationParams, Range, Template } from './params.ts';

export interface MemberSpec {
  sex: 'F' | 'M';
  age: number;
  /** Índices de los miembros de los que toma el primer apellido (padre, madre); `null` = apellido al azar. */
  surnameFrom: [number | null, number | null];
}

export interface HouseholdSpec {
  template: Template;
  members: MemberSpec[];
  /** Parentesco dirigido por índices: "from es <kind> de to". */
  kinship: { from: number; to: number; kind: KinshipKind }[];
  head: number;
  caregivers: number[];
}

const between = (r: Rng, [a, b]: Range) => r.int(a, b);

export function pickTemplate(r: Rng, weights: Record<Template, number>): Template {
  const total = TEMPLATES.reduce((s, t) => s + weights[t], 0);
  let x = r.next() * total;
  for (const t of TEMPLATES) {
    x -= weights[t];
    if (x < 0 && weights[t] > 0) return t;
  }
  return TEMPLATES.filter((t) => weights[t] > 0).at(-1)!;
}

/** Edad de un hijo según el modelo del perfil; `null` si el progenitor es demasiado joven para tenerlo. */
function childAge(r: Rng, P: PopulationParams, parentAge: number, gap: number, atBirth: Range): number | null {
  if (P.kidAgeModel === 'uniform') return r.int(0, Math.max(0, Math.min(17, parentAge - gap)));
  const hi = Math.min(atBirth[1], parentAge);
  if (hi < atBirth[0]) return null;
  return parentAge - r.int(atBirth[0], hi);
}

export function composeHousehold(r: Rng, P: PopulationParams): HouseholdSpec {
  const template = pickTemplate(r, P.weights);
  const members: MemberSpec[] = [];
  const kinship: HouseholdSpec['kinship'] = [];
  const add = (sex: 'F' | 'M', age: number, surnameFrom: [number | null, number | null] = [null, null]) =>
    members.push({ sex, age: Math.max(0, Math.round(age)), surnameFrom }) - 1;
  const sex = (pF: number) => (r.chance(pF) ? 'F' : 'M');
  const siblings = (kids: number[]) => {
    for (let i = 0; i < kids.length; i++)
      for (let j = i + 1; j < kids.length; j++) kinship.push({ from: kids[i]!, to: kids[j]!, kind: 'sibling' });
  };
  const kidCount = (k: Range) => between(r, k) + (r.chance(P.kids.extraP) ? 1 : 0);
  let caregivers: number[] = [];

  if (template === 'single') {
    add(sex(0.5), between(r, P.age.single));
  } else if (template === 'couple' || template === 'couple_kids') {
    const age = between(r, template === 'couple' ? P.age.couple : P.age.coupleKids);
    const a = add('M', age);
    const b = add(
      r.chance(P.p.sameSexCouple) ? 'M' : 'F',
      Math.min(90, Math.max(20, age + between(r, P.partnerAgeDelta))),
    );
    kinship.push({ from: a, to: b, kind: 'partner' });
    if (template === 'couple_kids') {
      const kids: number[] = [];
      const n = kidCount(P.kids.coupleKids);
      for (let i = 0; i < n; i++) {
        // Prototipo: la edad del hijo se toma del primer progenitor; con birthAge, del más joven (debió poder tenerlo).
        const parentAge = P.kidAgeModel === 'uniform' ? members[a]!.age : Math.min(members[a]!.age, members[b]!.age);
        const k = childAge(r, P, parentAge, P.kidGap[0], P.parentAgeAtBirth);
        if (k === null) continue;
        const kid = add(sex(0.5), k, [a, b]);
        kinship.push({ from: a, to: kid, kind: 'parent' }, { from: b, to: kid, kind: 'parent' });
        kids.push(kid);
      }
      siblings(kids);
      caregivers = [a, b];
    }
  } else if (template === 'single_parent') {
    const a = add(sex(P.p.femaleSingleParent), between(r, P.age.singleParent));
    const kids: number[] = [];
    const n = kidCount(P.kids.singleParent);
    for (let i = 0; i < n; i++) {
      const k = childAge(r, P, members[a]!.age, P.kidGap[1], P.parentAgeAtBirth);
      if (k === null) continue;
      const kid = add(sex(0.5), k, [a, null]);
      kinship.push({ from: a, to: kid, kind: 'parent' });
      kids.push(kid);
    }
    siblings(kids);
    caregivers = [a];
  } else if (template === 'extended') {
    const g = add(sex(P.p.femaleGrandparent), between(r, P.age.grandparent));
    const a = add(
      sex(0.5),
      Math.max(P.kidAgeModel === 'uniform' ? 20 : 18, members[g]!.age - between(r, P.adultChildGap)),
      [g, null],
    );
    kinship.push({ from: g, to: a, kind: 'parent' });
    const k = childAge(r, P, members[a]!.age, P.kidGap[1], P.grandchildParentAge);
    if (k !== null) {
      const kid = add(sex(0.5), k, [a, null]);
      kinship.push({ from: a, to: kid, kind: 'parent' }, { from: g, to: kid, kind: 'grandparent' });
      // 008 R-003: con un menor en casa, el abuelo o la abuela también es cuidador.
      if (members[kid]!.age < 18) caregivers = [a, g];
    }
  } else {
    const n = between(r, P.roommateCount);
    for (let i = 0; i < n; i++) add(sex(0.5), between(r, P.age.roommates));
  }
  // Cabeza del hogar: el primer adulto (como `genPopulation` del prototipo).
  const head = members.findIndex((m) => m.age >= 18);
  if (head < 0) throw new Error(`Plantilla ${template} sin adultos`);
  return { template, members, kinship, head, caregivers };
}
