// Entidad raíz del mundo (spec 001).
import { MINUTES_PER_DAY, parseDate, parseEpoch } from './calendar.ts';
import type { WorldMinute } from './calendar.ts';
import { canonicalOrder, validateCapabilities } from './capabilities.ts';
import type { Capability } from './capabilities.ts';
import { capacityFor, createComponents, ensureCapacity } from './components.ts';
import type { CitizenComponents } from './components.ts';
import { makeEvent } from './events.ts';
import type { WorldEvent } from './events.ts';
import { allocateId, emptyCounters, idKind, idNumber } from './ids.ts';
import type { Counters, EntityId, WorldId } from './ids.ts';
import type { FunctionStore } from './functions/types.ts';
import type { RelationalNetwork } from './relations/types.ts';
import type { Rule } from './rules/rules.ts';
import type { GeoMap } from './geo.ts';
import { checkProfile } from './profile.ts';
import type { CountryProfile } from './profile.ts';
import { createScheduler } from './scheduler.ts';
import type { Scheduler } from './scheduler.ts';

export interface WorldConfig {
  name: string;
  seed: number; // uint32
  epoch: string; // "AAAA-MM-DDT00:00", solo para mostrar y para el calendario
  tickMinutes: number; // divisor de 1440 entre 1 y 60
  currency: { code: string; minorUnit: number };
  population: { target: number };
  engineVersion: string;
  params: Record<string, number>;
  initialCapabilities: Capability[];
  holidays: string[]; // "AAAA-MM-DD"
  /** Perfil de país copiado al crear el mundo (spec 029). Opcional: los mundos de M0 no lo tienen. */
  profile?: CountryProfile;
  /** Versión y hash de cada catálogo usado (ADR-006 §4), por nombre. */
  catalogs?: Record<string, CatalogRef>;
}

export interface CatalogRef {
  version: string;
  hash: string;
}

export type WorldStatus = 'created' | 'running' | 'paused' | 'closed';

/** Base común de las entidades. Las specs de M1 (007, 008, 006, 004, 005) amplían cada tipo. */
export interface BaseEntity {
  id: EntityId;
  status: 'active' | 'inactive';
}
/** Objeto con historia (spec 005). `kind` es una clave de `object_kinds`; el dueño es una persona o un hogar. */
export interface WorldObject extends BaseEntity {
  kind: string;
  name: string;
  ownerId: EntityId;
  marketValue: number;
  condition: number;
  /** Valor emocional por persona, en [0,1]. */
  sentimental: Record<string, number>;
  historyEventIds: EntityId[];
  fate: 'owned' | 'lost' | 'destroyed' | 'sold' | 'given';
}

export type NewObject = Omit<WorldObject, 'id' | 'status' | 'historyEventIds' | 'fate'>;

/** Ocupación de una persona (spec 006 §3). */
export type Occupation =
  | { kind: 'formal'; orgId: EntityId; positionId: string }
  | { kind: 'informal' | 'independent'; trade: string }
  | {
      kind: 'none';
      reason: 'unemployed' | 'student' | 'home_duties' | 'pensioned' | 'other_inactive' | 'minor';
      since: WorldMinute;
    };

/**
 * Ciudadano (spec 007). Los datos numéricos van en columnas (ADR-005). Los campos son opcionales porque
 * `addCitizen` crea filas mínimas para pruebas del motor; `addPerson` exige los de M1.
 */
