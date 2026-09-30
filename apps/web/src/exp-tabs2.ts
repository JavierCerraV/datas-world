// Pestañas del expediente de vida (spec 024 R-022), segunda parte: Vínculos, Memoria, Creencias, Aprendizaje, Salud,
// Economía y objetos, y Charlas. Formateo puro; Memoria, Creencias y el familiograma reutilizan los de la ficha.
import { tabCreencias, tabRelaciones } from './card.ts';
import { renderMemories } from './card-life.ts';
import { dec, esc, meter } from './card-compact.ts';
import { card, kv, table } from './exp-tabs.ts';
import type { ExpData } from './exp-tabs.ts';
import { KIND_ES, TYPE_ES, money, stimulusEs } from './format.ts';
import { renderDevelopment, renderFamily } from './life.ts';
import type { LifeView } from './life.ts';
import { skeleton } from './loading.ts';

const who = (id: string, name: string) => `<button class="who" data-person="${esc(id)}">${esc(name)}</button> <span class="mono id">${esc(id)}</span>`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function tabVinculos(x: ExpData, life: LifeView | null): string {
  const fam = table(['Persona', 'Parentesco', 'Situación'], x.dos.family.map((f) => [who(f.id, f.name), esc(cap(f.relation)), esc(f.situation)]), 'Sin familia registrada.');
  const net = table(['Desde', 'Relación', 'Hacia', 'Fuerza'], x.d.relations.map((r) => [esc(stimulusEs(r.a)), esc(TYPE_ES[r.type] ?? r.type), esc(stimulusEs(r.b)), `<span class="mono">${dec(r.strength)}</span>`]), 'Sin relaciones enseñadas.');
  return `<div class="grid-2"><div class="col">${card('Familia', fam)}${card('Vínculos <span class="h-note">desde las dos perspectivas (012)</span>', tabRelaciones(x.d))}</div>`
    + `<div class="col">${card('Familiograma', life ? renderFamily(life).replace(/^<h3>Familiograma<\/h3>/, '') : skeleton('el familiograma', 6))}${card('Red relacional <span class="h-note">(037)</span>', net)}</div></div>`;
}

export const tabMemoria = (life: LifeView | null) => card('Memoria <span class="h-note">lo que recuerda, no lo que pasó (013)</span>', life ? renderMemories(life) : skeleton('sus recuerdos', 6));
export const tabCreenciasExp = (x: ExpData) => card('Creencias <span class="h-note">lo que cree y lo que se dice (025)</span>', tabCreencias(x.d));

export function tabAprendizaje(x: ExpData, life: LifeView | null): string {
  const d = x.d;
  const fn = table(['Estímulo', 'Valor', '', 'Ensayos'], d.functions.map((f) => [esc(stimulusEs(f.stimulus)), `<span class="mono">${dec(f.value)}</span>`, `<div class="signed"><i class="${f.value < 0 ? 'neg' : 'pos'}" style="width:${Math.round(Math.min(1, Math.abs(f.value)) * 50)}%"></i></div>`, `<span class="mono">${f.trials}</span>`]), 'Aún no ha aprendido funciones.');
  const rules = table(['Si hace', 'Obtiene', 'Tipo', 'Se lo dijo', 'Fuerza'], d.rules.map((r) => [esc(stimulusEs(r.response)), esc(stimulusEs(r.consequence)), esc(KIND_ES[r.kind] ?? r.kind), esc(r.speaker ?? '—'), `<span class="mono">${dec(r.strength)}</span>`]), 'Sin reglas verbales.');
  const resp = d.responses.map((r) => meter(stimulusEs(r.response), r.strength)).join('') || '<p class="empty">Sin respuestas registradas.</p>';
  const learned = kv([['Descuento de lo demorado (k, por día)', `<span class="mono">${d.learned.discountK.toFixed(3).replace('.', ',')}</span>`], ['Variabilidad de la conducta', `<span class="mono">${dec(d.learned.variability)}</span>`]]);
  const TEMPER: Record<string, string> = { extraversion: 'Extraversión', neuroticism: 'Reactividad emocional', conscientiousness: 'Responsabilidad', impulsivity: 'Impulsividad', resilience: 'Resiliencia', openness: 'Apertura', agreeableness: 'Amabilidad' };
  const temper = Object.entries(d.temperament).map(([k, v]) => meter(TEMPER[k] ?? k, v)).join('');
  const dev = life ? `<details class="card"><summary><h2>Historia de aprendizaje por etapas <span class="h-note">(041)</span></h2></summary>${renderDevelopment(life)}</details>` : `<section class="card" style="margin-top:16px">${skeleton('la historia de aprendizaje', 3)}</section>`;
  return `<div class="grid-2"><div class="col">${card('Funciones de estímulos <span class="h-note">(036) · −1 aversivo, +1 apetitivo</span>', fn)}${card('Reglas verbales <span class="h-note">(038)</span>', rules)}</div>`
    + `<div class="col">${card('Fuerza de respuestas <span class="h-note">(036)</span>', resp)}${card('Estados aprendidos', learned)}${card('Temperamento <span class="h-note">(009) · solo parametriza el aprendizaje</span>', temper)}</div></div>${dev}`;
}

