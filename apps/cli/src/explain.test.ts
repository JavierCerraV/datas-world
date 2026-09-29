// 035 CA-001: la cadena del documento rector §12 para 20 conductas al azar de un mundo de 200 personas × 30 días.
import { createRng, why, whyLines } from '@datas-world/engine';
import type { WorldEvent } from '@datas-world/engine';
import { generateWorld, lifeRunner } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { behaviorChain, isChosenBehavior, isComplete, relationshipChain } from './explain.ts';

let cached: { g: ReturnType<typeof generateWorld>; all: WorldEvent[]; byId: Map<string, WorldEvent> } | undefined;
/** El mundo de la semilla del proyecto tras 30 días, una vez para las dos pruebas. */
function lived() {
  if (cached) return cached;
  const g = generateWorld({ seed: 482917 });
  const r = lifeRunner(g.world);
  r.resume('prueba');
  r.advanceDays(30);
  const all: WorldEvent[] = [...g.events, ...r.drainEvents()];
  cached = { g, all, byId: new Map(all.map((e) => [e.id as string, e])) };
  return cached;
}

describe('035 CA-001: la cadena completa de una conducta', () => {
  it('para 20 conductas elegidas al azar, la cadena llega a los hechos del registro o del desarrollo sin pasos vacíos', () => {
    const { g, all, byId } = lived();
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

describe('019 R-004, R-006: el árbol de causas de una conducta', () => {
  it('llega, por sus fuentes de control, a los hechos que formaron hoy esas funciones', () => {
    const { g, all, byId } = lived();
    const chosen = all.filter((e) => e.at >= 0 && isChosenBehavior(e));
    const reached = chosen.slice(0, 50).filter((e) => {
      const tree = why((x) => byId.get(x), e.id, { depth: 3, minWeight: 0, view: g.world })!;
      return whyLines(tree).some((l) => l.includes('origen actual de esa función'));
    });
    expect(reached.length).toBeGreaterThan(25);
  });
});

describe('012 CA-005: la cadena de una discusión', () => {
  it('llega hasta los roces que subieron la tensión, con el vínculo de cada lado', () => {
    const { g, all, byId } = lived();
    const args = all.filter((e) => e.type === 'ARGUMENT');
    expect(args.length).toBeGreaterThan(0);
    const reached = args.filter((e) => {
      const steps = relationshipChain(g.world, (id) => byId.get(id), e);
      expect(steps.map((s) => s.step)).toEqual(['Qué pasa', 'Qué lo explica ahora', 'El vínculo de cada lado', 'Historia del par']);
      expect(isComplete(steps)).toBe(true);
      return steps[3]!.lines.some((l) => l.includes('tienen un roce'));
    });
    expect(reached.length / args.length).toBeGreaterThanOrEqual(0.5);
  });
});
