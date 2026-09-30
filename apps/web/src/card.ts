// Ficha de vida de una persona (spec 024 R-017), con el aspecto del prototipo: cabecera con «Ahora: …» y el botón
// Charlar, y las pestañas que salen de la ficha de la API (022): Estado, Relaciones, Creencias y Funcional. Las que
// cargan datos aparte (Memoria, Historia, Vida y Charlas) están en `card-life.ts`. Formateo puro.
import { ACTIVITY_ES, inspectorTabs, money, pct } from './format.ts';
import type { CitizenDetail } from './types.ts';

export type Tab = 'estado' | 'relaciones' | 'memoria' | 'historia' | 'creencias' | 'vida' | 'funcional' | 'charlas';
export const TABS: readonly [Tab, string][] = [
  ['estado', 'Estado'],
  ['relaciones', 'Relaciones'],
  ['memoria', 'Memoria'],
  ['historia', 'Historia'],
  ['creencias', 'Creencias'],
  ['vida', 'Vida'],
  ['funcional', 'Funcional'],
  ['charlas', 'Charlas'],
];

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const who = (id: string, name: string | null) => `<button class="who" data-person="${esc(id)}">${esc(name ?? id)}</button>`;

/** Barra grande del prototipo: etiqueta, pista y valor; `hot` la pinta de rojo si pasa de 0,6. */
export const bar = (label: string, v: number, hot = false) =>
  `<div class="bar"><span>${esc(label)}</span><div class="track"><i class="${hot && v > 0.6 ? 'hot' : ''}" style="width:${Math.round(clamp01(v) * 100)}%"></i></div><b>${Math.round(clamp01(v) * 100)}</b></div>`;

/** Barra pequeña; un valor con signo (afecto) se dibuja por su tamaño y en rojo si es negativo. */
export const mini = (label: string, v: number, hot = false, signed = false) => {
  const shown = signed ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}` : String(Math.round(clamp01(v) * 100));
  return `<div class="mini"><span>${esc(label)}</span><div class="track"><i class="${hot || (signed && v < 0) ? 'hot' : ''}" style="width:${Math.round(clamp01(Math.abs(v)) * 100)}%"></i></div><span>${shown}</span></div>`;
};

const first = (d: CitizenDetail) => d.name.split(' ')[0] ?? d.name;

/** Ocupación en palabras. */
export function occupationEs(d: CitizenDetail): string {
  const o = d.occupation;
  if (!o) return 'sin datos';
  if (o.kind === 'formal') return `Empleo formal${o.orgName ? ` en ${o.orgName}` : ''}`;
  if (o.kind === 'none')
    return ({ unemployed: 'Sin empleo', student: 'Estudiante', home_duties: 'Oficios del hogar', pensioned: 'Pensionado/a', other_inactive: 'Inactivo/a', minor: 'Menor de edad' } as Record<string, string>)[o.reason ?? ''] ?? 'Sin ocupación';
  return `Trabajo ${o.kind === 'informal' ? 'informal' : 'independiente'}${o.trade ? ` (${String(o.trade).replace(/_/g, ' ')})` : ''}`;
}

/** «Ahora: trabajando en Tienda Doña Rosa hasta las 17:00», con el lugar como enlace a su ficha. */
export function nowLine(d: CitizenDetail, doing: string): string {
  const until = d.until ? ` hasta las ${d.until.slice(11, 16)}` : '';
  let html = esc(doing);
  if (d.place && !d.moving && d.place.name && doing.includes(d.place.name))
    html = html.replace(esc(d.place.name), `<button class="who" data-place="${esc(d.place.id)}">${esc(d.place.name)}</button>`);
  return `Ahora: ${html}${esc(until)}`;
}

/** Cabecera: volver, nombre, id, edad, vivienda y barrio, «Ahora: …», Charlar y las pestañas. */
export function cardHead(d: CitizenDetail, doing: string, tab: Tab): string {
  const where = [d.home?.name, d.district ? `barrio ${d.district}` : null].filter(Boolean).join(', ');
  return `<button class="back" data-back>Volver a la población</button>
    <h2>${esc(d.name)}<span class="badge" title="Mientras la miras, su ficha se actualiza con cada paso del mundo.">observada</span></h2>
    <p class="sub">${esc(d.id)}, ${d.age} ${d.age === 1 ? 'año' : 'años'}${where ? `, ${esc(where)}` : ''}</p>
    <p class="now" id="nowLine">${nowLine(d, doing)}</p>
    <p class="card-actions"><button class="btn primary" id="card-chat">Charlar con ${esc(first(d))}</button><button class="btn" id="card-follow" aria-pressed="false">Seguir en el mapa</button></p>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
}

