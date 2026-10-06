// Charla a pantalla completa (spec 024 R-024, Visor A+; 043 R-017): cabecera con el expediente de origen, el id de la
// charla, el modo prueba y «Despedirse»; una franja con el modo, cuándo empezó y cuánto lleva, hasta cuándo está libre
// y el lugar; los mensajes numerados con su hora, tono o postura y tiempo de respuesta, y las afirmaciones
// verificadas; y un panel con por qué respondió así en el último turno, el estado de la charla y lo que sabe la
// persona. Al despedirse, un resumen de lo que cambió. Solo muestra lo que devuelve la API.
import { TONES, TRUST_LABEL, claimLine, endChat, openChat, sendTurn, sourceLabel, stanceLabel, toneLabel, topProbabilities, verdictMark, verification } from './chat.ts';
import type { DoneMsg, OpenResult, StanceMsg } from './chat.ts';
import { withAuth } from './auth.ts';
import { dec } from './card-compact.ts';
import type { Dossier } from './dossier-types.ts';
import { ACTIVITY_ES } from './format.ts';
import type { CitizenDetail } from './types.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (x: number) => Math.round(x * 100);

export interface ChatUiDeps {
  auth: () => string | null;
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  fetchDossier: (id: string) => Promise<Dossier>;
  /** Minuto del mundo que se ve y su hora (`17:10`). */
  worldMinute: () => number;
  clock: (minute: number) => string;
}

/** 024 R-018: el resumen de lo que cambió durante la charla. */
export function summaryHtml(before: CitizenDetail, after: CitizenDetail | null, mode: 'in_world' | 'sandbox', remembered: boolean): string {
  if (mode === 'sandbox') return '<p>Charla de prueba (sandbox): no cambió nada en el mundo y no la recordará.</p>';
  if (!after) return '<p>La charla se guardó; sus efectos aparecerán en el expediente en cuanto el mundo la procese.</p>';
  const row = (label: string, a: number, b: number) => `<div><span>${label}</span><b>${pct(a)} → ${pct(b)}</b></div>`;
  return `<div class="report">${row('Ánimo', before.state.mood, after.state.mood)}${row('Estrés', before.state.stress, after.state.stress)}</div><p>${remembered ? 'La recordará: ya forma parte de su historia.' : 'Aún no aparece en su historia; puede tardar unos segundos.'}</p>`;
}

/** El panel «por qué respondió así» del último turno: aportes de las fuentes (040) y probabilidades. */
export function whyPanel(s: StanceMsg | null): string {
  if (!s) return '<p class="empty">Aparecerá con la primera respuesta.</p>';
  const max = Math.max(0.01, ...s.sources.map((x) => Math.abs(x.contribution)));
  const rows = s.sources.map((x) => `<div class="meter"><span>${esc(sourceLabel(x))}</span><div class="track"><i class="ink" style="width:${Math.round((Math.abs(x.contribution) / max) * 100)}%"></i></div><span class="mono">${dec(x.contribution)}</span></div>`).join('');
  return `${rows}<p class="note">Probabilidades: ${esc(topProbabilities(s.probabilities, 5))}</p>`;
}

export interface ChatPage {
  show: (id: string, prefs?: { mode: 'in_world' | 'sandbox'; test: boolean }) => void;
  /** Al salir de la pantalla: despedirse si hay una charla abierta (043 R-019.6). */
  leave: () => void;
}

