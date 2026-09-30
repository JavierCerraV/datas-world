// Charla con una persona (spec 043 R-017, ampliada en la 024 R-018): panel junto al mapa (el mundo sigue a la
// vista), con su figura, su ánimo y su estrés; mensajes en burbujas con «escribiendo…»; en cada respuesta, por qué
// respondió así; y al despedirse, un resumen de lo que cambió. Solo muestra lo que devuelve la API.
import { drawFigure } from './figures.ts';
import { TONES, claimLine, endChat, openChat, sendTurn, sourceLabel, stanceLabel, toneLabel, topProbabilities, verdictMark, verification } from './chat.ts';
import type { DoneMsg, OpenResult, StanceMsg } from './chat.ts';
import type { CitizenDetail } from './types.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (x: number) => Math.round(x * 100);

export interface ChatUiDeps {
  auth: () => string | null;
  askAuth: () => Promise<boolean>;
  /** La ficha de la persona, pedida de nuevo (para el ánimo y el estrés en vivo y el resumen final). */
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  /** Al cerrar el panel, se vuelve a la ficha. */
  onClose: () => void;
}

/** 024 R-018: el resumen de lo que cambió durante la charla. */
export function summaryHtml(before: CitizenDetail, after: CitizenDetail | null, mode: 'in_world' | 'sandbox', remembered: boolean): string {
  if (mode === 'sandbox') return '<p>Charla de prueba (sandbox): no cambió nada en el mundo y no la recordará.</p>';
  if (!after) return '<p>La charla se guardó; sus efectos aparecerán en la ficha en cuanto el mundo la procese.</p>';
  const row = (label: string, a: number, b: number) => `<div><span>${label}</span><b>${pct(a)} → ${pct(b)}</b></div>`;
  return `<div class="report">${row('Ánimo', before.state.mood, after.state.mood)}${row('Estrés', before.state.stress, after.state.stress)}</div><p>${remembered ? 'La recordará: ya forma parte de su historia.' : 'Aún no aparece en su historia; puede tardar unos segundos.'}</p>`;
}

export interface ChatUi {
  open: (d: CitizenDetail) => void;
  isOpen: () => boolean;
}

