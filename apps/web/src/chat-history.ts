// Pestaña «Charlas» de la ficha (spec 043 R-017, decisión del usuario 2026-09-27): las charlas guardadas de la
// persona para revisarlas después, con cada turno, su tono y la postura con que respondió. Solo lee `/api/chat/*`.
import { stanceLabel, toneLabel } from './chat.ts';
import { skeleton } from './loading.ts';

export interface ChatRow {
  id: string;
  mode: 'in_world' | 'sandbox';
  status: 'open' | 'ended';
  endReason?: string;
  createdAt: string;
}

export interface ChatTurn {
  seq: number;
  speaker: 'visitor' | 'citizen';
  text: string;
  data: { tone?: string; stance?: string; forced?: boolean; expression?: string };
}

const REASONS: Record<string, string> = {
  visitor: 'te despediste',
  citizen: 'se fue',
  obligation: 'tenía un compromiso',
  idle: 'sin mensajes',
  interrupted: 'interrumpida (la API se cerró)',
  replaced: 'la cerraste al abrir otra',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
type Auth = () => string | null;
const headers = (auth: Auth): Record<string, string> => (auth() ? { authorization: `Basic ${auth()}` } : {});

export const reasonLabel = (r?: string) => (r ? (REASONS[r] ?? r) : 'abierta');

/** Lista de charlas, la más reciente primero; cada una se despliega y carga su transcripción. */
export function renderChatList(rows: readonly ChatRow[]): string {
  if (rows.length === 0) return '<p>Todavía no ha charlado con nadie de fuera.</p>';
  return `<ul class="chats">${[...rows].reverse().map((r) => `<li><details data-chat="${esc(r.id)}"><summary><span class="mono">${esc(r.createdAt.slice(0, 16).replace('T', ' '))}</span> · ${r.mode === 'in_world' ? 'en el mundo' : 'sandbox'} · ${esc(r.status === 'open' ? 'abierta' : reasonLabel(r.endReason))}</summary><div class="transcript">Cargando…</div></details></li>`).join('')}</ul>`;
}

/** Transcripción de una charla: el visitante con su tono y el ciudadano con su postura. */
export function renderTranscript(turns: readonly ChatTurn[]): string {
  if (turns.length === 0) return '<p class="muted">Sin mensajes.</p>';
  return `<ol class="chat-msgs">${turns.map((t) => {
    const meta = t.speaker === 'visitor'
      ? `tú${t.data.tone ? ` · tono ${esc(toneLabel(t.data.tone))}` : ''}`
      : `postura: ${esc(stanceLabel(t.data.stance ?? '?'))}${t.data.forced ? ' (tiene que irse)' : ''}${t.data.expression === 'template' ? ' · plantilla' : ''}`;
    return `<li class="msg ${t.speaker}"><div class="meta">${meta}</div><div class="bubble">${esc(t.text)}</div></li>`;
  }).join('')}</ol>`;
}

export async function fetchChats(auth: Auth, citizenId: string): Promise<{ status: number; rows: ChatRow[] }> {
  const r = await fetch(`/api/chat/sessions?citizenId=${encodeURIComponent(citizenId)}`, { headers: headers(auth) });
  return { status: r.status, rows: r.ok ? ((await r.json()) as ChatRow[]) : [] };
}

export async function fetchTurns(auth: Auth, id: string): Promise<ChatTurn[] | null> {
  const r = await fetch(`/api/chat/sessions/${encodeURIComponent(id)}`, { headers: headers(auth) });
  return r.ok ? ((await r.json()) as { turns: ChatTurn[] }).turns : null;
}

/** Rellena la pestaña: pide credenciales si hacen falta y carga cada transcripción al desplegarla. */
export async function showChatHistory(el: HTMLElement, citizenId: string, auth: Auth, askAuth: () => Promise<boolean>): Promise<void> {
  el.innerHTML = skeleton('las charlas', 3);
  let r = await fetchChats(auth, citizenId);
  if (r.status === 401 && (await askAuth())) r = await fetchChats(auth, citizenId);
  if (r.status === 401) return void (el.innerHTML = '<p>Las charlas necesitan usuario y contraseña.</p>');
  if (r.status === 503) return void (el.innerHTML = '<p>La charla está desactivada (define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD).</p>');
  el.innerHTML = renderChatList(r.rows);
  for (const d of el.querySelectorAll<HTMLDetailsElement>('details[data-chat]'))
    d.addEventListener('toggle', async () => {
      if (!d.open || d.dataset.loaded) return;
      const turns = await fetchTurns(auth, d.dataset.chat!);
      d.dataset.loaded = '1';
      d.querySelector('.transcript')!.innerHTML = turns ? renderTranscript(turns) : '<p>No se pudo cargar.</p>';
    });
}
