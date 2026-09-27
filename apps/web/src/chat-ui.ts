// Vista de chat del visor (spec 043 R-017): diálogo con inicio (modo y modo prueba), conversación en streaming,
// tono y postura de cada turno con sus motivos, marcas de coherencia y panel «Lo que sabe». Solo muestra lo que
// devuelve la API.
import { TONES, endChat, openChat, sendTurn, sourceLabel, stanceLabel, toneLabel, topProbabilities, verdictMark, verification } from './chat.ts';
import type { DoneMsg, OpenResult, StanceMsg } from './chat.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface ChatUiDeps {
  /** Persona seleccionada en el mapa. */
  citizen: () => { id: string; name: string } | null;
  /** Credenciales guardadas (base64) y petición de otras si hacen falta. */
  auth: () => string | null;
  askAuth: () => boolean;
}

export function setupChat(d: ChatUiDeps): void {
  const dialog = $<HTMLDialogElement>('#chat');
  let session: OpenResult | null = null;
  let busy = false;

  const status = (text: string) => ($('#chat-status').textContent = text);
  const reset = () => {
    session = null;
    $('#chat-start').hidden = false;
    $('#chat-main').hidden = true;
    $('#chat-msgs').innerHTML = '';
    $('#chat-why').innerHTML = '';
    $('#chat-knows').innerHTML = '';
    $('#chat-mode').textContent = '';
    $<HTMLButtonElement>('#chat-send').disabled = false; // la charla anterior pudo terminar con el botón desactivado
    status('');
  };

  $<HTMLSelectElement>('#chat-tone').innerHTML = `<option value="">Automático</option>${Object.entries(TONES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}`;

  $('#insp-chat').addEventListener('click', () => {
    const c = d.citizen();
    if (!c) return;
    reset();
    $('#chat-title').textContent = `Charla con ${c.name}`;
    dialog.showModal();
  });

  $<HTMLFormElement>('#chat-start').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const c = d.citizen();
    if (!c) return;
    const mode = ($<HTMLInputElement>('input[name="chat-mode"]:checked').value) as 'in_world' | 'sandbox';
    const test = $<HTMLInputElement>('#chat-test').checked;
    status('Abriendo la charla…');
    let r = await openChat(d.auth, c.id, mode, test);
    if (r.status === 401 && d.askAuth()) r = await openChat(d.auth, c.id, mode, test);
    // La API cierra sola la charla anterior; solo responde 409 si esa charla está a mitad de un turno.
    if (r.status === 409) return status('La charla anterior está terminando un turno. Espera unos segundos y vuelve a intentarlo.');
    if (r.status === 503) return status(r.error ?? 'No se pudo abrir la charla (¿está corriendo el worker?).');
    if (!r.body) return status(`No se pudo abrir la charla (${r.status}).`);
    if (r.body.status === 'declined') return status(`${c.name} no puede charlar ahora: ${r.body.reason ?? 'sin motivo'}.`);
    session = r.body;
    $('#chat-start').hidden = true;
    $('#chat-main').hidden = false;
    $('#chat-tone-l').hidden = !test;
    $('#chat-mode').textContent = mode === 'in_world' ? 'En el mundo · lo recordará · el mundo va en tiempo real' : 'Sandbox · no cambia el mundo';
    const v = session.view!;
    $('#chat-knows').innerHTML = [
      `<li><b>${esc(v.name)}</b>, ${v.age ?? '?'} años · nació en ${esc(v.birthplace ?? 'sin datos')} · ${esc(v.occupation)}</li>`,
      ...v.family.map((m) => `<li>${esc(m.relation)}: ${esc(m.name)}${m.alive ? '' : ' (murió)'}</li>`),
      ...v.facts.map((f) => `<li><span class="mono">${esc(f.date)}</span> ${esc(f.text)}</li>`),
    ].join('');
    status('');
    $<HTMLTextAreaElement>('#chat-text').focus();
  });

  $<HTMLFormElement>('#chat-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = $<HTMLTextAreaElement>('#chat-text').value.trim();
    if (!session?.id || !text || busy) return;
    busy = true;
    $<HTMLTextAreaElement>('#chat-text').value = '';
    const tag = $<HTMLSelectElement>('#chat-tone').value || undefined;
    const msgs = $('#chat-msgs');
    const mine = document.createElement('li');
    mine.className = 'msg visitor';
    mine.innerHTML = `<div class="meta">tú${tag ? ` · tono ${esc(toneLabel(tag))} (etiqueta)` : ''}</div><div class="bubble">${esc(text)}</div>`;
    const theirs = document.createElement('li');
    theirs.className = 'msg citizen';
    theirs.innerHTML = '<div class="meta">pensando…</div><div class="bubble"></div><div class="marks"></div>';
    msgs.append(mine, theirs);
    const bubble = theirs.querySelector('.bubble')!;
    const meta = theirs.querySelector('.meta')!;
    const code = await sendTurn(d.auth, session.id, text, tag, (event, data) => {
      if (event === 'stance') {
        const s = data as StanceMsg;
        const detected = s.tone.toneLlm && s.tone.toneLlm !== s.tone.tone ? ` · el clasificador dijo ${toneLabel(s.tone.toneLlm)}` : '';
        mine.querySelector('.meta')!.textContent = `tú · tono ${toneLabel(s.tone.tone)}${s.tone.toneTag ? ' (etiqueta)' : ''}${detected}`;
        meta.textContent = `postura: ${stanceLabel(s.stance)}${s.forced ? ' (tiene que irse)' : ''}`;
        $('#chat-why').innerHTML = `<p>${esc(stanceLabel(s.stance))}</p><ul>${s.sources.map((x) => `<li>${esc(sourceLabel(x))} <span class="mono">${x.contribution.toFixed(2)}</span></li>`).join('')}</ul><p class="muted">Probabilidades: ${esc(topProbabilities(s.probabilities))}</p>`;
      } else if (event === 'token') bubble.textContent += (data as { text: string }).text;
      else if (event === 'done') {
        const dn = data as DoneMsg;
        meta.textContent += ` · ${dn.expression === 'template' ? 'plantilla (sin LLM)' : `${(dn.latencyMs.total / 1000).toFixed(1)} s`}`;
        const seq = dn.seq;
        const poll = async (left: number) => {
          const v = session?.id ? await verification(d.auth, session.id, seq) : null;
          if (v) theirs.querySelector('.marks')!.textContent = [...v.claims.map((c) => `${verdictMark(c.verdict)} ${c.predicate} ${c.value}`), v.stanceCheck === 'mismatch' ? '⚠ no expresa la postura' : ''].filter(Boolean).join(' · ');
          else if (left > 0) setTimeout(() => void poll(left - 1), 1500);
        };
        void poll(4);
        if (dn.ended) {
          status('La charla terminó.');
          $<HTMLButtonElement>('#chat-send').disabled = true;
        }
      } else if (event === 'error') status(`Error: ${(data as { error: string }).error}`);
      msgs.scrollTop = msgs.scrollHeight;
    });
    if (code === 409) status('La charla ya terminó.');
    busy = false;
  });

  const finish = async () => {
    const id = session?.id;
    session = null;
    if (id) await endChat(d.auth, id);
  };
  $('#chat-end').addEventListener('click', async () => {
    await finish();
    status('Te despediste. La charla terminó.');
    $<HTMLButtonElement>('#chat-send').disabled = true;
  });
  $('#chat-close').addEventListener('click', () => dialog.close());
  // Cerrar el diálogo por cualquier vía (✕, Esc) o salir de la página es despedirse: si no, la charla seguía
  // abierta en la API y no dejaba abrir otra.
  dialog.addEventListener('close', () => void finish());
  window.addEventListener('pagehide', () => void finish());
}