export function setupChat(d: ChatUiDeps): ChatUi {
  const panel = document.querySelector<HTMLElement>('#chat')!;
  const main = document.querySelector<HTMLElement>('#main')!;
  let person: CitizenDetail | null = null;
  let session: OpenResult | null = null;
  let mode: 'in_world' | 'sandbox' = 'in_world';
  let busy = false;
  let live: ReturnType<typeof setInterval> | undefined;
  const q = <T extends HTMLElement>(s: string) => panel.querySelector(s) as T;
  const status = (text: string) => (q('#chat-status').textContent = text);
  // Cerrar la página es despedirse: si no, la charla seguía abierta en la API y no dejaba abrir otra (043 R-019.6).
  window.addEventListener('pagehide', () => {
    if (session?.id) void endChat(d.auth, session.id);
  });

  const shell = (p: CitizenDetail) => `
    <div class="chat-head"><canvas class="avatar" width="5" height="8" aria-hidden="true"></canvas>
      <div class="grow"><h2 id="chat-title">Charla con ${esc(p.name)}</h2><span class="sub" id="chat-mode">${p.age} años</span></div>
      <button class="btn" id="chat-end" type="button" hidden>Despedirse</button>
      <button class="btn" id="chat-close" type="button" aria-label="Cerrar la charla y volver a la ficha">✕</button></div>
    <div class="chat-state" id="chat-state"></div>
    <p id="chat-status" class="chat-status" role="status" aria-live="polite"></p>
    <form class="chat-start" id="chat-start">
      <p>¿Cómo quieres charlar?</p>
      <label class="choice"><input type="radio" name="chat-mode" value="in_world" checked><span><b>En el mundo</b><br>Es un encuentro real: lo recordará y puede cambiar su ánimo, su estrés y lo que cree. El mundo sigue su curso.</span></label>
      <label class="choice"><input type="radio" name="chat-mode" value="sandbox"><span><b>De prueba (sandbox)</b><br>Responde igual, pero nada cambia en el mundo ni lo recordará.</span></label>
      <label class="check"><input type="checkbox" id="chat-test"> Modo prueba: elegir yo el tono de cada mensaje</label>
      <button class="btn primary" type="submit">Empezar la charla</button>
    </form>
    <div class="chat-main" id="chat-main" hidden>
      <details class="knows"><summary>Lo que sabe de sí (lo que usa para responder)</summary><ul id="chat-knows"></ul></details>
      <ol class="chat-msgs" id="chat-msgs"></ol>
      <form class="chat-form" id="chat-form">
        <label id="chat-tone-l" hidden>Tono <select id="chat-tone"><option value="">Automático</option>${Object.entries(TONES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
        <textarea id="chat-text" rows="2" maxlength="1000" placeholder="Escribe y pulsa Enter (Mayúsculas+Enter para otra línea)" aria-label="Tu mensaje"></textarea>
        <button class="btn primary" id="chat-send" type="submit">Enviar</button>
      </form>
    </div>`;

  const drawAvatar = (p: CitizenDetail) => {
    // La figura del mapa (5 × 8 px) ampliada por CSS sin suavizado.
    drawFigure(q<HTMLCanvasElement>('canvas.avatar').getContext('2d')!, { id: p.id, x: 2, y: 7, walk: false, frame: 0, small: p.age < 12 });
  };

  const stateBar = (p: CitizenDetail) => {
    const bar = (label: string, v: number, hot: boolean) => `<div class="mini"><span>${label}</span><div class="track"><i class="${hot && v > 0.6 ? 'hot' : ''}" style="width:${pct(v)}%"></i></div><span>${pct(v)}</span></div>`;
    q('#chat-state').innerHTML = bar('Ánimo', p.state.mood, false) + bar('Estrés', p.state.stress, true);
  };

  const close = async () => {
    clearInterval(live);
    const id = session?.id;
    session = null;
    if (id) await endChat(d.auth, id);
    panel.hidden = true;
    panel.innerHTML = '';
    main.classList.remove('chatting');
    document.querySelector<HTMLElement>('#inspector')!.hidden = false;
    d.onClose();
  };

  const finish = async () => {
    const id = session?.id;
    if (!id || !person) return;
    const before = person;
    session = null;
    q<HTMLButtonElement>('#chat-send').disabled = true;
    q('#chat-end').hidden = true;
    status('Te despediste. Esperando a que el mundo procese la charla…');
    await endChat(d.auth, id);
    let after: CitizenDetail | null = null;
    let remembered = false;
    // En el mundo, la charla la aplica el worker (043 R-019): se espera a que aparezca en su historia.
    for (let k = 0; mode === 'in_world' && k < 8 && !remembered; k++) {
      await new Promise((r) => setTimeout(r, 1500));
      after = await d.fetchPerson(before.id).catch(() => null);
      remembered = !!after?.events.some((e) => e.type === 'CONVERSATION_HELD' && !before.events.some((x) => x.id === e.id));
    }
    const li = document.createElement('li');
    li.className = 'msg summary';
    li.innerHTML = `<h3>Resumen de la charla</h3>${summaryHtml(before, after, mode, remembered)}`;
    q('#chat-msgs').append(li);
    li.scrollIntoView({ block: 'end' });
    status('La charla terminó.');
  };

  const send = async () => {
    const text = q<HTMLTextAreaElement>('#chat-text').value.trim();
    if (!session?.id || !text || busy) return;
    busy = true;
    q<HTMLTextAreaElement>('#chat-text').value = '';
    const tag = q<HTMLSelectElement>('#chat-tone').value || undefined;
    const msgs = q('#chat-msgs');
    const mine = document.createElement('li');
    mine.className = 'msg visitor';
    mine.innerHTML = `<div class="bubble">${esc(text)}</div><div class="meta">tú${tag ? ` · tono ${esc(toneLabel(tag))}` : ''}</div>`;
    const theirs = document.createElement('li');
    theirs.className = 'msg citizen';
    theirs.innerHTML = '<div class="bubble"><span class="typing" aria-label="escribiendo"><i></i><i></i><i></i></span></div><div class="meta"></div><details class="whybox" hidden><summary>¿Por qué respondió así?</summary><div class="why-body"></div></details><div class="marks"></div>';
    msgs.append(mine, theirs);
    msgs.scrollTop = msgs.scrollHeight;
    const bubble = theirs.querySelector('.bubble')!;
    const meta = theirs.querySelector('.meta')!;
    let first = true;
    const code = await sendTurn(d.auth, session.id, text, tag, (event, data) => {
      if (event === 'stance') {
        const s = data as StanceMsg;
        const detected = s.tone.toneLlm && s.tone.toneLlm !== s.tone.tone ? ` (el clasificador dijo ${toneLabel(s.tone.toneLlm)})` : '';
        mine.querySelector('.meta')!.textContent = `tú · tono ${toneLabel(s.tone.tone)}${s.tone.toneTag ? ' (elegido)' : ''}${detected}`;
        meta.textContent = `${stanceLabel(s.stance)}${s.forced ? ' · tiene que irse' : ''}`;
        const heard = (s.claims ?? []).map((c) => `<p class="claim">${esc(claimLine(c))}</p>`).join('');
        const box = theirs.querySelector<HTMLDetailsElement>('.whybox')!;
        box.querySelector('.why-body')!.innerHTML = `${heard}<p>Postura: <b>${esc(stanceLabel(s.stance))}</b>. Lo que más pesó:</p><ul>${s.sources.map((x) => `<li>${esc(sourceLabel(x))} <span class="mono">${x.contribution.toFixed(2)}</span></li>`).join('')}</ul><p class="muted">Otras posturas posibles: ${esc(topProbabilities(s.probabilities))}</p>`;
        box.hidden = false;
      } else if (event === 'token') {
        if (first) bubble.textContent = '';
        first = false;
        bubble.textContent += (data as { text: string }).text;
      } else if (event === 'done') {
        const dn = data as DoneMsg;
        if (first) bubble.textContent = dn.reply;
        meta.textContent += ` · ${dn.expression === 'template' ? 'plantilla (sin LLM)' : `${(dn.latencyMs.total / 1000).toFixed(1)} s`}`;
        const poll = async (left: number) => {
          const v = session?.id ? await verification(d.auth, session.id, dn.seq) : null;
          if (v) theirs.querySelector('.marks')!.textContent = [...v.claims.map((c) => `${verdictMark(c.verdict)} ${c.predicate} ${c.value}`), v.stanceCheck === 'mismatch' ? '⚠ no expresa la postura' : ''].filter(Boolean).join(' · ');
          else if (left > 0) setTimeout(() => void poll(left - 1), 1500);
        };
        void poll(4);
        if (dn.ended) void finish();
      } else if (event === 'error') status(`Error: ${(data as { error: string }).error}`);
      msgs.scrollTop = msgs.scrollHeight;
    });
    if (code === 409) status('La charla ya terminó.');
    busy = false;
  };

  const start = async (ev: Event) => {
    ev.preventDefault();
    if (!person) return;
    mode = (q<HTMLInputElement>('input[name="chat-mode"]:checked').value) as 'in_world' | 'sandbox';
    const test = q<HTMLInputElement>('#chat-test').checked;
    status('Abriendo la charla…');
    let r = await openChat(d.auth, person.id, mode, test);
    if (r.status === 401 && (await d.askAuth())) r = await openChat(d.auth, person.id, mode, test);
    if (r.status === 401) return status('La charla necesita el usuario y la contraseña del laboratorio.');
    if (r.status === 409) return status('La charla anterior está terminando un turno. Espera unos segundos y vuelve a intentarlo.');
    if (r.status === 503) return status(r.error ?? 'No se pudo abrir la charla (¿está corriendo el worker?).');
    if (!r.body) return status(`No se pudo abrir la charla (${r.status}).`);
    if (r.body.status === 'declined') return status(`${person.name} no puede charlar ahora: ${r.body.reason ?? 'sin motivo'}.`);
    session = r.body;
    q('#chat-start').hidden = true;
    q('#chat-main').hidden = false;
    q('#chat-end').hidden = false;
    q('#chat-tone-l').hidden = !test;
    q('#chat-mode').textContent = `${person.age} años · ${mode === 'in_world' ? 'en el mundo: lo recordará' : 'de prueba: no cambia el mundo'}`;
    const v = session.view!;
    q('#chat-knows').innerHTML = [
      `<li><b>${esc(v.name)}</b>, ${v.age ?? '?'} años · nació en ${esc(v.birthplace ?? 'sin datos')} · ${esc(v.occupation)}</li>`,
      ...v.family.map((m) => `<li>${esc(m.relation)}: ${esc(m.name)}${m.alive ? '' : ' (murió)'}</li>`),
      ...v.facts.map((f) => `<li><span class="mono">${esc(f.date)}</span> ${esc(f.text)}</li>`),
    ].join('');
    status('');
    q<HTMLTextAreaElement>('#chat-text').focus();
  };

  return {
    open: (p) => {
      person = p;
      session = null;
      mode = 'in_world';
      panel.innerHTML = shell(p);
      panel.hidden = false;
      document.querySelector<HTMLElement>('#inspector')!.hidden = true;
      main.classList.add('chatting');
      drawAvatar(p);
      stateBar(p);
      // Ánimo y estrés en vivo mientras dura el panel.
      live = setInterval(() => {
        void d.fetchPerson(p.id).then((x) => stateBar(x), () => undefined);
      }, 3000);
      q('#chat-start').addEventListener('submit', (e) => void start(e));
      q('#chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        void send();
      });
      q<HTMLTextAreaElement>('#chat-text').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          void send();
        }
      });
      q('#chat-end').addEventListener('click', () => void finish());
      q('#chat-close').addEventListener('click', () => void close());
    },
    isOpen: () => !panel.hidden,
  };
}
