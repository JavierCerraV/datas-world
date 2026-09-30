// Inspector a la derecha (spec 024 R-014, R-017), como el prototipo: sin nadie elegido, la población; con un lugar,
// su ficha; con una persona, su ficha de vida con pestañas. Se refresca con el mundo sin perder la búsqueda, las
// pestañas ni los desplegables abiertos. Solo lee de la API.
import { LifeData, renderHistory, renderLifeTab, renderMemories } from './card-life.ts';
import type { LifeSub } from './card-life.ts';
import { cardHead, nowLine, tabCreencias, tabEstado, tabFuncional, tabRelaciones } from './card.ts';
import type { Tab } from './card.ts';
import { showChatHistory } from './chat-history.ts';
import { placeHtml, populationHtml, populationRows } from './panels.ts';
import type { CitizenDetail, CitizenPosition, PlaceDetail } from './types.ts';
import { bindWhy } from './why.ts';

export interface InspectorDeps {
  people: () => readonly CitizenPosition[];
  doing: (c: CitizenPosition) => string;
  intro: () => string;
  fetchPerson: (id: string) => Promise<CitizenDetail>;
  fetchPlace: (id: string) => Promise<PlaceDetail>;
  auth: () => string | null;
  askAuth: () => Promise<boolean>;
  /** Avisos al resto del visor: quién o qué está elegido, charlar y seguir. */
  onSelect: (person: string | null, place: string | null) => void;
  onChat: (d: CitizenDetail) => void;
  /** «Seguir en el mapa»: lo lleva el mapa (también se activa desde allí). */
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

export function setupInspector(d: InspectorDeps): Inspector {
  const box = document.querySelector<HTMLElement>('#inspector')!;
  let mode: 'population' | 'place' | 'person' = 'population';
  let personId: string | null = null;
  let placeId: string | null = null;
  let detail: CitizenDetail | null = null;
  let tab: Tab = 'estado';
  let sub: LifeSub = 'informe';
  let query = '';
  let fetchedAt = 0;
  const life = new LifeData();
  bindWhy(box);

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
    box.querySelector('#people-list')!.innerHTML = populationHtml(populationRows(d.people(), query, d.doing));
  };

  const tabBody = (): string => {
    if (!detail) return '';
    switch (tab) {
      case 'estado':
        return tabEstado(detail);
      case 'relaciones':
        return tabRelaciones(detail);
      case 'creencias':
        return tabCreencias(detail);
      case 'funcional':
        return tabFuncional(detail);
      case 'historia':
        return renderHistory(detail, life.report);
      case 'memoria':
        return life.life ? renderMemories(life.life) : '<p>Cargando sus recuerdos…</p>';
      case 'vida':
        return renderLifeTab(sub, life.life, life.report);
      case 'charlas':
        return '';
    }
  };

  let lastBody = '';
  const renderPerson = (full: boolean) => {
    if (!detail) return;
    const person = d.people().find((c) => c.id === detail!.id);
    const doing = person ? d.doing(person) : '';
    if (full || !box.querySelector('#tab-body')) {
      box.innerHTML = `<div class="ins-pad">${cardHead(detail, doing, tab)}<div id="tab-body"></div></div>`;
      box.querySelector('#card-follow')!.setAttribute('aria-pressed', String(d.following()));
      lastBody = '';
    } else {
      const line = box.querySelector('#nowLine');
      const html = nowLine(detail, doing);
      if (line && line.innerHTML !== html) line.innerHTML = html;
    }
    const body = box.querySelector<HTMLElement>('#tab-body')!;
    if (tab === 'charlas') {
      if (full) void showChatHistory(body, detail.id, d.auth, d.askAuth);
      return;
    }
    const html = tabBody();
    if (html !== lastBody) {
      body.innerHTML = html;
      lastBody = html;
    }
  };

  const loadPerson = async (id: string, full: boolean) => {
    fetchedAt = Date.now();
    const got = await d.fetchPerson(id);
    if (personId !== id || mode !== 'person') return;
    detail = got;
    life.load(id, () => renderPerson(false));
    renderPerson(full);
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
        life.reset();
        box.innerHTML = '<div class="ins-pad"><p>Cargando su ficha…</p></div>';
      }
      mode = 'person';
      personId = id;
      placeId = null;
      d.onSelect(id, null);
      void loadPerson(id, true);
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
      if (mode === 'person' && personId) void loadPerson(personId, false);
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
    const tb = t.closest<HTMLElement>('[data-tab]');
    if (tb) {
      tab = tb.dataset.tab as Tab;
      return renderPerson(true);
    }
    const sb = t.closest<HTMLElement>('[data-sub]');
    if (sb) {
      sub = sb.dataset.sub as LifeSub;
      return renderPerson(false);
    }
    if (t.closest('#card-chat') && detail) return d.onChat(detail);
    if (t.closest('#card-follow')) d.toggleFollow();
  });
  renderPopulation(true);
  return api;
}
