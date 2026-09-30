// Ficha compacta de una persona junto al mapa (spec 024 R-021, Visor A+): id, nombre, sexo, edad y trabajo; «Ampliar
// expediente», «Charlar» y «Seguir»; actividad, lugar, hogar y dinero; el estado en barras con el aviso de necesidad
// crítica; «Por qué está aquí» con sus causas; y el enlace al expediente. Formateo puro.
import { occupationEs } from './card.ts';
import { ACTIVITY_ES, causeEs, money } from './format.ts';
import type { Dossier } from './dossier-types.ts';
import type { CitizenDetail } from './types.ts';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Un valor en [0,1] con coma decimal, como el lienzo: 0,52. */
export const dec = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Necesidades con 1 = satisfecha (010), con sus nombres del lienzo. */
export const NEED_ES: [string, string][] = [
  ['energy', 'Energía'],
  ['fun', 'Diversión'],
  ['hunger', 'Alimentación'],
  ['hygiene', 'Higiene'],
  ['social', 'Compañía'],
];
/** Umbral crítico de una necesidad (040 R-007): por debajo, es operación motivadora con peso alto. */
export const CRITICAL = 0.1;
const SEEK: Record<string, string> = { energy: 'descansar', fun: 'distraerse', hunger: 'comer', hygiene: 'asearse', social: 'buscar compañía' };

/** Barra del lienzo: etiqueta, pista y valor con coma. `tone`: color de la barra. */
export const meter = (label: string, v: number, tone: 'ok' | 'bad' | 'ink' = 'ink') =>
  `<div class="meter"><span>${esc(label)}</span><div class="track"><i class="${tone}" style="width:${Math.round(clamp01(v) * 100)}%"></i></div><span class="mono">${dec(v)}</span></div>`;

/** Las necesidades por debajo del umbral crítico, con lo que buscará. */
export function criticalNeeds(d: CitizenDetail): { key: string; label: string; seek: string }[] {
  return NEED_ES.filter(([k]) => (d.needs[k] ?? 1) < CRITICAL).map(([k, l]) => ({ key: k, label: l, seek: SEEK[k] ?? k }));
}

/** Sexo y edad en palabras: «Hombre · 40 años». */
export const sexAge = (d: CitizenDetail) => `${d.sex === 'M' ? 'Hombre' : d.sex === 'F' ? 'Mujer' : 'Persona'} · ${d.age} ${d.age === 1 ? 'año' : 'años'}`;

/** Dónde trabaja o qué hace, corto, para la cabecera. */
export const workShort = (d: CitizenDetail) => (d.occupation?.orgName ? String(d.occupation.orgName) : occupationEs(d));

/** Las líneas de «Por qué está aquí»: los hechos que explican su situación, con sus causas, y su rutina de ahora. */
export function whyHere(d: CitizenDetail, dos: Dossier | null, doing: string): { text: string; causes: string }[] {
  const out = (dos?.why ?? []).map((e) => ({ text: `${e.date.slice(0, 10)} · ${(e.text ?? e.type).replace(/CIT-\d+/g, (id) => (id === d.id ? d.name.split(' ')[0]! : e.names?.[id] ?? 'alguien'))}`, causes: e.causes.map(causeEs).join(' · ') }));
  const until = d.until ? ` hasta las ${d.until.slice(11, 16)}` : '';
  out.push({ text: `Ahora: ${doing}${until}`, causes: 'su rutina del día (011)' });
  return out;
}

/** CA-012 (formato): la ficha compacta completa. */
export function compactCard(d: CitizenDetail, doing: string, dos: Dossier | null, following: boolean): string {
  const crit = criticalNeeds(d);
  const kv: [string, string][] = [
    ['Actividad', `${ACTIVITY_ES[d.activity] ?? d.activity}${d.moving ? ', en camino' : ''}`],
    ['Lugar', d.place ? `<button class="who" data-place="${esc(d.place.id)}">${esc(d.place.name)}</button>` : d.moving ? 'en la calle' : 'fuera del pueblo'],
    ['Hogar', d.household ? `<span class="mono">${esc(d.household.id)}</span> · ${d.household.members} ${d.household.members === 1 ? 'persona' : 'personas'}` : 'sin datos'],
    ['Dinero', d.money === null ? 'sin datos' : `<span class="mono">${esc(money(d.money))}</span>`],
  ];
  const bars = meter('Ánimo', d.state.mood, 'ok') + meter('Estrés', d.state.stress, 'bad')
    + NEED_ES.filter(([k]) => k === 'energy' || k === 'hunger' || (d.needs[k] ?? 1) < CRITICAL).map(([k, l]) => meter(l, d.needs[k] ?? 0, (d.needs[k] ?? 1) < CRITICAL ? 'bad' : 'ink')).join('');
  const warn = crit.map((c) => `<p class="warn-line">${esc(c.label)} crítica: buscará ${esc(c.seek)} en su próximo punto de decisión</p>`).join('');
  const why = whyHere(d, dos, doing).map((w) => `<li>${esc(w.text)}<small>${esc(w.causes)}</small></li>`).join('');
  return `<div class="cc">
    <button class="back" data-back type="button">← Población</button>
    <span class="mono id">${esc(d.id)}</span>
    <h2>${esc(d.name)}</h2>
    <p class="sub">${esc(sexAge(d))} · ${esc(workShort(d))}</p>
    <div class="cc-actions"><a class="btn primary" href="#/expediente/${esc(d.id)}">Ampliar expediente</a><a class="btn" href="#/charla/${esc(d.id)}">Charlar</a><button class="btn" id="card-follow" type="button" aria-pressed="${following}">Seguir</button></div>
    <dl class="kv2">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h3>Estado</h3>${bars}${warn}
    <h3>Por qué está aquí</h3><ul class="whylist">${why}</ul>
    <a class="more" href="#/expediente/${esc(d.id)}/historia">Ver historia, vínculos, aprendizaje y salud →</a>
  </div>`;
}
