// Generador de organizaciones (spec 006): una por lugar de trabajo, con puestos, sueldos, turnos y cultura.
// Sin contratación: los titulares llegan con el empleo inicial (bloque G).
import { addOrganization, formatDate, profileNumber, toCalendar } from '@datas-world/engine';
import type { EntityId, NewPosition, Rng, Shift, World } from '@datas-world/engine';
import { catalogEntry } from '../catalogs/load.ts';
import type { Catalogs } from '../catalogs/load.ts';

interface WorkAttrs {
  slots: number;
  payProtoDaily: number;
  wageMultiple: number;
  shiftProto: Omit<Shift, 'lunch'>;
  shiftCO: Shift;
  occupations: { boss: string; staff: string[] };
}

export interface OrganizationsOptions {
  /** Usa el sueldo diario y los turnos del prototipo (perfil de paridad, spec 029 R-004). */
  prototype?: boolean;
}

const round1000 = (v: number) => Math.round(v / 1000) * 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fecha del mundo ("AAAA-MM-DD") en la que se consulta el perfil: el presente del mundo. */
export const worldDate = (world: World): string => formatDate(toCalendar(world.now, world.config.epoch));

/**
 * Crea una organización por cada lugar de trabajo, en el orden recibido. El azar sale de
 * `rng.fork(placeId)`: sueldo de cada puesto y cultura de cada organización (006 R-001, R-003).
 */
export function generateOrganizations(
  world: World,
  workplaceIds: readonly EntityId[],
  catalogs: Pick<Catalogs, 'place_kinds' | 'org_sectors' | 'occupations'>,
  rng: Rng,
  opts: OrganizationsOptions = {},
): EntityId[] {
  const profile = world.config.profile;
  if (!profile) throw new Error('El mundo no tiene perfil de país (spec 029)');
  const date = worldDate(world);
  const minWage = opts.prototype ? 0 : profileNumber(profile, 'labor.minimumWageMonthly', date);
  const maxHours = opts.prototype ? Infinity : profileNumber(profile, 'labor.maxWeeklyHours', date);
  const bossFactor = profileNumber(profile, 'gen.jobs.bossWageFactor', date);

  return workplaceIds.map((placeId) => {
    const place = world.places.get(placeId);
    if (!place) throw new Error(`No existe el lugar ${placeId}`);
    const kind = catalogEntry(catalogs.place_kinds, place.kind);
    const a = kind.attrs as unknown as WorkAttrs;
    if (!a?.slots || !a.occupations) throw new Error(`${place.kind} no tiene puestos en el catálogo`);
    const sector = catalogEntry(catalogs.org_sectors, `ciiu.${kind.code}`).key;
    const shift: Shift = opts.prototype ? { ...a.shiftProto, lunch: 0 } : a.shiftCO;
    const days = shift.days === 'mon-fri' ? 5 : 6;
    if (((shift.end - shift.start - shift.lunch) * days) / 60 > maxHours) {
      throw new Error(`${place.kind}: el turno supera la jornada máxima vigente (${maxHours} h)`);
    }
    const r = rng.fork(placeId);
    const positions: NewPosition[] = [];
    for (let i = 0; i < a.slots; i++) {
      const boss = i === 0;
      const occupation = boss ? a.occupations.boss : a.occupations.staff[(i - 1) % a.occupations.staff.length]!;
      const title = catalogEntry(catalogs.occupations, occupation).name;
      const pr = r.fork(i);
      let wage: number;
      if (opts.prototype) {
        // hire(): sueldo diario = pay × U(0,85, 1,2), redondeado a miles; el jefe × 1,6.
        wage = round1000(a.payProtoDaily * (0.85 + 0.35 * pr.next()));
      } else {
        // 006 R-003: múltiplo del salario mínimo × U(0,9, 1,2), nunca por debajo del mínimo en un puesto formal.
        wage = Math.max(minWage, round1000(a.wageMultiple * minWage * (0.9 + 0.3 * pr.next())));
      }
      if (boss) wage = round1000(wage * bossFactor);
      positions.push({
        title,
        level: boss ? 1 : 0,
        occupation,
        wage,
        wagePeriod: opts.prototype ? 'day' : 'month',
        shift: { ...shift },
        ...(boss ? {} : { supervisor: 0 }),
      });
    }
    const c = r.fork('culture');
    return addOrganization(world, {
      name: place.name,
      sector,
      placeIds: [placeId],
      positions,
      culture: {
        strictness: clamp01(c.normal(0.5, 0.15)),
        warmth: clamp01(c.normal(0.5, 0.15)),
        stability: clamp01(c.normal(0.5, 0.15)),
      },
    });
  });
}
