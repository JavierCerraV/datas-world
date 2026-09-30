// Pantallas del Visor A+ (spec 024 R-020): Mundo, Datos, el expediente de una persona y la charla, cada una en su
// dirección (`#/mundo`, `#/datos`, `#/expediente/CIT-000019`, `#/charla/CIT-000019`), para que el navegador pueda
// volver atrás y enlazar. La lectura de la dirección es pura y se prueba; el cambio de pantalla, al final.

export type Route =
  | { view: 'mundo'; person?: string }
  | { view: 'datos' }
  | { view: 'expediente'; person: string; tab?: string }
  | { view: 'charla'; person: string };

const ID = /^CIT-\d+$/;

/** La pantalla de una dirección; lo que no se reconoce es el mundo. */
export function parseRoute(hash: string): Route {
  const [view, id, tab] = hash.replace(/^#\/?/, '').split('/');
  if (view === 'datos') return { view: 'datos' };
  if (view === 'expediente' && id && ID.test(id)) return tab ? { view: 'expediente', person: id, tab } : { view: 'expediente', person: id };
  if (view === 'charla' && id && ID.test(id)) return { view: 'charla', person: id };
  if (view === 'mundo' && id && ID.test(id)) return { view: 'mundo', person: id };
  return { view: 'mundo' };
}

/** La dirección de una pantalla. */
export function hrefOf(r: Route): string {
  if (r.view === 'datos') return '#/datos';
  if (r.view === 'expediente') return `#/expediente/${r.person}${r.tab ? `/${r.tab}` : ''}`;
  if (r.view === 'charla') return `#/charla/${r.person}`;
  return r.person ? `#/mundo/${r.person}` : '#/mundo';
}

const VIEWS: Record<Route['view'], string> = { mundo: '#view-mundo', datos: '#view-datos', expediente: '#view-exp', charla: '#view-charla' };

/** Muestra la pantalla de la dirección actual y avisa con cada cambio. */
export function setupRouter(onRoute: (r: Route, prev: Route | null) => void): { go: (r: Route) => void; current: () => Route } {
  let prev: Route | null = null;
  const apply = () => {
    const r = parseRoute(location.hash);
    for (const [v, sel] of Object.entries(VIEWS)) document.querySelector<HTMLElement>(sel)!.hidden = v !== r.view;
    const nav = r.view === 'datos' ? 'datos' : 'mundo';
    for (const a of document.querySelectorAll<HTMLElement>('[data-nav]')) {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    onRoute(r, prev);
    prev = r;
  };
  window.addEventListener('hashchange', apply);
  queueMicrotask(apply);
  return {
    go: (r) => {
      const h = hrefOf(r);
      if (location.hash === h) apply();
      else location.hash = h;
    },
    current: () => parseRoute(location.hash),
  };
}
