// Población y lugares (spec 024 R-008): sin nadie elegido, el panel lista a la población con un buscador y el color
// de su ánimo; un clic en un lugar muestra su ficha (022 R-007). El formateo es puro y se prueba; el cableado del DOM
// está al final.
import { ACTIVITY_ES } from './format.ts';
import type { CitizenPosition, PlaceDetail, PlaceView } from './types.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Sin mayúsculas ni tildes, para buscar «jose» y encontrar «José». */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Color del ánimo: rojo (0), ámbar (0,5), verde (1). */
export function moodColor(m: number): string {
  const x = Math.max(0, Math.min(1, m));
  const hue = Math.round(120 * x);
  return `hsl(${hue} 60% 45%)`;
}

export interface PersonRow { id: string; name: string; age: number | null; doing: string; color: string; mood: number }

/** CA-006: la población que coincide con la búsqueda, en orden alfabético. */
export function populationRows(list: readonly CitizenPosition[], query: string): PersonRow[] {
  const q = fold(query.trim());
  return list
    .filter((c) => !q || fold(c.name).includes(q))
    .map((c) => ({ id: c.id, name: c.name, age: c.age ?? null, doing: c.moving ? 'en camino' : ACTIVITY_ES[c.activity] ?? c.activity, color: moodColor(c.mood), mood: c.mood }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function populationHtml(rows: readonly PersonRow[], total: number): string {
  const items = rows.map((r) => `<li><button data-person="${esc(r.id)}"><i class="dot" style="background:${r.color}" title="Ánimo ${Math.round(r.mood * 100)} %"></i><span class="nm">${esc(r.name)}</span>${r.age !== null ? `<span class="age">${r.age} años</span>` : ''}<span class="doing">${esc(r.doing)}</span></button></li>`);
  return `<p class="muted">${total} personas. El color indica su ánimo.</p><ul class="people">${items.join('') || '<li class="muted">Nadie coincide con esa búsqueda.</li>'}</ul>`;
}

const HOURS: Record<string, string> = { privado: 'Vivienda privada', '24h': 'Abierto las 24 horas', 'sin horario': 'Sin horario' };

/** CA-006: la ficha de un lugar: horario, quién está dentro y quién vive allí. */
export function placeHtml(p: PlaceDetail): string {
  const hours = HOURS[p.open] ?? `Abierto de ${p.open.replace('-', ' a ')}`;
  const person = (x: { id: string; name: string; activity?: string }) =>
    `<li><button data-person="${esc(x.id)}">${esc(x.name)}${x.activity ? ` <span class="muted">· ${esc(ACTIVITY_ES[x.activity] ?? x.activity)}</span>` : ''}</button></li>`;
  return `<button class="back" data-back>← Volver a la población</button><h2>${esc(p.name)}</h2><p class="muted">${esc(p.kind.replace(/[._]/g, ' '))}${p.district ? `, ${esc(p.district)}` : ''}. ${hours}.</p>`
    + `<h3>Aquí ahora (${p.inside.length})</h3>${p.inside.length ? `<ul class="people">${p.inside.map(person).join('')}</ul>` : '<p class="muted">No hay nadie.</p>'}`
    + (p.residents.length ? `<h3>Viven aquí (${p.residents.length})</h3><ul class="people">${p.residents.map(person).join('')}</ul>` : '');
}

/**
 * El panel de la población en `#people`: se repinta con cada actualización salvo cuando muestra un lugar, y lleva a
 * la ficha de una persona al pulsarla.
 */
export function setupPeoplePanel(o: { list: () => readonly CitizenPosition[]; openPerson: (id: string) => void; fetchPlace: (id: string) => Promise<PlaceDetail> }) {
  const body = document.querySelector<HTMLElement>('#people-body')!;
  const input = document.querySelector<HTMLInputElement>('#people-q')!;
  let place: string | null = null;
  const refresh = () => {
    if (place) return;
    const all = o.list();
    body.innerHTML = populationHtml(populationRows(all, input.value), all.length);
  };
  const showPlace = async (id: string) => {
    place = id;
    body.innerHTML = placeHtml(await o.fetchPlace(id));
  };
  input.addEventListener('input', () => {
    place = null;
    refresh();
  });
  body.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-person],[data-back]');
    if (!t) return;
    if (t.dataset.back !== undefined) {
      place = null;
      refresh();
    } else o.openPerson(t.dataset.person!);
  });
  return { refresh, showPlace, showing: () => place };
}

/** El lugar bajo un punto del mapa (en tiles): el de área más pequeña que lo contiene, o el de esa puerta. */
export function placeAt(places: readonly PlaceView[], x: number, y: number): PlaceView | undefined {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const hits = places.filter((p) => (p.rect && tx >= p.rect.x && ty >= p.rect.y && tx < p.rect.x + p.rect.w && ty < p.rect.y + p.rect.h) || (p.door && p.door.x === tx && p.door.y === ty));
  return hits.sort((a, b) => (a.rect ? a.rect.w * a.rect.h : 0) - (b.rect ? b.rect.w * b.rect.h : 0))[0];
}
