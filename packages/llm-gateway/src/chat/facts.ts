// Redacción de los hechos de la vista (spec 043 §3): cada evento en una frase en español, con nombres en vez de ids.
// Solo describe lo que ya está en el evento; no añade datos del mundo.
import { eventText } from '@datas-world/engine';
import type { WorldEvent, WorldView } from '@datas-world/engine';
import type { FamilyMember } from './view.ts';

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function name(view: WorldView, id: string): string {
  const c = view.citizens.get(id as never);
  return c?.name ? `${c.name.given} ${c.name.family[0]}` : id;
}

export function renderFact(view: WorldView, me: string, e: WorldEvent, family: readonly FamilyMember[]): string {
  const p = e.payload as Record<string, unknown>;
  const who = typeof p.citizenId === 'string' ? p.citizenId : undefined;
  const self = who === me;
  const kin = family.find((m) => m.id === who);
  switch (e.type) {
    case 'CITIZEN_BORN':
      if (self) return `Nació en ${String(p.placeName)}.`;
      return `Nació ${kin ? `su ${kin.relation} ` : ''}${name(view, String(who))}, en ${String(p.placeName)}.`;
    case 'CITIZEN_DIED':
      return `Murió ${kin ? `su ${kin.relation} ` : ''}${name(view, String(who))}, a los ${String(p.age)} años.`;
    case 'MIGRATED':
      return `Se fue de ${String(p.from)} a vivir en ${String(p.to)}.`;
    case 'STUDIES_COMPLETED':
      return `Terminó estudios de nivel ${String(p.levelName).toLowerCase()}.`;
    case 'CHILDHOOD_EVENT':
      return `De niño: ${String(p.text)}.`;
    case 'HOUSEHOLD_FORMED': {
      const others = (p.members as string[]).filter((m) => m !== me).map((m) => name(view, m));
      return others.length > 0 ? `Formó su hogar con ${others.join(', ')}.` : 'Formó su propio hogar.';
    }
    case 'JOB_LOST':
      return `Perdió su empleo (${String(p.reason)}).`;
    case 'JOB_HIRED':
      return `Empezó a trabajar en ${String(p.orgName)}.`;
    case 'OBJECT_ACQUIRED':
      return String(p.ownerId) === me ? `Compró ${String(p.name)} por ${money(Number(p.price))}.` : `En su hogar compraron ${String(p.name)} por ${money(Number(p.price))}.`;
    case 'HEALTH_INSURANCE_SET':
      return `Quedó afiliado a salud en el régimen ${String(p.regime)}.`;
    case 'LEISURE_TAKEN_UP':
      return `Le empezó a gustar: ${String(p.name).toLowerCase()}.`;
    case 'CONDITION_DIAGNOSED':
      return `Le diagnosticaron ${String(p.name).toLowerCase()}.`;
    case 'OVERSLEPT':
      return `Se quedó dormido ${String(p.minutes)} minutos.`;
    case 'CONVERSATION_HELD':
      return `Charló con ${String(p.visitorId)}: ${String(p.summary)}`;
    default: {
      // Texto genérico del catálogo con los ids de personas cambiados por nombres.
      return eventText(e).replace(/CIT-\d+/g, (id) => (id === me ? 'él o ella' : name(view, id)));
    }
  }
}
