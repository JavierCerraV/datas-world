// 035 CA-001: la cadena del documento rector §12 para 20 conductas al azar de un mundo de 200 personas × 30 días.
import { createRng } from '@datas-world/engine';
import type { WorldEvent } from '@datas-world/engine';
import { generateWorld, lifeRunner } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { behaviorChain, isChosenBehavior, isComplete } from './explain.ts';

describe('035 CA-001: la cadena completa de una conducta', () => {
  it('para 20 conductas elegidas al azar, la cadena llega a los hechos del registro o del desarrollo sin pasos vacíos', () => {
    const g = generateWorld({ seed: 482917 });
    const r = lifeRunner(g.world);
    r.resume('prueba');
    r.advanceDays(30);
    const all: WorldEvent[] = [...g.events, ...r.drainEvents()];
    const byId = new Map(all.map((e) => [e.id as string, e]));
    const chosen = all.filter(isChosenBehavior);
    expect(chosen.length).toBeGreaterThan(100);
    const rng = createRng(35);
    const incomplete: string[] = [];
    for (let k = 0; k < 20; k++) {
      const e = chosen[rng.int(0, chosen.length - 1)]!;
      const steps = behaviorChain(g.world, (id) => byId.get(id), e);
      expect(steps.map((s) => s.step)).toEqual([
        'Qué emite', 'Contexto', 'Fuentes de control', 'Repertorio', 'Estímulos con función hoy', 'Relaciones aprendidas', 'Qué ocurrió', 'Qué recibe', 'Cómo cambia su historia',
      ]);
      if (!isComplete(steps)) incomplete.push(`${e.id}: ${steps.filter((s) => s.lines.length === 0).map((s) => s.step).join(', ')}`);
    }
    expect(incomplete, incomplete.join('\n')).toEqual([]);
  });
});
