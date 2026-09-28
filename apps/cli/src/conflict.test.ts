// citizen:report explica el conflicto con su cadena hasta la charla (spec 044 CA-005).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EntityId, WorldEvent } from '@datas-world/engine';
import { generateWorld, lifeRunner } from '@datas-world/generators';
import { WorldRepository, closeDb, openReadonly, openWorldDb } from '@datas-world/persistence';
import { afterAll, describe, expect, it } from 'vitest';
import { causalChain } from './conflict.ts';
import { citizenLines } from './history.ts';

const DAY = 1440;
const dir = mkdtempSync(join(tmpdir(), 'mundo-conflicto-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('citizen:report con las consecuencias de la charla (044 CA-005)', () => {
  it('muestra la creencia, el vínculo y, por cada conflicto, la cadena hasta lo que oyó en la charla', () => {
    // La primera persona con pareja que, tras oír que su pareja acepta una relación abierta, llega a un encuentro.
    let found: { world: ReturnType<typeof generateWorld>['world']; events: WorldEvent[]; id: EntityId } | undefined;
    const partnered = (() => {
      const { world } = generateWorld({ seed: 482917 });
      return [...world.households.values()].flatMap((h) => h.kinship.filter((k) => k.kind === 'partner').map((k) => k.from)).sort().slice(0, 8);
    })();
    for (const id of partnered) {
      const gen = generateWorld({ seed: 482917 });
      const r = lifeRunner(gen.world);
      r.resume('prueba');
      while (gen.world.now % DAY !== 18 * 60) r.advanceTicks(1);
      r.submit('chat_open', { citizenId: id, visitorId: 'EXT-0001', sessionId: 'CHS-000001' });
      const turns = [{ tone: 'invasivo', stance: 'evadir' }, { tone: 'invasivo', stance: 'poner_limite', claims: [{ predicate: 'consiente_relacion_abierta', about: 'pareja' }] }];
      r.submit('chat_session', { sessionId: 'CHS-000001', citizenId: id, visitorId: 'EXT-0001', turns });
      for (let i = 0; i < DAY / 5 && !gen.world.citizens.get(id)!.bonds?.length; i++) r.advanceTicks(1);
      if (gen.world.citizens.get(id)!.bonds?.length) {
        found = { world: gen.world, events: [...gen.events, ...r.drainEvents()], id };
        break;
      }
    }
    expect(found, 'ninguna de las primeras 8 personas con pareja llegó a un encuentro').toBeDefined();
    const path = join(dir, 'w.db');
    const w = openWorldDb(path);
    new WorldRepository(w).flush({ world: found!.world, events: found!.events });
    closeDb(w);

    const db = openReadonly(path);
    try {
      const world = new WorldRepository(db).loadWorld();
      const lines = citizenLines(world, db, world.citizens.get(found!.id)!);
      const section = lines.slice(lines.indexOf('Creencias, intenciones y vínculos (044)'), lines.indexOf('Línea de vida'));
      expect(section.length, lines.join('\n')).toBeGreaterThan(3);
      expect(section.some((l) => /^ {2}Cree que .*consiente relacion abierta · se lo dijo un visitante \(EXT-0001\)/.test(l))).toBe(true);
      expect(section.some((l) => /^ {2}Vínculo con .*tensión 0\.\d\d · confianza 0\.\d\d/.test(l))).toBe(true);
      // La cadena del conflicto llega hasta lo que oyó en la charla.
      const why = section.findIndex((l) => l.startsWith('  Por qué:'));
      expect(why).toBeGreaterThan(0);
      const chain = section.slice(why + 1).filter((l) => l.startsWith('    '));
      expect(chain.some((l) => / oyó en la charla CHS-000001 /.test(l)), chain.join('\n')).toBe(true);
      const strained = causalChain(db, [...found!.events].reverse().find((e) => e.type === 'BOND_STRAINED')!).map((e) => e.type);
      expect(strained.slice(0, 2)).toEqual(['BOND_STRAINED', 'CONFRONTATION']);
      expect(strained).toContain('CHAT_CLAIM_HEARD');
      expect(strained.at(-1)).toBe('CONVERSATION_HELD');
    } finally {
      closeDb(db);
    }
  }, 120_000);
});
