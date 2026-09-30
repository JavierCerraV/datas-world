// Piezas de la ficha que usa el expediente de vida (spec 024 R-022): la ocupación en palabras, los vínculos desde las
// dos perspectivas (012) y las creencias con lo que otros creen de la persona (025). Formateo puro.
import { pct } from './format.ts';
import type { CitizenDetail } from './types.ts';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const who = (id: string, name: string | null) => `<button class="who" data-person="${esc(id)}">${esc(name ?? id)}</button>`;

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
