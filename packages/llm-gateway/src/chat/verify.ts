// Verificación de la respuesta (spec 043 R-012, R-013): afirmaciones sobre su vida marcadas contra la vista y
// adherencia a la postura. Corre después de mostrar la respuesta, sin bloquear el turno siguiente.
import { z } from 'zod';
import type { Gateway } from '../gateway.ts';
import type { StanceInfo } from './catalog.ts';
import type { PersonView } from './view.ts';

export type Verdict = 'supported' | 'contradicted' | 'unsupported';

export interface Claim {
  about: string;
  predicate: string;
  value: string;
  verdict: Verdict;
  evidence?: string;
}

export interface Verification {
  claims: Claim[];
  stanceCheck: 'ok' | 'mismatch' | 'unchecked';
  llmRef?: string;
}

const schema = z.object({
  claims: z.array(z.object({
    about: z.string(),
    predicate: z.string(),
    value: z.string(),
    verdict: z.enum(['supported', 'contradicted', 'unsupported']),
    evidence: z.string().nullable(),
  })),
  stance: z.enum(['ok', 'mismatch']),
});

function verifierPrompt(pv: PersonView, stance: StanceInfo): string {
  return [
    `Revisas la respuesta de ${pv.name} en un chat. Tienes dos tareas.`,
    '1. Extrae cada afirmación de hecho sobre su vida o sobre el mundo (no las opiniones ni los sentimientos) y compárala con estos hechos:',
    ...pv.facts.map((f) => `[${f.id}] ${f.date}: ${f.text}`),
    `Datos generales: nació en ${pv.birthplace ?? 'sin datos'}; ocupación: ${pv.occupation}; familia: ${pv.family.map((m) => `${m.relation} ${m.name}`).join(', ') || 'sin datos'}.`,
    'Marca cada afirmación como "supported" (un hecho la respalda), "contradicted" (un hecho dice otra cosa) o "unsupported" (no hay nada). En "evidence" pon el id del hecho entre corchetes que la respalda o contradice, o null.',
    `2. La postura pedida era «${stance.label}»: ${stance.guidance} Responde "mismatch" si el texto no la expresa (por ejemplo, si da la razón o se disculpa cuando debía poner un límite); si no, "ok".`,
    'Responde solo con JSON: {"claims": [...], "stance": "ok" | "mismatch"}.',
  ].join('\n');
}

export async function verifyReply(gw: Gateway, pv: PersonView, stance: StanceInfo, reply: string): Promise<Verification> {
  const r = await gw.run({ purpose: 'verify', citizenId: pv.citizenId, system: [{ text: verifierPrompt(pv, stance), cacheable: true }], messages: [{ role: 'user', text: reply }], schema });
  if (r.source === 'fallback' || !r.data) return { claims: [], stanceCheck: 'unchecked' };
  const ids = new Set(pv.facts.map((f) => f.id));
  const claims = r.data.claims.map((c) => {
    const ev = c.evidence?.replace(/[[\]]/g, '');
    return { about: c.about, predicate: c.predicate, value: c.value, verdict: c.verdict, ...(ev && ids.has(ev) ? { evidence: ev } : {}) };
  });
  return { claims, stanceCheck: r.data.stance, llmRef: r.recordKey };
}