export interface Citizen extends BaseEntity {
  name?: { given: string; family: [string, string] };
  sex?: 'F' | 'M';
  /** Clave del catálogo `birthplaces` o id del municipio del mundo. */
  birthplace?: string;
  householdId?: EntityId;
  occupation?: Occupation;
  /** Eventos anteriores al presente del mundo, en orden de fecha (007 R-006, INV-003). */
  backstory?: EntityId[];
  /** Genealogía (spec 030): la madre y el padre, vivan o no en el mundo. */
  motherId?: EntityId;
  fatherId?: EntityId;
  /** Antepasado fuera del mundo (spec 030): no vive en el municipio y no se simula. */
  ancestor?: boolean;
  /** Condiciones crónicas (spec 031), en orden de diagnóstico. */
  conditions?: HealthCondition[];
  /** Ficha de esparcimiento (spec 032), en orden de afinidad. */
  leisure?: LeisureInterest[];
  /** Deudas vigentes (015 §3), en orden de creación. */
  debts?: Debt[];
  /** Funciones aprendidas por experiencia directa (036, capa 2 del motor funcional). */
  functions?: FunctionStore;
  /** Red relacional (037, capa 3): relaciones enseñadas entre estímulos. */
  network?: RelationalNetwork;
  /** Reglas (038, capa 4), con su historia de seguimiento. */
  rules?: Rule[];
  /** Llegadas tarde a su trabajo en la ventana de advertencias (006 R-005), con el evento de cada una. */
  jobRecord?: { lates: { eventId: EntityId; at: WorldMinute; minutes: number }[] };
}

/** Afición de la ficha de esparcimiento (spec 032): clave de `leisure_activities`, afinidad y frecuencia. */
export interface LeisureInterest {
  key: string;
  /** [0,1] cuánto le gusta. */
  affinity: number;
  /** Veces al mes, de media (0–30). */
  perMonth: number;
  since: WorldMinute;
  /** Última vez que la hizo (017, 032 R-006): regula la frecuencia en la vida diaria. */
  lastDone?: WorldMinute;
}

/** Condición crónica de la ficha de salud (spec 031): clave de `health_conditions`, fecha y control. */
export interface HealthCondition {
  key: string;
  since: WorldMinute;
  controlled: boolean;
}

export type KinshipKind = 'parent' | 'partner' | 'sibling' | 'grandparent';
/** Parentesco dirigido: "from es <kind> de to" (spec 008). */
export interface Kinship {
  from: EntityId;
  to: EntityId;
  kind: KinshipKind;
}

/** Hogar (spec 008). */
export interface Household extends BaseEntity {
  template: string;
  dwellingId: EntityId;
  memberIds: EntityId[];
  headId?: EntityId;
  kinship: Kinship[];
  caregiverIds: EntityId[];
  /** Tenencia de la vivienda (015 §3); la pone la generación de la economía. */
  tenure?: 'propia' | 'pagando' | 'arriendo' | 'usufructo';
  /** Cuota mensual de la vivienda (arriendo o crédito hipotecario), en COP enteros. */
  rent?: number;
  /** Ahorro del hogar en COP enteros (015 §3). Solo cambia con transferencias (021, parche `transfer`). */
  savings?: number;
}

/** Deuda de una persona (015 §3). `balance` es lo que falta por pagar, en COP enteros. */
export interface Debt {
  id: string; // 'CIT-000012/D03'
  creditor: EntityId | 'banco' | 'gota_a_gota';
  principal: number;
  balance: number;
  /** Tasa mensual (0,019 = 1,9 % al mes). */
  monthlyRate: number;
  /** Cuota: mensual en el banco, diaria en el gota a gota. */
  installment: number;
  period: 'month' | 'day';
  startAt: WorldMinute;
  /** Día del mes en que se paga la cuota mensual. */
  dueDay?: number;
  missed: number;
}

/** Turno de un puesto (spec 006): minutos del día; `lunch` no cuenta como jornada (Ley 2101). */
export interface Shift {
  days: 'mon-fri' | 'mon-sat';
  start: number;
  end: number;
  lunch: number;
}

export interface Position {
  id: string; // "ORG-0001/P01"
  title: string;
  level: number; // 0 = base; el jefe tiene 1
  occupation: string; // clave del catálogo occupations (CIUO-08 A.C.)
  /** Sueldo en la unidad mínima de la moneda; `wagePeriod` dice si es mensual (Colombia) o diario (perfil prototipo). */
  wage: number;
  wagePeriod: 'month' | 'day';
  shift: Shift;
  holderId?: EntityId;
  supervisorPositionId?: string;
}

