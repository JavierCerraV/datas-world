import { describe, expect, it } from 'vitest';
import { pnrProtocol } from './private.ts';
import type { PnrResult } from './private.ts';

// 042 V-10 y 039 CA-001 a CA-003: el bucle de PNR con 10 disparos («no puedo confiar en él»), uno por día.
const later = (r: PnrResult) => r.perTrigger.slice(1);
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const minutesPerEpisode = (r: PnrResult) => sum(r.perTrigger.map((t) => t.minutes)) / Math.max(1, sum(r.perTrigger.map((t) => t.episodes)));

describe('042 V-10: bucle de PNR (039 CA-001 a CA-003)', () => {
  const avoid = pnrProtocol('evitacion');
  const stay = pnrProtocol('exposicion');
  const self = pnrProtocol('yo');

  it('CA-001: con la evitación reforzada, tras el primer disparo los episodios vuelven más veces y duran más que quedándose con el pensamiento', () => {
    expect(sum(later(avoid).map((t) => t.episodes))).toBeGreaterThan(sum(later(stay).map((t) => t.episodes)));
    expect(sum(later(avoid).map((t) => t.minutes))).toBeGreaterThan(sum(later(stay).map((t) => t.minutes)));
    // Y la evitación se fortalece con el alivio (036 R-002).
    expect(avoid.avoidance).toBeGreaterThan(0.4);
  });

  it('CA-001: con el enmarque jerárquico con «Yo» reforzado (y un valor al alcance), los episodios se acortan', () => {
    expect(minutesPerEpisode(self)).toBeLessThan(minutesPerEpisode(avoid) / 3);
    expect(self.self).toBeGreaterThan(0.5);
  });

  it('CA-002 (042 V-6): la evitación conserva la función aversiva del disparador; quedarse con el pensamiento la extingue (con recuperación espontánea después, 036)', () => {
    const mean = (r: PnrResult) => sum(r.perTrigger.map((t) => t.triggerFn)) / r.perTrigger.length;
    expect(Math.max(...avoid.perTrigger.map((t) => t.triggerFn))).toBeLessThan(-0.4);
    expect(stay.perTrigger[0]!.triggerFn).toBeGreaterThan(-0.1);
    expect(mean(avoid)).toBeLessThan(mean(stay) - 0.1);
  });

  it('CA-003: con el mismo temperamento, quien aprendió a tomar distancia rumia menos y su respuesta se refuerza por el valor', () => {
    expect(sum(self.perTrigger.map((t) => t.minutes))).toBeLessThan(sum(avoid.perTrigger.map((t) => t.minutes)));
    expect(self.self).toBeGreaterThan(avoid.self);
  });

  it('039 R-005: los bucles consolidan la red: más compleja y menos derivada', () => {
    for (const r of [avoid, stay, self]) {
      expect(r.after.complexity).toBeGreaterThan(r.before.complexity);
      expect(r.after.derivationLevel).toBeLessThan(r.before.derivationLevel);
    }
  });

  it('es determinista con la misma semilla', () => {
    expect(JSON.stringify(pnrProtocol('evitacion'))).toBe(JSON.stringify(avoid));
  });
});
