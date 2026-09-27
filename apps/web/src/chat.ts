// Charla con ciudadanos en el visor (spec 043 R-017): cliente de `/api/chat/*` y formato. La web no decide
// nada: muestra el tono, la postura y sus motivos, el texto en streaming y las marcas de coherencia que da la API.

export interface ChatView {
  citizenId: string;
  name: string;
  age: number | null;
  birthplace: string | null;
  occupation: string;
  family: { relation: string; name: string; age: number | null; alive: boolean }[];
  facts: { id: string; date: string; age: number | null; text: string }[];
}

export interface OpenResult {
  id: string | null;
  status: 'open' | 'declined';
  mode?: 'in_world' | 'sandbox';
  reason?: string;
  availableUntil?: number;
  view?: ChatView;
}

export interface Source {
  source: string;
  contribution: number;
  ref?: string;
}

export interface StanceMsg {
  tone: { tone: string; toneTag?: string; toneLlm?: string };
  stance: string;
  sources: Source[];
  probabilities: { stance: string; p: number }[];
  forced: boolean;
}

export interface DoneMsg {
  seq: number;
  reply: string;
  expression: 'llm' | 'template';
  latencyMs: { firstToken?: number; total: number };
  ended: boolean;
}

export interface Claim {
  about: string;
  predicate: string;
  value: string;
  verdict: 'supported' | 'contradicted' | 'unsupported';
}

export const TONES: Record<string, string> = {
  amable: 'amable', neutro: 'neutro', curioso: 'curioso', intimo: 'íntimo', desagradable: 'desagradable', grosero: 'grosero',
  hostil: 'hostil', victimizante: 'victimizante', culpabilizador: 'culpabilizador', presion: 'presión', invasivo: 'invasivo', burla: 'burla',
};

export const STANCES: Record<string, string> = {
  abrirse: 'abrirse', aplacar: 'aplacar', callar: 'callar', contraatacar: 'contraatacar', evadir: 'evadir',
  poner_limite: 'poner un límite', responder_breve: 'responder breve', terminar: 'terminar',
};

const SOURCES: Record<string, string> = {
  fuerza: 'su forma habitual de responder',
  reforzador: 'cómo le llega lo que le dicen',
  negativo: 'quitarse el malestar de la charla',
  motivadora: 'cansancio o estrés',
  regla: 'una regla aprendida',
  valor: 'algo que le importa',
  aversion: 'algo que le disgusta',
};

export const stanceLabel = (k: string) => STANCES[k] ?? k;
export const toneLabel = (k: string) => TONES[k] ?? k;
export const sourceLabel = (s: Source) => SOURCES[s.source] ?? s.source;
export const verdictMark = (v: Claim['verdict']) => (v === 'supported' ? '✓' : v === 'contradicted' ? '✗ contradice' : '? inventado');

/** Las 3 posturas más probables, en texto: «poner un límite 46 %, evadir 21 %…». */
export const topProbabilities = (ps: { stance: string; p: number }[], n = 3) =>
  [...ps].sort((a, b) => b.p - a.p).slice(0, n).map((x) => `${stanceLabel(x.stance)} ${Math.round(x.p * 100)} %`).join(', ');

/** Parte los mensajes SSE completos de un búfer; devuelve lo que falta por llegar. */
export function parseSse(buffer: string): { messages: { event: string; data: unknown }[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const messages = parts.filter((p) => p.trim()).map((p) => {
    const event = /^event: (.*)$/m.exec(p)?.[1] ?? 'message';
    const data = /^data: (.*)$/m.exec(p)?.[1];
    return { event, data: data ? (JSON.parse(data) as unknown) : null };
  });
  return { messages, rest };
}

type Auth = () => string | null;
const headers = (auth: Auth) => ({ 'content-type': 'application/json', ...(auth() ? { authorization: `Basic ${auth()}` } : {}) });

export async function openChat(auth: Auth, citizenId: string, mode: 'in_world' | 'sandbox', testMode: boolean): Promise<{ status: number; body?: OpenResult; error?: string }> {
  const r = await fetch('/api/chat/sessions', { method: 'POST', headers: headers(auth), body: JSON.stringify({ citizenId, mode, testMode }) });
  const j = (await r.json().catch(() => ({}))) as OpenResult & { error?: string };
  return r.ok ? { status: r.status, body: j } : { status: r.status, ...(j.error ? { error: j.error } : {}) };
}

/** Un turno: llama a `on` con cada mensaje (`stance`, `token`, `done`, `error`) según llega. */
export async function sendTurn(auth: Auth, id: string, text: string, toneTag: string | undefined, on: (event: string, data: unknown) => void): Promise<number> {
  const r = await fetch(`/api/chat/sessions/${id}/turns`, { method: 'POST', headers: headers(auth), body: JSON.stringify(toneTag ? { text, toneTag } : { text }) });
  if (!r.ok || !r.body) return r.status;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const { messages, rest } = parseSse(buf);
    buf = rest;
    for (const m of messages) on(m.event, m.data);
  }
  return r.status;
}

export async function endChat(auth: Auth, id: string): Promise<number> {
  return (await fetch(`/api/chat/sessions/${id}/end`, { method: 'POST', headers: headers(auth) })).status;
}

/** Afirmaciones y chequeo de la postura de un turno del ciudadano, cuando la verificación ya llegó. */
export async function verification(auth: Auth, id: string, seq: number): Promise<{ claims: Claim[]; stanceCheck: string } | null> {
  const r = await fetch(`/api/chat/sessions/${id}`, { headers: headers(auth) });
  if (!r.ok) return null;
  const j = (await r.json()) as { turns: { seq: number; speaker: string; data: { claims?: Claim[]; stanceCheck?: string } }[] };
  const t = j.turns.find((x) => x.seq === seq && x.speaker === 'citizen');
  if (!t || !t.data.stanceCheck || t.data.stanceCheck === 'pending') return null;
  return { claims: t.data.claims ?? [], stanceCheck: t.data.stanceCheck };
}