/** Organización empleadora (spec 006). `sector` es una clave de org_sectors (CIIU Rev. 4 A.C.). */
export interface Organization extends BaseEntity {
  name: string;
  sector: string;
  placeIds: EntityId[];
  positions: Position[];
  culture: { strictness: number; warmth: number; stability: number };
  /** Minuto de fundación (spec 030); los mundos sin historia no lo tienen. */
  foundedAt?: WorldMinute;
  /** Caja en COP enteros (015 R-007). Solo cambia con transferencias (parche `transfer`). */
  cash?: number;
  /** Días seguidos con la caja en negativo (006 R-006); con `crisisDays` del perfil, despide. */
  crisisDays?: number;
}

/** Puesto nuevo: el id lo asigna `addOrganization`; `supervisor` es el índice de otro puesto de la lista. */
export type NewPosition = Omit<Position, 'id' | 'supervisorPositionId' | 'holderId'> & { supervisor?: number };
export type NewOrganization = Omit<Organization, 'id' | 'status' | 'positions'> & { positions: NewPosition[] };

/** Lugar (spec 004) o unidad territorial (spec 003, ADR-006 §3). `kind` es una clave de `place_kinds`. */
export interface Place extends BaseEntity {
  kind: string;
  name: string;
  /** Padre en la jerarquía: barrio → comuna → municipio → departamento; vivienda → edificio. */
  parentId?: EntityId;
  /** Barrio al que pertenece (003 R-003). En un barrio, él mismo. */
  districtId?: EntityId;
  /** Área en tiles. */
  rect?: { x: number; y: number; w: number; h: number };
  /** Puerta, sobre una calle. */
  door?: { x: number; y: number };
  /** Código territorial ficticio (ADR-006 §2). */
  divipola?: string;
  /** Estrato 1–6 (Ley 142 de 1994); solo en barrios. */
  stratum?: number;
  /** Minuto de fundación o construcción (spec 030); los mundos sin historia no lo tienen. */
  foundedAt?: WorldMinute;
  /** [0,1]; solo en barrios. */
  safety?: number;
  /** Personas a la vez; en una vivienda, residentes máximos (spec 004). */
  capacity?: number;
  /** Horario público (spec 004): minutos del día; `null` = privado (viviendas); '24h' = siempre abierto. */
  openingHours?: OpeningHours;
  /** Lugar regional, fuera del mapa (spec 033): viaje de ida desde el municipio, en minutos y en dinero. */
  travel?: { minutes: number; cost: number };
}

/**
 * `close` puede pasar de la medianoche hasta `LATE_CLOSE_LIMIT` (p. ej. 1560 = 02:00 del día siguiente),
 * para bares y discotecas (033 R-004).
 */
export type OpeningHours = { days: 'all' | 'mon-fri' | 'mon-sat'; open: number; close: number } | '24h' | null;
/** Cierre más tardío admitido: las 06:00 del día siguiente. */
export const LATE_CLOSE_LIMIT = MINUTES_PER_DAY + 360;

export type NewPlace = Omit<Place, 'id' | 'status'>;

export interface World {
  id: WorldId;
  config: Readonly<WorldConfig>;
  now: WorldMinute;
  status: WorldStatus;
  counters: Counters;
  capabilities: Capability[];
  citizens: Map<EntityId, Citizen>;
  households: Map<EntityId, Household>;
  organizations: Map<EntityId, Organization>;
  places: Map<EntityId, Place>;
  objects: Map<EntityId, WorldObject>;
  components: CitizenComponents;
  scheduler: Scheduler;
  /** Mapa (spec 003). No cambia después de generarse (INV-002). Los mundos de M0 no lo tienen. */
  geo?: GeoMap;
  /**
   * Cuentas del sistema (015 §3): el "resto del país", fuente y sumidero de todo el dinero que entra o sale del
   * mundo (puede ser negativo). Solo existe en los mundos con economía; los anteriores no la tienen y su hash no cambia.
   */
  accounts?: { restOfCountry: number };
}

const deepFreeze = <T>(v: T): T => {
  if (typeof v === 'object' && v !== null) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
};

