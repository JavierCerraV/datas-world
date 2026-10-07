// Iconos y retratos del visor (spec 024 R-025): trazos gruesos con el borde del estilo, rellenos con variables de
// color (los colores viven en dw-tokens.css). Devuelven SVG como texto; sin estado.
import { lookOf } from './logic.ts';

export type IconName = 'coin' | 'drop' | 'star' | 'briefcase' | 'moon' | 'apple' | 'book' | 'person' | 'users' | 'heart' | 'bolt' | 'home' | 'lock' | 'trophy' | 'shield';

const PATHS: Record<IconName, (f: string) => string> = {
  coin: (f) => `<circle cx="12" cy="12" r="9" fill="${f}"/><circle cx="12" cy="12" r="5.5" stroke-width="1.3" opacity=".6"/><path d="M12 8.5v7"/>`,
  drop: (f) => `<path d="M12 2.5C12 2.5 5.5 9.8 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.5 12 2.5Z" fill="${f}"/>`,
  star: (f) => `<path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1l-5.6 2.9 1.1-6.2L3 9.4l6.2-.9Z" fill="${f}"/>`,
  briefcase: (f) => `<rect x="3" y="8" width="18" height="12" rx="2.5" fill="${f}"/><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M3 13.5h18"/>`,
  moon: (f) => `<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10Z" fill="${f}"/>`,
  apple: (f) => `<path d="M12 7.5c-2-1.8-7-1.2-7 4.2 0 4 3 8.3 5.2 8.3 1 0 1-.6 1.8-.6s.8.6 1.8.6c2.2 0 5.2-4.3 5.2-8.3 0-5.4-5-6-7-4.2Z" fill="${f}"/><path d="M12 7.5C12 5 13 3.5 15 3"/>`,
  book: (f) => `<path d="M3.5 5.5c3-1 6-1 8.5 1v13c-2.5-2-5.5-2-8.5-1Z" fill="${f}"/><path d="M20.5 5.5c-3-1-6-1-8.5 1v13c2.5-2 5.5-2 8.5-1Z" fill="${f}" opacity=".85"/>`,
  person: (f) => `<circle cx="12" cy="8" r="4" fill="${f}"/><path d="M4.5 20.5c0-4.5 3-7 7.5-7s7.5 2.5 7.5 7Z" fill="${f}"/>`,
  users: (f) => `<circle cx="9" cy="8" r="3.3" fill="${f}"/><path d="M3 19.5c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5Z" fill="${f}"/><circle cx="17" cy="9" r="2.5" fill="${f}"/><path d="M16.5 14c3 0 5 1.8 5 4.8h-5" fill="${f}"/>`,
  heart: (f) => `<path d="M12 20.5C5 15 3 11.5 3 8.8a4.6 4.6 0 0 1 9-1.6 4.6 4.6 0 0 1 9 1.6c0 2.7-2 6.2-9 11.7Z" fill="${f}"/>`,
  bolt: (f) => `<path d="M13.5 2.5 5 13.5h6l-1 8 9-11.5h-6Z" fill="${f}"/>`,
  home: (f) => `<path d="M3.5 11.5 12 4l8.5 7.5M6 10v9.5h12V10" fill="${f}"/>`,
  lock: (f) => `<rect x="5.5" y="10.5" width="13" height="10" rx="2.5" fill="${f}"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`,
  trophy: (f) => `<path d="M7 3.5h10v5.5a5 5 0 0 1-10 0Z" fill="${f}"/><path d="M7 5.5H3.5v1.5A3.5 3.5 0 0 0 7 10.5M17 5.5h3.5v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20.5h8"/>`,
  shield: (f) => `<path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6Z" fill="${f}"/>`,
};

/** Un icono de `size` px; `fill` es un color o una variable (`var(--dw-gold)`). */
export function icon(name: IconName, size = 22, fill = 'var(--dw-gold)'): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="var(--dw-edge)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${PATHS[name](fill)}</svg>`;
}

/** El retrato de una persona: la piel y el pelo salen de su id, igual que la figura del mapa. */
export function avatar(id: string, size = 78): string {
  const l = lookOf(id);
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="27" r="16" fill="${l.skin}" stroke="var(--dw-edge)" stroke-width="2.8"/><path d="M7.5 26C5.5 11 15 5 24 5s18.5 6 16.5 21c-3-7-7-10-16.5-10S10.5 19 7.5 26Z" fill="${l.hair}" stroke="var(--dw-edge)" stroke-width="2.8" stroke-linejoin="round"/><circle cx="18" cy="28" r="2.2" fill="var(--dw-edge)"/><circle cx="30" cy="28" r="2.2" fill="var(--dw-edge)"/><path d="M19.5 34.5c2.5 3 6.5 3 9 0" fill="none" stroke="var(--dw-edge)" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}

/** Icono de una conducta según su identificador (`actividad.work`, `ocio.futbol`…); una estrella si no se reconoce. */
export function responseIcon(response: string): IconName {
  const r = response.toLowerCase();
  const rules: [RegExp, IconName][] = [
    [/work|trabaj|job/, 'briefcase'],
    [/sleep|dorm|nap|siesta/, 'moon'],
    [/eat|comer|comid|almuer|cena|desayun|food/, 'apple'],
    [/study|estud|leer|lectura|book|libro/, 'book'],
    [/social|amig|famil|visit|pareja|charl|acerc|contar|abrirse|hablar|conversar/, 'users'],
    [/care|cuid|salud|health|medic/, 'heart'],
    [/exerc|ejerc|deport|futbol|gym|correr/, 'bolt'],
    [/shop|compr|ahorr|dinero|pag/, 'coin'],
    [/home|casa|chore|oficio|hogar/, 'home'],
    [/commute|camin|walk|viaj|trip/, 'person'],
  ];
  return rules.find(([re]) => re.test(r))?.[1] ?? 'star';
}
