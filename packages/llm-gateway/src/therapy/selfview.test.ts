// Spec 047 R-013 (CA-012): al llegar a consulta la persona sabe lo que le pasó entre sesiones: sus episodios de rumia,
// si practicó y a qué sesiones fue. Está en su vista, no en el prompt del terapeuta: él solo lo sabrá si ella lo cuenta.
import type { WorldEvent, WorldView } from '@datas-world/engine';
import { generateWorld } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { buildPersonView } from '../chat/view.ts';

const gen = generateWorld({ seed: 482917 });
const view = gen.world as unknown as WorldView;
const ME = 'CIT-000019';
const NOW = view.now;
const DAY = 1440;
let n = 0;
const ev = (type: string, daysAgo: number, payload: Record<string, unknown>): WorldEvent => ({
  id: `EVT-9${String(++n).padStart(10, '0')}`, type, at: NOW - daysAgo * DAY, payload: { citizenId: ME, ...payload }, causes: [], participants: [{ id: ME, role: 'persona' }], origin: 'system', importance: 0.3,
} as unknown as WorldEvent);

const lived: WorldEvent[] = [
  ev('PNR_EPISODE', 40, { trigger: 'verbal.deuda', steps: 5, minutes: 50, ended: 'tope', peak: 0.9 }), // fuera de la ventana
  ev('PROTOCOL_SESSION', 7, { protocol: 'act-pnr-3', session: 1, attended: true, engagement: 0.4, fidelity: 0.8 }),
  ev('PNR_EPISODE', 5, { trigger: 'verbal.deuda', steps: 4, minutes: 40, ended: 'evitacion', peak: 0.8 }),
  ev('PRACTICE_DONE', 4, { probability: 0.5 }),
  ev('PRACTICE_DONE', 3, { probability: 0.5 }),
  ev('PNR_EPISODE', 2, { trigger: 'verbal.deuda', steps: 3, minutes: 30, ended: 'yo', peak: 0.7 }),
];
const facts = (events: readonly WorldEvent[], consult: boolean) => buildPersonView({ view, citizenId: ME, now: NOW, events, ...(consult ? { consult: true } : {}) }).facts;

describe('047 R-013: lo que la persona sabe de sí misma al llegar a consulta', () => {
  const f = facts([...gen.events, ...lived], true);
  const text = f.map((x) => x.text).join('\n');

  it('sabe de sus episodios recientes: cuántos, por qué, cuánto duró el último y cómo terminó (CA-012)', () => {
    const rumia = f.find((x) => x.id === 'RUMIA-RECIENTE')!;
    expect(rumia.level).toBe(2);
    expect(rumia.text).toMatch(/2 veces/);
    expect(rumia.text).toMatch(/la deuda/);
    expect(rumia.text).toMatch(/30 minutos/);
    expect(rumia.text).toMatch(/tomó distancia/);
    expect(rumia.text).toMatch(/una vez se distrajo o se fue a dormir/);
    expect(rumia.text).not.toMatch(/verbal\.|PNR|tope/);
  });

  it('sabe a qué sesión fue y cuántos días practicó desde entonces', () => {
    expect(text).toMatch(/Fue a la sesión 1 con el psicólogo/);
    expect(f.find((x) => x.id === 'PRACTICA')!.text).toMatch(/2 de los 7 días/);
    // Nada interno del estudio llega a su vista.
    expect(text).not.toMatch(/engagement|fidelity|dosis|compromiso/i);
  });

  it('en consulta no carga las líneas de desarrollo que no dicen nada («vivió N episodios de aprendizaje»)', () => {
    expect(text).not.toMatch(/episodios de aprendizaje/);
    expect(facts(gen.events, false).some((x) => /episodios de aprendizaje/.test(x.text))).toBe(true);
  });

  it('fuera de consulta la vista no cambia; y sin episodios ni sesiones no inventa nada', () => {
    const plain = facts([...gen.events, ...lived], false);
    expect(plain.some((x) => x.id === 'RUMIA-RECIENTE' || x.id === 'PRACTICA')).toBe(false);
    const empty = facts(gen.events, true);
    expect(empty.some((x) => x.id === 'RUMIA-RECIENTE' || x.id === 'PRACTICA')).toBe(false);
  });
});