export function validateConfig(c: WorldConfig): void {
  if (!Number.isSafeInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff)
    throw new RangeError(`Semilla no es uint32: ${c.seed}`);
  const t = c.tickMinutes;
  if (!Number.isInteger(t) || t < 1 || t > 60 || MINUTES_PER_DAY % t !== 0) {
    throw new RangeError(`tickMinutes debe ser un divisor de 1440 entre 1 y 60: ${t}`);
  }
  const e = parseEpoch(c.epoch);
  if (e.hour !== 0 || e.minute !== 0) throw new RangeError(`El epoch debe empezar a las 00:00: ${c.epoch}`);
  if (!Number.isInteger(c.population.target) || c.population.target < 0)
    throw new RangeError('population.target inválido');
  if (!Number.isInteger(c.currency.minorUnit) || c.currency.minorUnit < 1)
    throw new RangeError('currency.minorUnit inválido');
  const bad = validateCapabilities(c.initialCapabilities);
  if (bad) throw new RangeError(`initialCapabilities: ${bad}`);
  if (!c.initialCapabilities.includes('clock')) throw new RangeError('initialCapabilities debe incluir clock');
  c.holidays.forEach(parseDate);
  for (const [k, v] of Object.entries(c.params))
    if (!Number.isFinite(v)) throw new RangeError(`params.${k} no es finito`);
  if (c.profile) {
    const bad = checkProfile(c.profile);
    if (bad) throw new RangeError(`profile ${c.profile.id}: ${bad}`);
    if (c.profile.currency.code !== c.currency.code)
      throw new RangeError('La moneda del perfil y la del mundo no coinciden');
  }
  for (const [name, ref] of Object.entries(c.catalogs ?? {})) {
    if (!ref.version || !/^[0-9a-f]{16}$/.test(ref.hash))
      throw new RangeError(`catalogs.${name}: versión o hash inválidos`);
  }
}

/** Estructura vacía de un mundo (sin evento). La usan createWorld y la deserialización. */
export function emptyWorld(config: WorldConfig, id: WorldId): World {
  validateConfig(config);
  const frozen = deepFreeze(structuredClone(config));
  return {
    id,
    config: frozen,
    now: 0,
    status: 'created',
    counters: emptyCounters(),
    capabilities: canonicalOrder(frozen.initialCapabilities),
    citizens: new Map(),
    households: new Map(),
    organizations: new Map(),
    places: new Map(),
    objects: new Map(),
    components: createComponents(capacityFor(frozen.population.target + 1)),
    scheduler: createScheduler(),
  };
}

export function createWorld(config: WorldConfig, id: WorldId = 'WLD-0001'): { world: World; events: WorldEvent[] } {
  const world = emptyWorld(config, id);
  const created = makeEvent(world.counters, 0, {
    type: 'WORLD_CREATED',
    payload: { name: world.config.name, seed: world.config.seed },
    causes: [{ state: 'world_config', weight: 1 }],
    origin: 'external',
  });
  return { world, events: [created] };
}

/**
 * Alta de un lugar o unidad territorial (specs 003, 004). Valida que el padre y el barrio existan, que el
 * rectángulo y la puerta caigan dentro del mapa y que el estrato sea 1–6. Devuelve el nuevo id PLC.
 */
