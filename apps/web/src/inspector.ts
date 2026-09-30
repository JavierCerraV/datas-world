// Panel a la derecha del mapa (spec 024 R-008, R-021): sin nadie elegido, la población; con un lugar, su ficha; con
// una persona, su ficha compacta, que lleva al expediente y a la charla. Se refresca con el mundo sin perder la
// búsqueda. Solo lee de la API.
import { compactCard } from './card-compact.ts';
import type { Dossier } from './dossier-types.ts';
import { placeHtml, populationHtml, populationRows } from './panels.ts';
import type { CitizenDetail, CitizenPosition, PlaceDetail } from './types.ts';

export interface InspectorDeps {
  people: () => readonly CitizenPosition[];
  doing: (c: CitizenPosition) => string;
  intro: () => string;
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  fetchDossier: (id: string) => Promise<Dossier>;
  fetchPlace: (id: string) => Promise<PlaceDetail>;
  /** Avisos al resto del visor: quién o qué está elegido. */
  onSelect: (person: string | null, place: string | null) => void;
  /** «Seguir»: lo lleva el mapa (también se activa desde allí). */
  toggleFollow: () => void;
  following: () => boolean;
}

export interface Inspector {
  select: (id: string) => void;
  showPlace: (id: string) => void;
  showPopulation: () => void;
  /** Datos nuevos del mundo: repinta lo que cambie. */
  refresh: () => void;
  detail: () => CitizenDetail | null;
}

const REFETCH_MS = 1500;
const DOSSIER_MS = 15000;

export function setupInspector(d: InspectorDeps): Inspector {
  const box = document.querySelector<HTMLElement>('#inspector')!;
  let mode: 'population' | 'place' | 'person' = 'population';
  let personId: string | null = null;
  let placeId: string | null = null;
  let detail: CitizenDetail | null = null;
  let dossier: Dossier | null = null;
  let dossierAt = 0;
  let query = '';
  let fetchedAt = 0;
  let last = '';

  const renderPopulation = (full: boolean) => {
    if (full || !box.querySelector('#people-list')) {
      box.innerHTML = `<div class="ins-pad"><h2>Población</h2><p class="sub" id="pop-intro"></p>
        <input class="search" id="q" type="search" placeholder="Buscar por nombre" aria-label="Buscar persona">
        <ul class="people" id="people-list"></ul>
        <p class="note">Nadie tiene guion: cada persona decide según sus necesidades, su historia de aprendizaje, su dinero y sus vínculos. Lo que ves ya pasó en el mundo; el visor lo muestra unos segundos después.</p></div>`;
      const q = box.querySelector<HTMLInputElement>('#q')!;
      q.value = query;
      q.addEventListener('input', () => {
        query = q.value;
        renderPopulation(false);
      });
    }
    box.querySelector('#pop-intro')!.textContent = d.intro();
    // Solo se repinta la lista si cambió (lleva un retrato por persona).
    const html = populationHtml(populationRows(d.people(), query, d.doing));
    const list = box.querySelector<HTMLElement>('#people-list')!;
    if (full || html !== lastList || !list.firstChild) {
      list.innerHTML = html;
      lastList = html;
    }
  };
  let lastList = '';

  const renderPerson = () => {
    if (!detail) return;
    const person = d.people().find((c) => c.id === detail!.id);
    const html = `<div class="ins-pad">${compactCard(detail, person ? d.doing(person) : '', dossier, d.following())}</div>`;
    if (html !== last) {
      box.innerHTML = html;
      last = html;
    }
  };

  const loadPerson = async (id: string) => {
    fetchedAt = Date.now();
    const got = await d.fetchPerson(id);
    if (personId !== id || mode !== 'person') return;
    detail = got;
    renderPerson();
    if (Date.now() - dossierAt > DOSSIER_MS || dossier?.id !== id) {
      dossierAt = Date.now();
      const dos = await d.fetchDossier(id).catch(() => null);
      if (personId !== id) return;
      dossier = dos;
      renderPerson();
    }
  };

  const loadPlace = async (id: string) => {
    fetchedAt = Date.now();
    const p = await d.fetchPlace(id);
    if (placeId !== id || mode !== 'place') return;
    box.innerHTML = `<div class="ins-pad">${placeHtml(p)}</div>`;
  };

  const api: Inspector = {
    select: (id) => {
      if (mode !== 'person' || personId !== id) {
        detail = null;
        dossier = null;
        last = '';
        box.innerHTML = '<div class="ins-pad"><p>Cargando su ficha…</p></div>';
      }
      mode = 'person';
      personId = id;
      placeId = null;
      d.onSelect(id, null);
      void loadPerson(id);
    },
    showPlace: (id) => {
      mode = 'place';
      placeId = id;
      personId = null;
      d.onSelect(null, id);
      box.innerHTML = '<div class="ins-pad"><p>Cargando…</p></div>';
      void loadPlace(id);
    },
    showPopulation: () => {
      mode = 'population';
      personId = null;
      placeId = null;
      detail = null;
      d.onSelect(null, null);
      renderPopulation(true);
    },
    refresh: () => {
      if (mode === 'population') return renderPopulation(false);
      if (Date.now() - fetchedAt < REFETCH_MS) return;
      if (mode === 'person' && personId) void loadPerson(personId);
      if (mode === 'place' && placeId) void loadPlace(placeId);
    },
    detail: () => detail,
  };

  box.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const person = t.closest<HTMLElement>('[data-person]');
    if (person) return api.select(person.dataset.person!);
    const place = t.closest<HTMLElement>('[data-place]');
    if (place) return api.showPlace(place.dataset.place!);
    if (t.closest('[data-back]')) return api.showPopulation();
    if (t.closest('#card-follow')) d.toggleFollow();
  });
  renderPopulation(true);
  return api;
}