export function setupChat(d: ChatUiDeps): ChatPage {
  const root = document.querySelector<HTMLElement>('#view-charla')!;
  let person: CitizenDetail | null = null;
  let dossier: Dossier | null = null;
  let session: OpenResult | null = null;
  let mode: 'in_world' | 'sandbox' = 'in_world';
  let test = false;
  let busy = false;
  let startedAt = 0;
  let turns = 0;
  let trust: 0 | 1 | 2 = 0;
  let checks = { ok: 0, bad: 0 };
  let live: ReturnType<typeof setInterval> | undefined;
  const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const status = (text: string) => (q('#chat-status').textContent = text);
  window.addEventListener('pagehide', () => {
    if (session?.id) void endChat(d.auth, session.id);
  });

  const strip = () => {
    if (!person) return;
    const f = dossier?.agenda.free;
    const place = person.moving ? 'en camino' : person.place?.name ?? 'fuera del pueblo';
    const since = session ? `<span><span class="sub">Charla desde las</span> <span class="mono">${d.clock(startedAt)}</span> <span class="sub">· lleva</span> <span class="mono">${Math.max(0, Math.round(d.worldMinute() - startedAt))} min</span></span>` : `<span class="sub">Ahora: ${esc(ACTIVITY_ES[person.activity] ?? person.activity)}</span>`;
    q('#chat-strip').innerHTML = `<span class="dotlbl"><i class="acc"></i><b>${mode === 'in_world' ? 'En el mundo' : 'Sandbox'}</b><span class="sub"> · ${mode === 'in_world' ? 'deja recuerdo y aprendizaje' : 'no cambia el mundo'}</span></span>${since}`
      + (f ? `<span class="sub">Libre de <span class="mono">${f.from}</span> a <span class="mono">${f.to}</span></span>` : '')
      + `<span class="dotlbl ok"><i></i>El mundo sigue en tiempo real</span><span class="sub">Lugar: ${esc(place)}</span>`;
  };

  const state = () => {
    if (!person) return;
    const food = person.needs.hunger;
    q('#chat-state').innerHTML = `<dl class="kv2"><dt>Ánimo (en vivo)</dt><dd class="mono">${dec(person.state.mood)}</dd><dt>Estrés (en vivo)</dt><dd class="mono">${dec(person.state.stress)}</dd>${food !== undefined ? `<dt>Alimentación (en vivo)</dt><dd class="mono">${dec(food)}</dd>` : ''}<dt>Turnos</dt><dd class="mono">${turns}</dd><dt>Confianza en el visitante</dt><dd>${TRUST_LABEL[trust]}</dd><dt>Verificación</dt><dd class="mono">${checks.ok} ✓ · ${checks.bad} ✗</dd></dl>`;
  };

  const shell = (p: CitizenDetail) => `<header class="bar"><a href="#/expediente/${esc(p.id)}">Expediente ${esc(p.id)}</a><span class="sub">/</span><h1>Charla con ${esc(p.name)}</h1><span class="mono sub" id="chat-id"></span><span class="grow"></span>`
    + `<span class="sub" id="chat-testlbl" hidden>Modo prueba</span><button class="btn primary" id="chat-end" type="button" hidden>Despedirse</button><a class="btn" href="#/mundo/${esc(p.id)}">Volver al mundo</a></header>`
    + `<div class="chat-strip" id="chat-strip"></div>`
    + `<div class="chat-grid"><section class="chat-col"><p id="chat-status" class="chat-status" role="status" aria-live="polite"></p>`
    + `<form class="chat-start" id="chat-start"><h2>¿Cómo quieres charlar con ${esc(p.name.split(' ')[0]!)}?</h2>
        <label class="choice"><input type="radio" name="chat-mode" value="in_world" checked><span><b>En el mundo</b> · es un encuentro real: lo recordará y puede cambiar su ánimo, su estrés y lo que cree.</span></label>
        <label class="choice"><input type="radio" name="chat-mode" value="sandbox"><span><b>Sandbox</b> · responde igual, pero nada cambia en el mundo ni lo recordará.</span></label>
        <label class="check"><input type="checkbox" id="chat-test"> Modo prueba: etiquetar yo el tono de cada mensaje</label>
        <button class="btn primary" type="submit">Iniciar charla</button></form>`
    + `<ol class="chat-msgs" id="chat-msgs" hidden></ol>`
    + `<form class="chat-form" id="chat-form" hidden><label id="chat-tone-l" hidden>Tono (prueba)<select id="chat-tone"><option value="">Automático</option>${Object.entries(TONES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>`
    + `<label class="grow">Mensaje<textarea id="chat-text" rows="1" maxlength="1000" placeholder="Escribe y pulsa Enter (Mayúsculas+Enter para otra línea)"></textarea></label><button class="btn accent" id="chat-send" type="submit">Enviar</button></form></section>`
    + `<aside class="chat-side"><section><h2 id="why-title">Último turno · por qué respondió así</h2><p class="sub">Aportes de las fuentes de control (040)</p><div id="chat-why">${whyPanel(null)}</div></section>`
    + `<section><h2>Estado de la charla</h2><div id="chat-state"></div></section>`
    + `<section><h2>Lo que sabe ${esc(p.name.split(' ')[0]!)} <span class="h-note">(vista usada)</span></h2><ul id="chat-knows"><li class="empty">Aparece al iniciar la charla.</li></ul><p class="note">Solo lo que vivió o presenció (043 R-002, R-003).</p></section></aside></div>`;

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
    const n = ++turns;
    const mine = document.createElement('li');
    mine.className = 'msg visitor';
    mine.innerHTML = `<div class="meta mono">#${n * 2 - 1} · ${d.clock(d.worldMinute())}${tag ? ` · tono ${esc(toneLabel(tag))} (etiqueta)` : ''}</div><div class="bubble">${esc(text)}</div>`;
    const theirs = document.createElement('li');
    theirs.className = 'msg citizen';
    theirs.innerHTML = '<div class="meta mono"></div><div class="bubble"><span class="typing" aria-label="escribiendo"><i></i><i></i><i></i></span></div><div class="marks"></div>';
    msgs.append(mine, theirs);
    msgs.scrollTop = msgs.scrollHeight;
    const bubble = theirs.querySelector('.bubble')!;
    const meta = theirs.querySelector('.meta')!;
    let first = true;
    let stanceText = '';
    const code = await sendTurn(d.auth, session.id, text, tag, (event, data) => {
      if (event === 'stance') {
        const s = data as StanceMsg;
        const detected = s.tone.toneLlm ? ` · clasificador: ${toneLabel(s.tone.toneLlm)}` : '';
        mine.querySelector('.meta')!.textContent = `#${n * 2 - 1} · ${d.clock(d.worldMinute())} · tono ${toneLabel(s.tone.tone)}${s.tone.toneTag ? ' (etiqueta)' : ''}${detected}`;
        stanceText = `postura ${stanceLabel(s.stance)}${s.forced ? ' · tiene que irse' : ''}`;
        meta.innerHTML = `#${n * 2} · ${d.clock(d.worldMinute())} · <b class="stance-${esc(s.stance)}">${esc(stanceText)}</b>`;
        const heard = (s.claims ?? []).map((c) => `<p class="claim">${esc(claimLine(c))}</p>`).join('');
        q('#why-title').textContent = `Último turno · por qué ${stanceLabel(s.stance) === 'abrirse' ? 'se abrió' : `eligió ${stanceLabel(s.stance)}`}`;
        q('#chat-why').innerHTML = heard + whyPanel(s);
      } else if (event === 'token') {
        if (first) bubble.textContent = '';
        first = false;
        bubble.textContent += (data as { text: string }).text;
      } else if (event === 'done') {
        const dn = data as DoneMsg;
        if (dn.level !== undefined) trust = dn.level;
        if (first) bubble.textContent = dn.reply;
        meta.innerHTML += ` · ${dn.expression === 'template' ? 'plantilla (sin LLM)' : `${(dn.latencyMs.total / 1000).toFixed(1).replace('.', ',')} s`}`;
        const poll = async (left: number) => {
          const v = session?.id ? await verification(d.auth, session.id, dn.seq) : null;
          if (v) {
            checks = { ok: checks.ok + v.claims.filter((c) => c.verdict === 'supported').length, bad: checks.bad + v.claims.filter((c) => c.verdict !== 'supported').length };
            theirs.querySelector('.marks')!.innerHTML = v.claims.length || v.stanceCheck === 'mismatch'
              ? `Afirmaciones: ${[...v.claims.map((c) => `<span class="${c.verdict === 'supported' ? 'ok' : 'no'}">${esc(`${verdictMark(c.verdict)} ${c.predicate.replace(/_/g, ' ')} ${c.value}`)}</span>`), v.stanceCheck === 'mismatch' ? '<span class="no">⚠ no expresa la postura</span>' : 'Adherencia a la postura: <span class="ok">✓</span>'].join(' · ')}`
              : '';
            state();
          } else if (left > 0) setTimeout(() => void poll(left - 1), 1500);
        };
        void poll(4);
        if (dn.ended) void finish();
      } else if (event === 'error') status(`Error: ${(data as { error: string }).error}`);
      msgs.scrollTop = msgs.scrollHeight;
    });
    if (code === 409) status('La charla ya terminó.');
    busy = false;
  };

  const start = async () => {
    if (!person) return;
    status('Abriendo la charla…');
    const r = await withAuth(() => openChat(d.auth, person!.id, mode, test));
    if (r.status === 401) return status('La charla necesita el usuario y la contraseña del laboratorio.');
    if (r.status === 409) return status('La charla anterior está terminando un turno. Espera unos segundos y vuelve a intentarlo.');
    if (r.status === 503) return status(r.error ?? 'No se pudo abrir la charla (¿está corriendo el worker?).');
    if (!r.body) return status(`No se pudo abrir la charla (${r.status}).`);
    if (r.body.status === 'declined') return status(`${person.name} no puede charlar ahora: ${r.body.reason ?? 'sin motivo'}.`);
    session = r.body;
    startedAt = d.worldMinute();
    turns = 0;
    trust = 0;
    checks = { ok: 0, bad: 0 };
    q('#chat-start').hidden = true;
    q('#chat-msgs').hidden = false;
    q('#chat-form').hidden = false;
    q('#chat-end').hidden = false;
    q('#chat-tone-l').hidden = !test;
    q('#chat-testlbl').hidden = !test;
    q('#chat-id').textContent = session.id ?? '';
    const v = session.view!;
    q('#chat-knows').innerHTML = [
      `<li>${esc(v.name)}, ${v.age ?? '?'} años · nació en ${esc(v.birthplace ?? 'sin datos')} · ${esc(v.occupation)}</li>`,
      ...v.family.map((m) => `<li>${esc(m.relation)}: ${esc(m.name)}${m.alive ? '' : ' (murió)'}</li>`),
      ...v.facts.map((f) => `<li><span class="mono">${esc(f.date)}</span> ${esc(f.text)}</li>`),
    ].join('');
    status('');
    strip();
    state();
    q<HTMLTextAreaElement>('#chat-text').focus();
  };

  root.addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement;
    e.preventDefault();
    if (f.id === 'chat-start') {
      mode = (q<HTMLInputElement>('input[name="chat-mode"]:checked').value) as 'in_world' | 'sandbox';
      test = q<HTMLInputElement>('#chat-test').checked;
      void start();
    } else if (f.id === 'chat-form') void send();
  });
  root.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).id === 'chat-text' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  });
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#chat-end')) void finish();
  });

  const api: ChatPage = {
    show: (id, prefs) => {
      if (person?.id === id && session) return;
      api.leave();
      person = null;
      root.innerHTML = '<p class="empty pad">Cargando…</p>';
      void Promise.all([d.fetchPerson(id), d.fetchDossier(id).catch(() => null)]).then(([p, dos]) => {
        person = p;
        dossier = dos;
        mode = prefs?.mode ?? 'in_world';
        test = prefs?.test ?? false;
        root.innerHTML = shell(p);
        strip();
        state();
        if (prefs) void start();
        clearInterval(live);
        live = setInterval(() => {
          void d.fetchPerson(id).then((x) => {
            if (person?.id !== id) return;
            person = x;
            strip();
            state();
          }, () => undefined);
        }, 3000);
      });
    },
    leave: () => {
      clearInterval(live);
      if (session?.id) void endChat(d.auth, session.id);
      session = null;
    },
  };
  return api;
}
