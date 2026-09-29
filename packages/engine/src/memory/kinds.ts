// Qué deja cada tipo de evento en la memoria (spec 013 R-001, R-002, R-010) [M]: quién lo recuerda, qué estímulos
// quedan en el episodio, la consecuencia con signo (λ) y, si lo hay, el capítulo que abre. La saliencia final la dan
// las funciones de cada persona (encode.ts); esta tabla solo describe el hecho.
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import type { DeepReadonly, WorldView } from '../simulation/system.ts';

type Ev = DeepReadonly<WorldEvent>;

export interface MemoryKind {
  lambda: number | ((e: Ev) => number);
  /** Consecuencia recibida (estímulo), para la consolidación en la red. */
  us?: string;
  /** Estímulos del hecho (sin las personas, que se añaden solas). */
  stims?: (e: Ev, view: WorldView) => string[];
  /** Quién lo recuerda; por defecto, las personas que participan. */
  who?: (e: Ev, view: WorldView) => EntityId[];
  /** Solo lo recuerda `a` (p. ej. quien considera amiga a otra persona). */
  onlyA?: true;
  /** Tema del capítulo que puede abrir (R-010). */
  theme?: string;
  /** Edad mínima para que el hecho abra su capítulo (terminar la primaria no abre la vida adulta). */
  themeMinAge?: number;
}

const P = <T>(e: Ev) => e.payload as T;
const placeKind = (view: WorldView, id: unknown) => (typeof id === 'string' ? view.places.get(id as EntityId)?.kind : undefined);
const at = (view: WorldView, e: Ev) => {
  const k = placeKind(view, e.placeId);
  return k ? [`lugar.${k}`] : [];
};

export const MEMORY_KINDS: Readonly<Record<string, MemoryKind>> = Object.freeze({
  // Trabajo y dinero (006, 015).
  JOB_HIRED: { lambda: 0.6, us: 'verbal.aprobacion', stims: () => ['verbal.trabajo', 'dominio.trabajo'], theme: 'trabajo' },
  INFORMAL_WORK_STARTED: { lambda: 0.3, us: 'verbal.dinero', stims: () => ['verbal.trabajo', 'dominio.trabajo'] },
  JOB_WARNING: { lambda: -0.4, us: 'verbal.critica', stims: () => ['rol.jefe', 'verbal.trabajo'] },
  JOB_LOST: { lambda: -0.8, us: 'verbal.critica', stims: () => ['verbal.despido', 'verbal.trabajo', 'dominio.trabajo'], theme: 'desempleo' },
  RETIRED: { lambda: 0.2, stims: () => ['verbal.trabajo'], theme: 'jubilacion' },
  ARRIVED_LATE: { lambda: -0.2, us: 'verbal.critica', stims: () => ['verbal.llegar_tarde'] },
  DEBT_TAKEN: { lambda: (e) => (P<{ creditor: string }>(e).creditor === 'gota_a_gota' ? -0.5 : -0.2), us: 'verbal.amenaza', stims: () => ['verbal.deuda'] },
  PAYMENT_MISSED: { lambda: -0.4, us: 'verbal.amenaza', stims: () => ['verbal.deuda'] },
  RENT_LATE: { lambda: -0.4, us: 'verbal.amenaza', stims: () => ['verbal.vivienda', 'verbal.deuda'] },
  DEBT_REPAID: { lambda: 0.3, us: 'verbal.dinero', stims: () => ['verbal.deuda'] },
  // Salud y ocio (010, 031, 032).
  FELL_ILL: { lambda: -0.4, us: 'cuerpo.dolor', stims: () => ['cuerpo.enfermedad'] },
  CONDITION_DIAGNOSED: { lambda: -0.6, us: 'cuerpo.dolor', stims: () => ['cuerpo.enfermedad'] },
  STRESS_PEAK: { lambda: -0.4 },
  LEISURE_DONE: { lambda: 0.2, us: 'cuerpo.disfrute', stims: (e, v) => [`actividad.${P<{ activity: string }>(e).activity}`, ...at(v, e)] },
  LEISURE_TAKEN_UP: { lambda: 0.3, us: 'cuerpo.disfrute', stims: (e) => [`actividad.${P<{ activity: string }>(e).activity}`] },
  // Objetos (005).
  OBJECT_LOST: { lambda: -0.3 },
  OBJECT_GIFTED: { lambda: 0.3, us: 'verbal.aprobacion' },
  OBJECT_INHERITED: { lambda: 0.2 },
  // Relaciones (012) y consecuencias de la charla (044): la otra persona entra sola por `a`/`b`.
  MET: { lambda: 0.1, stims: (e, v) => at(v, e) },
  ENCOUNTER: { lambda: -0.25, us: 'verbal.critica', stims: (e, v) => at(v, e) },
  ARGUMENT: { lambda: -0.5, us: 'verbal.critica', stims: (e, v) => at(v, e) },
  FRIENDSHIP_FORMED: { lambda: 0.5, us: 'verbal.aprobacion', onlyA: true },
  RELATIONSHIP_STARTED: { lambda: 0.8, us: 'verbal.aprobacion', theme: 'pareja' },
  BREAKUP: { lambda: -0.8, us: 'verbal.critica', theme: 'ruptura' },
  CONFRONTATION: { lambda: -0.6, us: 'verbal.critica' },
  // Historia (030): la usan la generación y, cuando existan en la vida diaria, los hechos del ciclo de vida.
  STUDIES_COMPLETED: { lambda: 0.5, us: 'verbal.aprobacion', stims: () => ['dominio.conocimiento'], theme: 'vida_adulta', themeMinAge: 16 },
  MIGRATED: { lambda: -0.3, theme: 'migracion' },
  UNION_FORMED: { lambda: 0.7, us: 'verbal.aprobacion', theme: 'pareja' },
  CITIZEN_BORN: { lambda: 0.8, theme: 'crianza', who: (e) => e.participants.filter((p) => p.role !== 'nacido').map((p) => p.id) },
  CITIZEN_DIED: {
    lambda: -0.9,
    theme: 'duelo',
    // Lo recuerda la familia (sus vínculos `familia`, 012), no el fallecido.
    who: (e, v) => {
      const dead = P<{ citizenId: string }>(e).citizenId;
      const out: EntityId[] = [];
      for (const c of v.citizens.values()) if (c.bonds?.some((b) => b.with === dead && b.labels?.includes('familia'))) out.push(c.id);
      return out.sort();
    },
  },
});

/** El capítulo que abre un hecho para alguien nacido en `birth` (R-010), si lo abre a esa edad. */
export function themeOf(e: Ev, birth: number): string | undefined {
  const k = MEMORY_KINDS[e.type];
  if (!k?.theme) return undefined;
  return k.themeMinAge !== undefined && e.at - birth < k.themeMinAge * 365.25 * 1440 ? undefined : k.theme;
}

/** Las personas presentes en un hecho para quien lo recuerda: la otra del par (`a`/`b`), el fallecido o el nacido. */
export function peopleOf(e: Ev, me: EntityId): string[] {
  const p = e.payload as { a?: string; b?: string; citizenId?: string };
  if (p.a && p.b) return [p.a === me ? p.b : p.a];
  if ((e.type === 'CITIZEN_DIED' || e.type === 'CITIZEN_BORN') && p.citizenId && p.citizenId !== me) return [p.citizenId];
  return [];
}
