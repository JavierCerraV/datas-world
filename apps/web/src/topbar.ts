// Barra superior (spec 024 R-025 y R-021): fecha y hora del mundo con el día de simulación, el estado (Simulando / En
// pausa, que pausa o reanuda), el menú «Avanzar» con los avances sin observar (022 R-013), y personas, hogares y
// organizaciones. No hay selector de velocidades (decisión del usuario, 2026-10-05). Solo muestra y envía órdenes;
// no decide nada.
import { send } from './auth.ts';
import type { Command } from './auth.ts';
import { clockOf } from './camera.ts';
import type { Stats } from './types.ts';

/** 022 R-013: avances sin observar, en minutos de mundo. */
export const ADVANCES: readonly [number, string][] = [
  [1440, '1 día'],
  [10080, '1 semana'],
  [43200, '1 mes'],
  [129600, '3 meses'],
  [259200, '6 meses'],
  [525600, '1 año'],
];

/** Porcentaje de un avance en curso, o null si no hay. */
export function advanceProgress(a: Stats['advance'], now: number): number | null {
  if (!a) return null;
  return Math.min(1, Math.max(0, (now - a.from) / Math.max(1, a.to - a.from)));
}

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const pctText = (x: number) => `${Math.round(x * 100)} %`;

export interface Topbar {
  /** Estado del mundo (del último tick). */
  setWorld: (status: string) => void;
  setClock: (epoch: string, minute: number) => void;
  setStats: (s: Stats, now: number, orgs?: number) => void;
}

export function setupTopbar(o: { message: (text: string) => void; status: () => string }): Topbar {
  const play = $<HTMLButtonElement>('#play');
  const advance = $<HTMLSelectElement>('#adv');
  advance.innerHTML = `<option value="">Avanzar…</option>${ADVANCES.map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}`;
  const order = async (cmd: Command, arg?: number) => {
    const m = await send(cmd, arg);
    o.message(m ?? '');
  };
  play.addEventListener('click', () => void order(o.status() === 'paused' ? 'resume' : 'pause'));
  advance.addEventListener('change', () => {
    const v = Number(advance.value);
    advance.value = '';
    if (v) void order('advance', v);
  });
  return {
    setWorld: (status) => {
      const paused = status === 'paused';
      play.querySelector('span')!.textContent = paused ? 'En pausa' : 'Simulando';
      play.classList.toggle('paused', paused);
      play.setAttribute('aria-label', paused ? 'Reanudar la simulación' : 'Pausar la simulación');
      play.title = paused ? 'Reanudar' : 'Pausar';
    },
    setClock: (epoch, minute) => {
      const c = clockOf(epoch, minute);
      $('#clk-time').textContent = `${c.iso} ${c.time}`;
      $('#clk-day').textContent = `${c.weekday} · ${c.day.toLowerCase()}`;
    },
    setStats: (s, now, orgs) => {
      $('#st-pop').textContent = String(s.population);
      $('#st-sub').textContent = `${s.households} hogares${orgs !== undefined ? ` · ${orgs} org.` : ''} · ${pctText(s.employedPct)} con empleo · ánimo ${Math.round(s.moodMean * 100)}`;
      const p = advanceProgress(s.advance, now);
      $('#progress').classList.toggle('on', p !== null);
      advance.disabled = p !== null;
      if (p !== null) {
        $('#prog-pct').textContent = pctText(p);
        $('#prog-bar').style.width = pctText(p);
      }
    },
  };
}
