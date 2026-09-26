// Qué enseña cada evento del mundo (spec 036 R-001, R-011; bloque MF2.5) [M]: los estímulos presentes, la
// consecuencia con signo y el estímulo que hace de consecuencia. Es la versión mínima: el registro de contingencias
// completo (conducta emitida → consecuencia, R-011) llega con la selección de conducta (040, MF3).
import type { EventType, WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import type { WorldView } from '../simulation/system.ts';

/** Términos verbales y estados del cuerpo que usan las reglas; la ontología del mundo (generadores) los incluye. */
export const WORLD_STIMULI = Object.freeze([
  'verbal.trabajo', 'verbal.dinero', 'verbal.deuda', 'verbal.gota_a_gota', 'verbal.vivienda', 'verbal.critica',
  'verbal.aprobacion', 'verbal.amenaza', 'rol.jefe', 'cuerpo.enfermedad', 'cuerpo.dolor', 'cuerpo.disfrute',
] as const);

export interface LearningRule {
  /** Estímulo principal: el que usa la elicitación de las emociones (`elicit.ts`). */
  main: string;
  /** Estímulos presentes en el evento (el principal primero). */
  stims: (e: WorldEvent, view: WorldView) => string[];
  lambda: number | ((e: WorldEvent) => number);
  us: string;
  social?: boolean;
}

const placeKind = (view: WorldView, id: unknown) => (typeof id === 'string' ? view.places.get(id as EntityId)?.kind : undefined);
const payload = <T>(e: WorldEvent) => e.payload as T;

/** 036 R-001 [M]: las consecuencias del mundo como ensayos de aprendizaje, con magnitudes estimadas (PA-002). */
export const EVENT_LEARNING: Readonly<Partial<Record<EventType, LearningRule>>> = Object.freeze({
  LEISURE_DONE: {
    main: 'cuerpo.disfrute',
    stims: (e, v) => {
      const p = payload<{ activity: string; placeId: string }>(e);
      const kind = placeKind(v, p.placeId);
      return [`actividad.${p.activity}`, ...(kind ? [`lugar.${kind}`] : [])];
    },
    lambda: 0.4,
    us: 'cuerpo.disfrute',
  },
  JOB_HIRED: {
    main: 'verbal.trabajo',
    stims: (e, v) => {
      const org = v.organizations.get(payload<{ orgId: string }>(e).orgId as EntityId);
      const kind = placeKind(v, org?.placeIds[0]);
      return ['verbal.trabajo', ...(kind ? [`lugar.${kind}`] : [])];
    },
    lambda: 0.5,
    us: 'verbal.dinero',
  },
  SALARY_PAID: { main: 'verbal.trabajo', stims: () => ['verbal.trabajo'], lambda: 0.3, us: 'verbal.dinero' },
  JOB_WARNING: { main: 'rol.jefe', stims: () => ['rol.jefe', 'verbal.trabajo'], lambda: -0.4, us: 'verbal.critica', social: true },
  JOB_LOST: { main: 'verbal.trabajo', stims: () => ['verbal.trabajo', 'rol.jefe'], lambda: -0.8, us: 'verbal.critica' },
  FELL_ILL: { main: 'cuerpo.enfermedad', stims: () => ['cuerpo.enfermedad'], lambda: -0.5, us: 'cuerpo.dolor' },
  DEBT_TAKEN: {
    main: 'verbal.deuda',
    stims: (e) => (payload<{ creditor: string }>(e).creditor === 'gota_a_gota' ? ['verbal.deuda', 'verbal.gota_a_gota'] : ['verbal.deuda']),
    lambda: (e) => (payload<{ creditor: string }>(e).creditor === 'gota_a_gota' ? -0.5 : -0.2),
    us: 'verbal.amenaza',
  },
  PAYMENT_MISSED: { main: 'verbal.deuda', stims: () => ['verbal.deuda'], lambda: -0.4, us: 'verbal.amenaza' },
  RENT_LATE: { main: 'verbal.vivienda', stims: () => ['verbal.vivienda', 'verbal.deuda'], lambda: -0.4, us: 'verbal.amenaza' },
  DEBT_REPAID: { main: 'verbal.deuda', stims: () => ['verbal.deuda'], lambda: 0.3, us: 'verbal.dinero' },
} satisfies Partial<Record<EventType, LearningRule>>);
