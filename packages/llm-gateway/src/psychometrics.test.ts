// Spec 045 R-012, R-013 (CA-009, CA-010): el LLM expresa dentro del rango que decidió el motor; el motor valida.
import { INSTRUMENTS } from '@datas-world/engine';
import type { WorldEvent, WorldView } from '@datas-world/engine';
import { generateWorld } from '@datas-world/generators';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config.ts';
import { Gateway } from './gateway.ts';
import { mockAdapter } from './providers/mock.ts';
import type { MockResponder } from './providers/mock.ts';
import { buildPersonView } from './chat/view.ts';
import { administerBattery, administerInstrument, itemsText } from './psychometrics.ts';
import type { ItemPlan } from './psychometrics.ts';
import type { GatewayConfig, ModelConfig } from './types.ts';

const gen = generateWorld({ seed: 482917 });
const view = gen.world as unknown as WorldView;
const events: readonly WorldEvent[] = gen.events;
const pv = buildPersonView({ view, citizenId: 'CIT-000019', now: 9355, events });
const ins = INSTRUMENTS.SWLS;
const plan: ItemPlan[] = [
  { n: 1, target: 3, disposition: 'fiel' }, { n: 2, target: 5, disposition: 'minimiza' }, { n: 3, target: 2, disposition: 'exagera' },
  { n: 4, target: 6, disposition: 'miente' }, { n: 5, target: 4, disposition: 'impreciso' },
];

const mock: ModelConfig = { provider: 'mock', model: 'm', temperature: 0, maxOutputTokens: 4000, timeoutMs: 5_000 };
const gw = (responder: MockResponder, purposes: Partial<GatewayConfig['purposes']> = {}) =>
  new Gateway({ config: { ...DEFAULT_CONFIG, purposes: { ...DEFAULT_CONFIG.purposes, dialogue: mock, ...purposes } }, adapters: { mock: mockAdapter(responder) } });
const answers = (opts: number[]) => JSON.stringify({ answers: opts.map((option, i) => ({ n: i + 1, reply: `respuesta ${i + 1}`, option })) });

describe('045 R-012: la charla con el LLM la valida el motor (CA-009)', () => {
  it('una opción dentro del rango se respeta; fuera del rango, el motor usa la decidida y lo anota', async () => {
    const out = await administerInstrument(gw(() => answers([4, 5, 5, 3, 4])), pv, ins, plan);
    expect(out.map((a) => [a.option, a.source])).toEqual([[4, 'llm'], [5, 'llm'], [2, 'corregida'], [6, 'corregida'], [4, 'llm']]);
    expect(out[0]!.reply).toBe('respuesta 1');
  });

  it('con el proveedor caído o una salida inválida, usa lo decidido con plantilla (R-013)', async () => {
    const off = await administerInstrument(gw(() => 'esto no es JSON'), pv, ins, plan);
    expect(off.every((a) => a.source === 'plantilla')).toBe(true);
    expect(off.map((a) => a.option)).toEqual([3, 5, 2, 6, 4]);
    const disabled = await administerInstrument(gw(() => answers([3, 5, 2, 6, 4]), { dialogue: null }), pv, ins, plan);
    expect(disabled.every((a) => a.source === 'plantilla')).toBe(true);
  });

  it('un ítem que falta en la respuesta cae a la plantilla', async () => {
    const some = JSON.stringify({ answers: [{ n: 1, reply: 'ok', option: 3 }] });
    const out = await administerInstrument(gw(() => some), pv, ins, plan);
    expect(out.map((a) => a.source)).toEqual(['llm', 'plantilla', 'plantilla', 'plantilla', 'plantilla']);
  });
});

describe('045 R-012: varias pruebas en una llamada', () => {
  const parts = [{ ins: INSTRUMENTS.SWLS, plan }, { ins: INSTRUMENTS['DASS-21'], plan: [{ n: 1, target: 0, disposition: 'fiel' as const }, { n: 2, target: 3, disposition: 'miente' as const }] }];

  it('cada respuesta se asigna a su prueba y se valida con el rango de su escala', async () => {
    const reply = JSON.stringify({ answers: [
      ...[3, 5, 2, 6, 4].map((option, i) => ({ q: 'SWLS', n: i + 1, reply: 'ok', option })),
      { q: 'DASS-21', n: 1, reply: 'nada', option: 1 }, { q: 'DASS-21', n: 2, reply: 'harto', option: 0 },
    ] });
    const out = await administerBattery(gw(() => reply), pv, parts);
    expect(out.SWLS!.map((a) => a.source)).toEqual(['llm', 'llm', 'llm', 'llm', 'llm']);
    expect(out['DASS-21']!.map((a) => [a.option, a.source])).toEqual([[1, 'llm'], [3, 'corregida']]);
  });

  it('un ítem que falta cae a plantilla con su causa; sin proveedor, todos', async () => {
    const some = JSON.stringify({ answers: [{ q: 'SWLS', n: 1, reply: 'ok', option: 3 }] });
    const out = await administerBattery(gw(() => some), pv, parts);
    expect(out.SWLS![1]!.source).toBe('plantilla');
    const off = await administerBattery(gw(() => 'no es json', {}), pv, parts);
    expect(Object.values(off).flat().every((a) => a.source === 'plantilla' && a.why)).toBe(true);
  });
});

describe('045 CA-010: lo que ve el LLM', () => {
  it('lleva el ítem, las opciones, el rango y cómo responde; no lleva la respuesta verdadera ni los indicadores', async () => {
    const seen: string[] = [];
    await administerInstrument(gw((c) => (seen.push(c.system.map((p) => p.text).join('\n'), ...c.messages.map((m) => m.text)), answers([3, 5, 2, 6, 4]))), pv, ins, plan);
    const prompt = seen.join('\n');
    expect(prompt).toContain('Estoy satisfecho con mi vida');
    expect(prompt).toContain('RANGO 4-6');
    expect(prompt).toMatch(/quitarle peso/);
    expect(prompt).not.toMatch(/verdader[oa]\s*[:=]|target|disposition|minimiza|approvalValue|avoidance|aversiveBurden/);
    expect(prompt).not.toContain('isTrue');
  });

  it('el rango se acota a la escala', () => {
    const text = itemsText(INSTRUMENTS['DASS-21'], [{ n: 1, target: 0, disposition: 'fiel' }, { n: 2, target: 3, disposition: 'fiel' }]);
    expect(text).toContain('RANGO 0-1');
    expect(text).toContain('RANGO 2-3');
  });
});