const NEEDS: [string, string, boolean, boolean][] = [
  // clave, etiqueta, invertida (1 = satisfecha en el motor), roja si alta
  ['energy', 'Energía', false, false],
  ['hunger', 'Hambre', true, true],
  ['social', 'Soledad', true, true],
  ['fun', 'Aburrimiento', true, true],
  ['hygiene', 'Falta de aseo', true, true],
];
const EMO: Record<string, string> = { joy: 'Alegría', sadness: 'Tristeza', anger: 'Enojo', fear: 'Miedo', shame: 'Vergüenza' };
const TEMPER: Record<string, string> = { extraversion: 'Extraversión', neuroticism: 'Reactividad emocional', conscientiousness: 'Responsabilidad', impulsivity: 'Impulsividad', resilience: 'Resiliencia' };

/** Pestaña Estado: estado interno en barras, emociones, recursos y situación, y temperamento. */
export function tabEstado(d: CitizenDetail): string {
  const needs = NEEDS.filter(([k]) => d.needs[k] !== undefined).map(([k, l, inv, hot]) => bar(l, inv ? 1 - d.needs[k]! : d.needs[k]!, hot));
  const emotions = Object.entries(d.emotions).map(([k, v]) => mini(EMO[k] ?? k, v, k !== 'joy' && v > 0.6));
  const kv = [
    ['Dinero', d.money === null ? 'sin datos' : money(d.money)],
    ['Ocupación', occupationEs(d)],
    ['Vivienda', d.home ? `${d.home.name}${d.household ? `, ${d.household.members} ${d.household.members === 1 ? 'persona' : 'personas'}` : ''}` : 'sin datos'],
    ['Barrio', d.district ?? 'sin datos'],
    ['Qué hace', `${ACTIVITY_ES[d.activity] ?? d.activity}${d.moving ? ', en camino' : d.place ? `, en ${d.place.name}` : ''}`],
  ];
  const temper = Object.entries(d.temperament).map(([k, v]) => mini(TEMPER[k] ?? k, v));
  return `<h3>Estado interno</h3>${needs.join('')}${bar('Estrés', d.state.stress, true)}${bar('Ánimo', d.state.mood)}`
    + (emotions.length ? `<h3>Emociones</h3>${emotions.join('')}` : '')
    + `<h3>Recursos y situación</h3><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v!)}</dd>`).join('')}</dl>`
    + (temper.length ? `<h3>Temperamento</h3>${temper.join('')}` : '');
}

const LABEL: Record<string, string> = { amigo: 'amistad', companero: 'compañero de trabajo', conocido: 'conocido', ex: 'expareja', familia: 'familia', pareja: 'pareja', vecino: 'vecino' };

/** Pestaña Relaciones: cada vínculo desde las dos perspectivas, como el prototipo, y el apego. */
export function tabRelaciones(d: CitizenDetail): string {
  const bonds = d.bonds ?? [];
  if (!bonds.length) return '<p class="empty">Todavía no tiene vínculos registrados. Aparecen cuando se encuentra con otras personas.</p>';
  const other = (n: string | null) => (n ?? 'la otra persona').split(' ')[0];
  const rows = bonds.map((b) => {
    const labels = b.labels.filter((l) => l !== 'conocido' || b.labels.length === 1).map((l) => LABEL[l] ?? l).join(', ') || 'conocido';
    return `<li><div class="rel-head"><span>${who(b.id, b.name)}</span><span class="rel-type">${esc(labels)}</span></div>`
      + `${mini(`Afecto de ${first(d)}`, b.affection, false, true)}${mini(`Afecto de ${other(b.name)}`, b.affectionBack, false, true)}`
      + `${mini('Trato', b.familiarity)}${mini('Confianza', b.trust)}${mini('Tensión', b.tension, b.tension > 0.3)}<small>${b.encounters} ${b.encounters === 1 ? 'encuentro' : 'encuentros'}</small></li>`;
  });
  const STYLE: Record<string, string> = { seguro: 'seguro', evitativo: 'evitativo', ansioso: 'ansioso' };
  const att = d.attachment
    ? `<h3>Apego (métrica de su historia)</h3><p class="sub">Estilo ${esc(STYLE[d.attachment.style] ?? d.attachment.style)}.</p>${mini('Seguridad', d.attachment.security)}${mini('Evitación', d.attachment.avoidance)}`
    : '';
  return `<p class="sub" style="margin-top:12px">Cada vínculo se mide desde las dos perspectivas; no tienen por qué coincidir.</p><ul class="list">${rows.join('')}</ul>${att}`;
}

/** Pestaña Creencias: lo que cree de otros y lo que otros creen de esta persona, frente a la verdad del mundo. */
export function tabCreencias(d: CitizenDetail): string {
  const mine = d.beliefs ?? [];
  const o1 = mine.length
    ? `<ul class="list">${mine.map((b) => `<li>«${esc(b.topic)}» de ${who(b.about, b.name)}<small>${b.truth ? '<span class="ok">Coincide con la realidad.</span>' : '<span class="no">No coincide con la realidad.</span>'} ${b.source === 'visto' ? 'Lo vio con sus propios ojos' : b.sourceName ? `Se lo contó ${esc(b.sourceName)}` : 'Se lo dijo un visitante'}${b.hops > 1 ? `, tras pasar por ${b.hops} bocas` : ''}.</small>${mini('Cuánto lo cree', b.credibility)}</li>`).join('')}</ul>`
    : '<p class="empty">No ha oído noticias sobre otras personas. La información viaja cuando la gente conversa.</p>';
  const about = d.aboutMe ?? [];
  const o2 = about.length
    ? `<ul class="list">${about.map((a) => `<li>«${esc(a.topic)}» <span class="${a.true ? 'ok' : 'no'}">${a.true ? 'cierto' : 'falso'}</span><small>Lo creen: ${a.holders.map((h) => `${who(h.id, h.name)} (${pct(h.credibility)})`).join(', ')}</small></li>`).join('')}</ul>`
    : '<p class="empty">No circula información sobre esta persona.</p>';
  return `<h3>Lo que cree sobre otras personas</h3>${o1}<h3>Lo que se dice de ${esc(first(d))}</h3>${o2}<p class="note">Solo quien observa ve si algo es verdad; las personas del mundo solo saben lo que vieron o les contaron.</p>`;
}

/** Pestaña Funcional: lo aprendido de su historia (funciones, reglas, relaciones verbales y estados aprendidos). */
export function tabFuncional(d: CitizenDetail): string {
  const sections = inspectorTabs(d).funcional.filter((s) => s.rows.length);
  return `<p class="sub" style="margin-top:12px">Análisis funcional: qué valor tiene cada cosa para esta persona según su historia, qué reglas sigue y cómo relaciona unas cosas con otras.</p>`
    + sections.map((s) => `<h3>${esc(s.title)}</h3><dl class="kv wide">${s.rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('')}</dl>`).join('');
}