export function tabSalud(x: ExpData): string {
  const h = x.dos.health;
  const ins = kv([['Régimen', esc(h.insurance?.regime ? cap(h.insurance.regime) : 'sin datos')], ['Desde', h.insurance ? `<span class="mono">${esc(h.insurance.since)}</span>` : '—']]);
  const conds = h.conditions.length ? h.conditions.map((c) => `${esc(c.name)} (desde <span class="mono">${esc(c.since)}</span>${c.controlled ? ', controlada' : ''})`).join('<br>') : 'Ninguna diagnosticada';
  const ep = kv([
    ['Condiciones', conds],
    ['Enfermedades', h.illnesses.length ? `${h.illnesses.length} en la simulación (la última el <span class="mono">${esc(h.illnesses.at(-1)!)}</span>)` : 'Ninguna en la simulación'],
    ['Sueño', h.overslept.count ? `${h.overslept.count} ${h.overslept.count === 1 ? 'vez' : 'veces'} dormido de más (la última el <span class="mono">${esc(h.overslept.last ?? '')}</span>)` : 'Sin episodios'],
  ]);
  return `<div class="grid-2">${card('Aseguramiento <span class="h-note">(031)</span>', ins)}${card('Condiciones y episodios', `${ep}<p class="note">La salud mental no es un diagnóstico de la ficha (031); en la capa clínica aparecerá como formulación del terapeuta (034).</p>`)}</div>`;
}

export function tabEconomia(x: ExpData): string {
  const d = x.d;
  const occ = d.occupation;
  const org = occ?.orgName ? `${esc(String(occ.orgName))}${occ.orgId ? ` <span class="mono">(${esc(String(occ.orgId))})</span>` : ''}` : '—';
  const i = x.dos.identity.household;
  const eco = kv([
    ['Dinero', d.money === null ? 'sin datos' : `<span class="mono">${esc(money(d.money))}</span>`],
    ['Ocupación', occ?.kind === 'formal' ? `Formal · ${org}` : esc(occ?.kind ?? 'sin datos')],
    ['Cargo', occ?.positionId ? `<span class="mono">${esc(String(occ.positionId))}</span>` : '—'],
    ['Hogar', i ? `<span class="mono">${esc(i.id)}</span> · ${i.members} personas` : '—'],
    ['Deudas', x.dos.debts.length ? x.dos.debts.map((b) => `${esc(money(b.balance))} con ${esc(b.creditor)} (cuota ${esc(money(b.installment))} ${b.period === 'day' ? 'diaria' : 'mensual'})`).join('<br>') : 'Ninguna'],
  ]);
  const obj = table(['Objeto', 'Dueño', 'Adquirido', 'Precio'], x.dos.objects.map((o) => [`${esc(o.name.replace(/^./, (c) => c.toUpperCase()))} <span class="mono id">${esc(o.id)}</span>`, o.owner === 'persona' ? (d.sex === 'F' ? 'Ella' : 'Él') : 'Hogar', `<span class="mono">${esc(o.acquired ?? '—')}</span>`, `<span class="mono">${esc(money(o.price))}</span>`]), 'No tiene objetos registrados.');
  return `<div class="grid-2">${card('Economía', eco)}${card('Objetos <span class="h-note">(005)</span>', obj)}</div>`;
}

/** Charlas: las anteriores (se cargan aparte en `#exp-chats`) y el formulario para iniciar una (043, 024 R-024). */
export function tabCharlas(x: ExpData): string {
  const d = x.d;
  const f = x.dos.agenda.free;
  const busy = ['work', 'study', 'sleep'].includes(d.activity);
  const avail = d.activity === 'sleep'
    ? 'Ahora está durmiendo: no puede charlar.'
    : `${busy ? `Ahora está ${d.activity === 'work' ? 'trabajando' : 'estudiando'}: puede hablar solo un momento (unos 10 minutos).` : 'Ahora tiene tiempo.'}${f ? ` Está libre desde las ${f.from} hasta las ${f.to}.` : ''} El mundo sigue en tiempo real mientras charlan.`;
  const form = `<form class="chat-start-exp" id="exp-chat-start">
    <fieldset><legend>Modo</legend>
      <label class="choice"><input type="radio" name="exp-mode" value="in_world" checked><span><b>En el mundo</b> · deja recuerdo y aprendizaje</span></label>
      <label class="choice"><input type="radio" name="exp-mode" value="sandbox"><span><b>Sandbox</b> · no cambia el mundo</span></label>
    </fieldset>
    <label class="check"><input type="checkbox" id="exp-test"> Modo prueba (etiquetar el tono de cada mensaje)</label>
    <p class="note">${esc(avail)}</p>
    <button class="btn primary" type="submit">Iniciar charla</button></form>`;
  return `<div class="grid-2">${card('Charlas', `<div id="exp-chats">${skeleton('las charlas', 3)}</div><p class="note">Cada charla en el mundo queda aquí con sus tonos y posturas (043).</p>`)}${card('Iniciar una charla', form)}</div>`;
}
