import { describe, expect, it } from 'vitest';
import { deserializeWorld, serializeWorld, stateHash } from './serialize.ts';
import { testConfig } from './testing.ts';
import { addOrganization, addPlace, createWorld } from './world.ts';
import type { NewOrganization, NewPosition } from './world.ts';

const pos = (over: Partial<NewPosition> = {}): NewPosition => ({
  title: 'Oficinista',
  level: 0,
  occupation: 'ciuo.4110',
  wage: 1_750_905,
  wagePeriod: 'month',
  shift: { days: 'mon-fri', start: 420, end: 984, lunch: 60 },
  ...over,
});

function setup() {
  const { world } = createWorld(testConfig());
  const place = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas Andina' });
  const org = (over: Partial<NewOrganization> = {}): NewOrganization => ({
    name: 'Oficinas Andina',
    sector: 'ciiu.7020',
    placeIds: [place],
    positions: [
      pos({ title: 'Director', level: 1, occupation: 'ciuo.1219' }),
      pos({ supervisor: 0 }),
      pos({ supervisor: 0 }),
    ],
    culture: { strictness: 0.5, warmth: 0.6, stability: 0.7 },
    ...over,
  });
  return { world, org };
}

describe('addOrganization (spec 006)', () => {
  it('asigna ids a la organización y a sus puestos, con el supervisor por id', () => {
    const { world, org } = setup();
    const id = addOrganization(world, org());
    const o = world.organizations.get(id)!;
    expect(id).toBe('ORG-0001');
    expect(o.positions.map((p) => p.id)).toEqual(['ORG-0001/P01', 'ORG-0001/P02', 'ORG-0001/P03']);
    expect(o.positions[1]!.supervisorPositionId).toBe('ORG-0001/P01');
    expect(o.positions[0]!.supervisorPositionId).toBeUndefined();
    expect(stateHash(deserializeWorld(serializeWorld(world)))).toBe(stateHash(world));
  });

  it('rechaza lugares inexistentes, sueldos, turnos, supervisores y cultura inválidos', () => {
    const { world, org } = setup();
    expect(() => addOrganization(world, org({ placeIds: ['PLC-0099'] }))).toThrow(/No existe/);
    expect(() => addOrganization(world, org({ placeIds: [] }))).toThrow(/al menos un lugar/);
    expect(() => addOrganization(world, org({ sector: 'CIIU 7020' }))).toThrow(/Sector/);
    expect(() => addOrganization(world, org({ positions: [pos({ wage: 1.5 })] }))).toThrow(/sueldo/);
    expect(() =>
      addOrganization(world, org({ positions: [pos({ shift: { days: 'mon-fri', start: 900, end: 600, lunch: 0 } })] })),
    ).toThrow(/turno/);
    expect(() =>
      addOrganization(
        world,
        org({ positions: [pos({ shift: { days: 'mon-fri', start: 420, end: 480, lunch: 60 } })] }),
      ),
    ).toThrow(/turno/);
    expect(() => addOrganization(world, org({ positions: [pos({ supervisor: 0 })] }))).toThrow(/supervisor/);
    expect(() => addOrganization(world, org({ culture: { strictness: 2, warmth: 0, stability: 0 } }))).toThrow(
      /Cultura/,
    );
    expect(world.organizations.size).toBe(0);
  });
});