export function addPlace(world: World, data: NewPlace): EntityId {
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(data.kind)) throw new Error(`Tipo de lugar inválido: ${data.kind}`);
  if (!data.name.trim()) throw new Error('Un lugar necesita nombre');
  for (const ref of [data.parentId, data.districtId]) {
    if (ref !== undefined && !world.places.has(ref)) throw new Error(`No existe el lugar ${ref}`);
  }
  const g = world.geo;
  if (data.rect) {
    const r = data.rect;
    if (!g || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > g.width || r.y + r.h > g.height) {
      throw new RangeError(`Rectángulo fuera del mapa: ${JSON.stringify(r)}`);
    }
  }
  if (data.door && (!g || data.door.x < 0 || data.door.y < 0 || data.door.x >= g.width || data.door.y >= g.height)) {
    throw new RangeError(`Puerta fuera del mapa: ${JSON.stringify(data.door)}`);
  }
  if (data.stratum !== undefined && !(Number.isInteger(data.stratum) && data.stratum >= 1 && data.stratum <= 6)) {
    throw new RangeError(`Estrato inválido: ${data.stratum}`);
  }
  if (data.safety !== undefined && !(data.safety >= 0 && data.safety <= 1))
    throw new RangeError('safety fuera de [0,1]');
  if (data.capacity !== undefined && !(Number.isInteger(data.capacity) && data.capacity >= 1)) {
    throw new RangeError(`Capacidad inválida: ${data.capacity}`);
  }
  const h = data.openingHours;
  if (h !== undefined && h !== null && h !== '24h') {
    const okDays = h.days === 'all' || h.days === 'mon-fri' || h.days === 'mon-sat';
    const okRange =
      Number.isInteger(h.open) && Number.isInteger(h.close) && h.open >= 0 && h.open < MINUTES_PER_DAY && h.close <= LATE_CLOSE_LIMIT;
    if (!okDays || !okRange || h.open >= h.close) throw new RangeError(`Horario inválido: ${JSON.stringify(h)}`);
  }
  if (data.travel !== undefined) {
    const t = data.travel;
    if (!(Number.isInteger(t.minutes) && t.minutes > 0 && Number.isInteger(t.cost) && t.cost >= 0) || data.rect)
      throw new RangeError(`Viaje inválido (solo lugares fuera del mapa): ${JSON.stringify(t)}`);
  }
  const id = allocateId(world.counters, 'PLC');
  world.places.set(id, { ...structuredClone(data), id, status: 'active' });
  return id;
}

const KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const unit = (v: number) => v >= 0 && v <= 1;

/**
 * Alta de una organización con sus puestos (spec 006). Valida lugares, claves de sector y ocupación,
 * sueldos enteros ≥ 0, turnos dentro del día (con almuerzo menor que el turno), niveles, supervisores
 * y cultura en [0,1]. Asigna los ids de los puestos ("ORG-0001/P01"…).
 */
export function addOrganization(world: World, data: NewOrganization): EntityId {
  if (!data.name.trim()) throw new Error('Una organización necesita nombre');
  if (!KEY_RE.test(data.sector)) throw new Error(`Sector inválido: ${data.sector}`);
  if (data.placeIds.length === 0) throw new Error(`${data.name}: una organización necesita al menos un lugar`);
  for (const p of data.placeIds) if (!world.places.has(p)) throw new Error(`No existe el lugar ${p}`);
  const c = data.culture;
  if (!unit(c.strictness) || !unit(c.warmth) || !unit(c.stability)) throw new RangeError('Cultura fuera de [0,1]');
  data.positions.forEach((p, i) => {
    const s = p.shift;
    const where = `${data.name}, puesto ${i + 1}`;
    if (!KEY_RE.test(p.occupation) || !p.title.trim()) throw new Error(`${where}: ocupación o título inválidos`);
    if (!Number.isSafeInteger(p.wage) || p.wage < 0) throw new RangeError(`${where}: sueldo inválido (${p.wage})`);
    if (!Number.isInteger(p.level) || p.level < 0) throw new RangeError(`${where}: nivel inválido`);
    const shiftOk =
      s.start >= 0 && s.end <= MINUTES_PER_DAY && s.start < s.end && s.lunch >= 0 && s.lunch < s.end - s.start;
    if (!shiftOk || (s.days !== 'mon-fri' && s.days !== 'mon-sat')) throw new RangeError(`${where}: turno inválido`);
    if (p.supervisor !== undefined && (p.supervisor === i || !data.positions[p.supervisor])) {
      throw new RangeError(`${where}: supervisor inválido`);
    }
  });
  const id = allocateId(world.counters, 'ORG');
  const posId = (i: number) => `${id}/P${String(i + 1).padStart(2, '0')}`;
  const positions: Position[] = data.positions.map(({ supervisor, ...p }, i) => ({
    ...structuredClone(p),
    id: posId(i),
    ...(supervisor !== undefined ? { supervisorPositionId: posId(supervisor) } : {}),
  }));
  world.organizations.set(id, { ...structuredClone({ ...data, positions: [] }), positions, id, status: 'active' });
  return id;
}

