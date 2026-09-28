// Tono del turno del visitante (spec 043 R-004): la etiqueta del modo prueba, si no el clasificador LLM con
// salida validada y tiempo máximo, y si no (o con `mock`) las reglas léxicas del catálogo. En la misma llamada,
// las afirmaciones del visitante sobre terceros cercanos (spec 044 R-001), con su respaldo léxico.
import { z } from 'zod';
import type { Gateway } from '../gateway.ts';
import type { ClaimInfo, RelationInfo, ToneInfo } from './catalog.ts';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reglas léxicas: gana el tono con más palabras clave; en empate, el de mayor intensidad; sin coincidencias, neutro o curioso. */
export function lexicalTone(tones: readonly ToneInfo[], text: string): string {
  const t = fold(text);
  let best: { key: string; hits: number; magnitude: number } | undefined;
  for (const tone of tones) {
    const hits = tone.keywords.filter((k) => t.includes(fold(k))).length;
    if (hits === 0) continue;
    if (!best || hits > best.hits || (hits === best.hits && tone.magnitude > best.magnitude)) best = { key: tone.key, hits, magnitude: tone.magnitude };
  }
  if (best) return best.key;
  return t.includes('?') ? 'curioso' : 'neutro';
}

/** Afirmación detectada: `predicate` de `chat_claims`, `about` de `chat_relations` (el motor la resuelve a una persona). */
export interface VisitorClaim {
  predicate: string;
  about: string;
}

/** Posición de la primera aparición de la palabra completa (no dentro de otra: «padre» no está en «compadre»). */
function wordAt(folded: string, keyword: string): number {
  const k = fold(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^a-z0-9ñ])${k}(?=$|[^a-z0-9ñ])`).exec(folded);
  return m ? m.index + m[1]!.length : -1;
}

/**
 * Respaldo léxico de las afirmaciones (044 R-001): una afirmación cuenta si aparece alguna de sus palabras clave y
 * se sabe de quién habla: la relación permitida nombrada primero en el mensaje o, si solo admite una, esa.
 */
export function lexicalClaims(claims: readonly ClaimInfo[], relations: readonly RelationInfo[], text: string): VisitorClaim[] {
  const t = fold(text);
  const out: VisitorClaim[] = [];
  for (const c of claims) {
    if (!c.keywords.some((k) => t.includes(fold(k)))) continue;
    let about: { key: string; at: number } | undefined;
    for (const r of relations.filter((x) => c.about.includes(x.key))) {
      for (const k of r.keywords) {
        const at = wordAt(t, k);
        if (at >= 0 && (!about || at < about.at)) about = { key: r.key, at };
      }
    }
    const rel = about?.key ?? (c.about.length === 1 ? c.about[0] : undefined);
    if (rel) out.push({ predicate: c.key, about: rel });
  }
  return out;
}

function classifierPrompt(tones: readonly ToneInfo[], claims: readonly ClaimInfo[], relations: readonly RelationInfo[]): string {
  const lines = [
    'Clasifica el tono del mensaje que un visitante le escribe a una persona en un chat. Elige exactamente uno de estos tonos:',
    ...tones.map((t) => `- ${t.key}: ${t.description} Ejemplos: ${t.examples.map((x) => `«${x}»`).join(' ')}`),
  ];
  if (claims.length === 0) return [...lines, 'Responde solo con JSON: {"tone": "<clave>"}.'].join('\n');
  return [
    ...lines,
    '',
    'Además, si el mensaje le afirma a la persona algo sobre alguien cercano a ella (su pareja, su familia, su jefe o sus compañeros), anota cada afirmación. Solo estas:',
    ...claims.map((c) => `- ${c.key}: ${c.description} Puede ser sobre: ${c.about.join(', ')}. Ejemplos: ${c.examples.map((x) => `«${x}»`).join(' ')}`),
    `Relaciones posibles: ${relations.map((r) => `${r.key} (${r.label.toLowerCase()})`).join(', ')}.`,
    'Si no hay ninguna, deja la lista vacía. No anotes lo que el visitante dice de sí mismo ni preguntas.',
    'Responde solo con JSON: {"tone": "<clave>", "claims": [{"predicate": "<clave>", "about": "<relación>"}]}.',
  ].join('\n');
}

export interface ToneResult {
  /** El que se usa. */
  tone: string;
  toneTag?: string;
  toneLlm?: string;
  toneLexical: string;
  llmRef?: string;
  /** Afirmaciones sobre terceros que se usan (del LLM si respondió; si no, las léxicas). Vacío sin catálogo. */
  visitorClaims: VisitorClaim[];
  visitorClaimsLexical: VisitorClaim[];
}

export interface ClassifyCatalogs {
  tones: readonly ToneInfo[];
  claims?: readonly ClaimInfo[];
  relations?: readonly RelationInfo[];
}

export async function classifyTone(gw: Gateway, cats: ClassifyCatalogs, text: string, toneTag?: string): Promise<ToneResult> {
  const { tones, claims = [], relations = [] } = cats;
  const toneLexical = lexicalTone(tones, text);
  const visitorClaimsLexical = lexicalClaims(claims, relations, text);
  const keys = tones.map((t) => t.key) as [string, ...string[]];
  const claimSchema = claims.length > 0 && relations.length > 0
    ? z.array(z.object({
      predicate: z.enum(claims.map((c) => c.key) as [string, ...string[]]),
      about: z.enum(relations.map((r) => r.key) as [string, ...string[]]),
    })).max(3).optional()
    : undefined;
  const r = await gw.run({
    purpose: 'classify',
    system: [{ text: classifierPrompt(tones, claimSchema ? claims : [], relations), cacheable: true }],
    messages: [{ role: 'user', text }],
    schema: claimSchema ? z.object({ tone: z.enum(keys), claims: claimSchema }) : z.object({ tone: z.enum(keys) }),
  });
  const ok = r.source !== 'fallback' && r.data !== undefined;
  const toneLlm = ok ? r.data!.tone : undefined;
  const tone = toneTag ?? toneLlm ?? toneLexical;
  // Una relación que la afirmación no admite se descarta (p. ej. «infiel» sobre el jefe).
  const llmClaims = ok && claimSchema
    ? ((r.data as { claims?: VisitorClaim[] }).claims ?? []).filter((c) => claims.find((x) => x.key === c.predicate)?.about.includes(c.about))
    : undefined;
  const visitorClaims = dedupe(llmClaims ?? visitorClaimsLexical);
  return {
    tone, ...(toneTag ? { toneTag } : {}), ...(toneLlm ? { toneLlm } : {}), toneLexical,
    ...(r.recordKey && r.source !== 'fallback' ? { llmRef: r.recordKey } : {}),
    visitorClaims, visitorClaimsLexical,
  };
}

function dedupe(cs: readonly VisitorClaim[]): VisitorClaim[] {
  const seen = new Set<string>();
  return cs.filter((c) => {
    const k = `${c.predicate}/${c.about}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
