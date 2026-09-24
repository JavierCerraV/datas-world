import { describe, expect, it } from 'vitest';
import { canEnable, withCapability } from './capabilities.ts';
import { defineColumn } from './components.ts';
import { addCitizen, createWorld, deactivateEntity } from './world.ts';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';

describe('Mundo (spec 001)', () => {
  it('CA-001: la misma configuración crea mundos con el mismo stateHash', () => {
    expect(stateHash(createWorld(testConfig()).world)).toBe(stateHash(createWorld(testConfig()).world));
    expect(stateHash(createWorld(testConfig()).world)).not.toBe(stateHash(createWorld(testConfig({ seed: 1 })).world));
  });

  it('crear el mundo emite WORLD_CREATED con causa en la configuración', () => {
    const { world, events } = createWorld(testConfig());
    expect(events.map((e) => e.type)).toEqual(['WORLD_CREATED']);
    expect(events[0]?.causes.length).toBeGreaterThan(0);
    expect(world).toMatchObject({ id: 'WLD-0001', now: 0, status: 'created', capabilities: ['clock'] });
  });

  it('CA-002: los ids no se reutilizan tras inactivar una entidad', () => {
    const { world } = createWorld(testConfig());
    addCitizen(world);
    addCitizen(world);
    addCitizen(world);
    deactivateEntity(world, 'CIT-000002');
    expect(addCitizen(world)).toBe('CIT-000004');
    expect(world.citizens.get('CIT-000002')?.status).toBe('inactive');
    expect(world.components.u8.active?.[2]).toBe(0);
    expect(world.components.u8.active?.[4]).toBe(1);
  });

  it('CA-003: serializar y deserializar no cambia el hash', () => {
    const { world } = createWorld(testConfig({ holidays: ['2027-01-10'] }));
    defineColumn(world.components, 'f32', 'emo.mood', 0.5);
    for (let i = 0; i < 10; i++) addCitizen(world);
    deactivateEntity(world, 'CIT-000003');
    const copy = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))));
    expect(stateHash(copy)).toBe(stateHash(world));
    expect(copy.components.f32['emo.mood']?.[5]).toBeCloseTo(0.5);
  });

  it('CA-004: la configuración es inmutable', () => {
    const { world } = createWorld(testConfig());
    expect(() => {
      (world.config as { seed: number }).seed = 1;
    }).toThrow();
    expect(() => {
      (world.config.holidays as string[]).push('2027-01-01');
    }).toThrow();
  });

  it('valida la configuración al crear', () => {
    expect(() => createWorld(testConfig({ tickMinutes: 7 }))).toThrow(/1440/);
    expect(() => createWorld(testConfig({ epoch: '2027-01-04T08:00' }))).toThrow(/00:00/);
    expect(() => createWorld(testConfig({ seed: -1 }))).toThrow();
    expect(() => createWorld(testConfig({ initialCapabilities: ['memory'] }))).toThrow();
    expect(() => createWorld(testConfig({ holidays: ['2027-02-30'] }))).toThrow();
  });

  it('el hash cambia cuando cambia el estado', () => {
    const { world } = createWorld(testConfig());
    const h0 = stateHash(world);
    addCitizen(world);
    expect(stateHash(world)).not.toBe(h0);
  });
});

describe('Componentes (spec 001 §3.1)', () => {
  it('CA-008: crecer por encima de la capacidad no altera las filas existentes', () => {
    const { world } = createWorld(testConfig({ population: { target: 1000 } }));
    defineColumn(world.components, 'i32', 'money', 0);
    const cap = world.components.capacity;
    expect(cap).toBe(1024);
    for (let i = 1; i < cap; i++) {
      addCitizen(world);
      world.components.i32.money![i] = i * 3;
    }
    const before = Array.from(world.components.i32.money!.subarray(0, cap));
    const hashBefore = stateHash(world);
    addCitizen(world); // fila 1024: necesita 1025 filas
    expect(world.components.capacity).toBe(2048);
    expect(Array.from(world.components.i32.money!.subarray(0, cap))).toEqual(before);
    deactivateEntity(world, 'CIT-001024');
    expect(stateHash(world)).not.toBe(hashBefore);
  });

  it('el hash no depende de la capacidad reservada (R-010)', () => {
    const a = createWorld(testConfig({ population: { target: 10 } })).world;
    const b = createWorld(testConfig({ population: { target: 10 } })).world;
    for (let i = 0; i < 20; i++) addCitizen(a); // crece por pasos
    for (let i = 0; i < 20; i++) addCitizen(b);
    expect(a.components.capacity).toBe(b.components.capacity);
    expect(stateHash(deserializeWorld(serializeWorld(a)))).toBe(stateHash(b));
  });

  it('define columnas con valor inicial y rechaza duplicados', () => {
    const { world } = createWorld(testConfig());
    addCitizen(world);
    defineColumn(world.components, 'f32', 'need.hunger', 0.25);
    expect(world.components.f32['need.hunger']?.[1]).toBeCloseTo(0.25);
    expect(() => defineColumn(world.components, 'u8', 'need.hunger')).toThrow();
  });
});

describe('Capacidades (spec 001 R-007)', () => {
  it('exige las dependencias activas', () => {
    expect(canEnable(['clock'], 'needs')).toBeNull();
    expect(canEnable(['clock'], 'memory')).toMatch(/relationships/);
    expect(canEnable(['clock', 'needs'], 'needs')).toMatch(/activa/);
  });

  it('mantiene el orden canónico sin importar el orden de activación', () => {
    expect(withCapability(['clock', 'needs', 'economy'], 'routines')).toEqual(['clock', 'needs', 'routines', 'economy']);
  });
});