/** Alta mínima de un ciudadano con su fila de componentes. La generación real llega con la spec 007 (M1). */
export function addCitizen(world: World): EntityId {
  const id = allocateId(world.counters, 'CIT');
  const row = idNumber(id);
  ensureCapacity(world.components, row + 1);
  world.components.u8.active![row] = 1;
  world.citizens.set(id, { id, status: 'active' });
  return id;
}

/** Alta de un hogar vacío en una vivienda libre (spec 008). Los miembros se añaden con `addPerson`. */
export function addHousehold(world: World, data: { template: string; dwellingId: EntityId }): EntityId {
  if (!KEY_RE.test(data.template)) throw new Error(`Plantilla de hogar inválida: ${data.template}`);
  if (!world.places.has(data.dwellingId)) throw new Error(`No existe la vivienda ${data.dwellingId}`);
  for (const h of world.households.values()) {
    if (h.dwellingId === data.dwellingId) throw new Error(`La vivienda ${data.dwellingId} ya tiene el hogar ${h.id}`);
  }
  const id = allocateId(world.counters, 'HOU');
  world.households.set(id, { id, status: 'active', ...data, memberIds: [], kinship: [], caregiverIds: [] });
  return id;
}

export interface NewPerson {
  name: { given: string; family: [string, string] };
  sex: 'F' | 'M';
  birthplace: string;
  householdId: EntityId;
}

/**
 * Alta de una persona de M1 (spec 007) en su hogar: crea la fila de componentes (como `addCitizen`) y la
 * añade a los miembros del hogar. Las columnas de datos (nacimiento, educación…) las escribe el generador.
 */
export function addPerson(world: World, data: NewPerson): EntityId {
  const household = world.households.get(data.householdId);
  if (!household) throw new Error(`No existe el hogar ${data.householdId}`);
  if (!data.name.given.trim() || data.name.family.some((f) => !f.trim())) throw new Error('Nombre incompleto');
  if (data.sex !== 'F' && data.sex !== 'M') throw new Error(`Sexo inválido: ${String(data.sex)}`);
  const id = addCitizen(world);
  world.citizens.set(id, { id, status: 'active', ...structuredClone(data), backstory: [] });
  household.memberIds.push(id);
  return id;
}

/** Cierra la composición de un hogar: cabeza, parentesco y cuidadores, todos miembros del hogar (008 INV-002). */
export function completeHousehold(
  world: World,
  householdId: EntityId,
  data: { headId: EntityId; kinship: Kinship[]; caregiverIds: EntityId[] },
): void {
  const h = world.households.get(householdId);
  if (!h) throw new Error(`No existe el hogar ${householdId}`);
  const member = (id: EntityId) => h.memberIds.includes(id);
  if (!member(data.headId)) throw new Error(`${data.headId} no es miembro de ${householdId}`);
  for (const k of data.kinship) {
    if (!member(k.from) || !member(k.to) || k.from === k.to) throw new Error(`Parentesco inválido en ${householdId}`);
  }
  for (const c of data.caregiverIds) if (!member(c)) throw new Error(`${c} no es miembro de ${householdId}`);
  h.headId = data.headId;
  h.kinship = structuredClone(data.kinship);
  h.caregiverIds = [...data.caregiverIds];
}

const collectionFor = (world: World, id: EntityId): Map<EntityId, BaseEntity> => {
  const kind = idKind(id);
  const map = {
    CIT: world.citizens,
    HOU: world.households,
    ORG: world.organizations,
    PLC: world.places,
    OBJ: world.objects,
  }[kind as 'CIT'];
  if (!map) throw new Error(`El tipo ${kind} no es una colección del mundo`);
  return map;
};

/** R-003: una entidad nunca se borra; pasa a `inactive`. El evento lo emite quien la inactiva (spec de su dominio). */
export function deactivateEntity(world: World, id: EntityId): void {
  const entity = collectionFor(world, id).get(id);
  if (!entity) throw new Error(`No existe ${id}`);
  entity.status = 'inactive';
  if (idKind(id) === 'CIT') world.components.u8.active![idNumber(id)] = 0;
}
