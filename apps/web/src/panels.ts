// Población y lugares (spec 024 R-008, R-017), como el prototipo: sin nadie elegido, la población con un buscador,
// el color de su ánimo, su edad y lo que hace con el nombre del lugar; un clic en un lugar muestra su ficha con su
// personal, sus residentes y quién está dentro (022 R-007, R-014). Formateo puro.
import { ACTIVITY_ES } from './format.ts';
import type { Where } from './replay.ts';
import type { CitizenPosition, PlaceDetail, PlaceView } from './types.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Sin mayúsculas ni tildes, para buscar «jose» y encontrar «José». */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Color del ánimo, los cuatro tramos del prototipo: rojo, naranja, ámbar y verde. */
export const moodColor = (m: number): string => (m > 0.62 ? '#2E9A62' : m > 0.45 ? '#C7A23A' : m > 0.3 ? '#D97A34' : '#C0433C');

/**
 * Lo que hace una persona, con el lugar, como el prototipo: «trabajando en Restaurante La Mesa», «durmiendo en casa»,
 * «camino a casa». `where` es su posición en el minuto de la vista (024 R-013).
 */
export function doingOf(c: CitizenPosition, where: Where | undefined, name: (id: string) => string | undefined): string {
  const place = (id: string | null) => (!id ? '' : id === c.homeId ? 'casa' : name(id) ?? 'otro lugar');
  if (where?.kind === 'walk') return `camino a ${place(where.move.to)}`;
  const at = where?.kind === 'at' ? where.place : c.placeId;
  if (!at) return 'fuera del pueblo';
  // «En camino» según el último estado guardado, pero ya llegó en el minuto de la vista.
  if (c.activity === 'commute') return `en ${place(at)}`;
  return `${ACTIVITY_ES[c.activity] ?? c.activity} en ${place(at)}`;
}

export interface PersonRow { id: string; name: string; age: number | null; doing: string; color: string; mood: number }

/** CA-006: la población que coincide con la búsqueda, en orden alfabético. */
export function populationRows(list: readonly CitizenPosition[], query: string, doing: (c: CitizenPosition) => string = (c) => (c.moving ? 'en camino' : ACTIVITY_ES[c.activity] ?? c.activity)): PersonRow[] {
  const q = fold(query.trim());
  return list
    .filter((c) => !q || fold(c.name).includes(q))
    .map((c) => ({ id: c.id, name: c.name, age: c.age ?? null, doing: doing(c), color: moodColor(c.mood), mood: c.mood }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function populationHtml(rows: readonly PersonRow[]): string {
  const items = rows.map((r) => `<li><button data-person="${esc(r.id)}"><i class="dot" style="background:${r.color}" title="Ánimo ${Math.round(r.mood * 100)}"></i><span class="nm">${esc(r.name)}</span>${r.age !== null ? `<span class="age">${r.age} ${r.age === 1 ? 'año' : 'años'}</span>` : '<span></span>'}<span class="doing">${esc(r.doing)}</span></button></li>`);
  return items.join('') || '<li class="empty">Nadie coincide con esa búsqueda.</li>';
}

/** Cabecera de la población: cuántas personas, hogares y barrios. */
export const populationIntro = (people: number, households: number, districts: number): string =>
  `${people} personas en ${households} hogares${districts ? ` y ${districts} ${districts === 1 ? 'barrio' : 'barrios'}` : ''}. El color indica el ánimo actual.`;

const HOURS: Record<string, string> = { privado: 'Vivienda privada', '24h': 'Abierto las 24 horas', 'sin horario': 'Sin horario' };
const KIND: Record<string, string> = { vivienda: 'Vivienda', comercio: 'Comercio', ocio: 'Ocio', salud: 'Salud', educacion: 'Educación', industria: 'Industria', servicios: 'Servicios', gobierno: 'Gobierno', finanzas: 'Finanzas', deporte: 'Deporte', cultura: 'Cultura', espacio_publico: 'Espacio público' };

/** El tipo de un lugar en palabras: `ocio.cafe` → «Ocio, cafe». */
export const kindEs = (kind: string): string => {
  const [a, b] = kind.split('.');
  return `${KIND[a ?? ''] ?? a}${b ? `, ${b.replace(/_/g, ' ')}` : ''}`;
};

/** CA-006: la ficha de un lugar: tipo, barrio y horario; personal, residentes y quién está dentro ahora. */
export function placeHtml(p: PlaceDetail): string {
  const hours = HOURS[p.open] ?? `Abierto de ${p.open.replace('-', ' a ')}`;
  const person = (x: { id: string; name: string; activity?: string }, extra = '') =>
    `<li><button class="who" data-person="${esc(x.id)}">${esc(x.name)}</button>${extra}${x.activity ? `<small>${esc(ACTIVITY_ES[x.activity] ?? x.activity)}</small>` : ''}</li>`;
  const staff = p.staff ?? [];
  return `<button class="back" data-back>Volver a la población</button><h2>${esc(p.name)}</h2><p class="sub">${esc(kindEs(p.kind))}${p.district ? `, barrio ${esc(p.district)}` : ''}. ${hours}.</p>`
    + (staff.length ? `<h3>Personal (${staff.length})</h3><ul class="list">${staff.map((s) => person(s, ` <small style="display:inline">${esc(s.title)}${s.boss ? ', dirige' : ''}</small>`)).join('')}</ul>` : '')
    + (p.residents.length ? `<h3>Viven aquí (${p.residents.length})</h3><ul class="list">${p.residents.map((r) => person(r)).join('')}</ul>` : '')
    + `<h3>Aquí ahora (${p.inside.length})</h3><ul class="list">${p.inside.map((x) => person(x)).join('') || '<li class="empty">No hay nadie.</li>'}</ul>`;
}

/** El lugar bajo un punto del mapa (en tiles): el de área más pequeña que lo contiene, o el de esa puerta. */
export function placeAt(places: readonly PlaceView[], x: number, y: number): PlaceView | undefined {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const hits = places.filter((p) => (p.rect && tx >= p.rect.x && ty >= p.rect.y && tx < p.rect.x + p.rect.w && ty < p.rect.y + p.rect.h) || (p.door && p.door.x === tx && p.door.y === ty));
  return hits.sort((a, b) => (a.rect ? a.rect.w * a.rect.h : 0) - (b.rect ? b.rect.w * b.rect.h : 0))[0];
}
