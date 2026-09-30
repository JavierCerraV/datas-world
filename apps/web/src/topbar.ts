// Cabecera de la pantalla Mundo (spec 024 R-021, Visor A+): fecha y hora grandes con el día de simulación, el estado
// (Simulando / En pausa, que pausa o reanuda), las velocidades del motor (002), «+1 día» y el resto de avances sin
// observar (022 R-013), y personas, hogares y organizaciones. Solo muestra y envía órdenes; no decide nada.
import { send } from './auth.ts';
import type { Command } from './auth.ts';
import { clockOf } from './camera.ts';
import type { Stats } from './types.ts';

/** Velocidades del motor (002 R-003), en minutos de mundo por segundo real. */
export const SPEEDS: readonly [number, string, string][] = [
  [1 / 60, 'Real', 'Tiempo real: 1 minuto del mundo por minuto'],
  [1, '1 min/s', '1 minuto del mundo por segundo (60 veces el tiempo real): se ve caminar a la gente'],
  [10, '10 min/s', '10 minutos del mundo por segundo'],
  [100, '100 min/s', '100 minutos del mundo por segundo'],
  [1000, '1000 min/s', '1000 minutos del mundo por segundo'],
];
/** 022 R-013: avances sin observar, en minutos de mundo. */
export const ADVANCES: readonly [number, string][] = [
  [1440, '1 día'],
  [10080, '1 semana'],
  [43200, '1 mes'],
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
  /** Estado y velocidad del mundo (del último tick y del último cambio de velocidad). */
  setWorld: (status: string, speed: number) => void;
  setClock: (epoch: string, minute: number) => void;
  setStats: (s: Stats, now: number, orgs?: number) => void;
}

export function setupTopbar(o: { message: (text: string) => void; status: () => string }): Topbar {
  const play = $<HTMLButtonElement>('#play');
  const speeds = $('#speeds');
  const day = $<HTMLButtonElement>('#adv-day');
  const more = $<HTMLSelectElement>('#adv-more');
  speeds.innerHTML = SPEEDS.map(([v, label, title]) => `<button type="button" data-speed="${v}" title="${title}" aria-pressed="false">${label}</button>`).join('');
  more.innerHTML += ADVANCES.slice(1).map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  const order = async (cmd: Command, arg?: number) => {
    const m = await send(cmd, arg);
    o.message(m ?? '');
  };
  play.addEventListener('click', () => void order(o.status() === 'paused' ? 'resume' : 'pause'));
  speeds.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-speed]');
    if (b) void order('speed', Number(b.dataset.speed));
  });
  day.addEventListener('click', () => void order('advance', ADVANCES[0]![0]));
  more.addEventListener('change', () => {
    const v = Number(more.value);
    more.value = '';
    if (v) void order('advance', v);
  });
  return {
    setWorld: (status, speed) => {
      const paused = status === 'paused';
      play.querySelector('span')!.textContent = paused ? 'En pausa' : 'Simulando';
      play.classList.toggle('paused', paused);
      play.setAttribute('aria-label', paused ? 'Reanudar la simulación' : 'Pausar la simulación');
      play.title = paused ? 'Reanudar' : 'Pausar';
      for (const b of speeds.querySelectorAll<HTMLButtonElement>('[data-speed]')) b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.speed) - speed) < 1e-9));
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
      day.disabled = p !== null;
      more.disabled = p !== null;
      if (p !== null) {
        $('#prog-pct').textContent = pctText(p);
        $('#prog-bar').style.width = pctText(p);
      }
    },
  };
}
