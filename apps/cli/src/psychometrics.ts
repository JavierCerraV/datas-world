// `pnpm cli psychometrics` (spec 045): aplica AAQ-II, GHQ-12, GPQ-9, GTQ, DASS-21 y SWLS a una muestra de adultos en tres
// tomas (hoy, +30 días, +1 año) sobre una COPIA de la base (el mundo en marcha no se toca) y escribe un Excel y un JSON.
// La respuesta verdadera y la disposición las decide el motor; el LLM las expresa como charla y el motor las valida.
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { INSTRUMENTS, INSTRUMENT_IDS, MINUTES_PER_DAY, N_SAMPLE, adults, createRng, dispose, indicatorsOf, scoreInstrument, selectSample, stateHash, truthfulResponses } from '@datas-world/engine';
import type { EntityId, InstrumentId, Participant, World, WorldEvent } from '@datas-world/engine';
import { lifeRunner, loadCatalogs } from '@datas-world/generators';
import { DEFAULT_CONFIG, Gateway, MemoryRecordStore, administerBattery, administerInstrument, anthropicAdapter, buildPersonView, chatCatalogs, mockAdapter, openaiCompatibleAdapter, parseConfig } from '@datas-world/llm-gateway';
import type { GatewayConfig, ItemAnswer, ItemPlan, MockResponder, ModelConfig, PersonView, ProviderAdapter } from '@datas-world/llm-gateway';
import { WorldRepository, WorldSession, acquireWriterLock, openReadonly, openWorldDb, queryEvents, releaseWriterLock, trajectoryOf } from '@datas-world/persistence';
import { DEFAULT_DB, UsageError, dateOf, toInt, withDb } from './common.ts';
import type { Io } from './common.ts';
import { reportFor } from './life.ts';
import { workbookOf } from './psychometrics-report.ts';
import type { Battery, InstrumentRecord, TakeRecord } from './psychometrics-report.ts';

const EVENTS_OF_INTEREST = new Set([
  'JOB_HIRED', 'INFORMAL_WORK_STARTED', 'JOB_WARNING', 'JOB_LOST', 'RETIRED', 'FELL_ILL', 'RECOVERED', 'RENT_LATE', 'DEBT_TAKEN', 'DEBT_REPAID', 'PAYMENT_MISSED',
  'STRESS_PEAK', 'CONDITION_DIAGNOSED', 'FRIENDSHIP_FORMED', 'ARGUMENT', 'RELATIONSHIP_STARTED', 'BREAKUP', 'CONFRONTATION', 'BOND_STRAINED', 'PNR_EPISODE',
  'UNION_FORMED', 'MIGRATED', 'CITIZEN_DIED', 'LEISURE_TAKEN_UP', 'HOUSEHOLD_FORMED', 'OBJECT_LOST',
]);

/** 300 llamadas de unos 5 000 tokens: el tope diario de la charla (2 M) se queda corto para una batería. */
const BATTERY_TOKENS = 6_000_000;

/** Proveedor determinista: elige el centro del rango permitido de cada ítem (si no hay centro, un extremo según el ítem, para no sesgar). */
const mockResponder: MockResponder = (c) => {
  const text = c.messages.at(-1)?.text ?? '';
  const parse = (body: string, q?: string) => [...body.matchAll(/ÍTEM (\d+):[\s\S]*?Opciones: (\d+) = [\s\S]*?(\d+) = [^;\n]*\.\n\s*RANGO (\d+)-(\d+)/g)].map((m) => {
    const [n, min, max, lo, hi] = m.slice(1).map(Number) as [number, number, number, number, number];
    // Con rango par es que el objetivo está en un extremo de la escala: se queda en él.
    const option = (lo + hi) % 2 === 0 ? (lo + hi) / 2 : lo === min ? lo : hi === max ? hi : lo;
    return { ...(q ? { q } : {}), n, reply: `Pues más o menos, ${option}.`, option };
  });
  // Varias pruebas en una llamada: `=== PRUEBA <id> ===` separa las secciones.
  const parts = text.split(/=== PRUEBA (\S+) ===\n/);
  const answers = parts.length === 1 ? parse(text) : Array.from({ length: (parts.length - 1) / 2 }, (_, i) => parse(parts[2 + 2 * i]!, parts[1 + 2 * i]!)).flat();
  return JSON.stringify({ answers });
};

function gatewayFor(provider: string): Gateway {
  // Cada instrumento va en una llamada: más salida y más tiempo que una réplica de charla.
  const big = (m: ModelConfig): ModelConfig => ({ ...m, maxOutputTokens: 16_000, timeoutMs: 300_000, temperature: 0.7 });
  if (provider === 'mock') {
    const m: ModelConfig = { provider: 'mock', model: 'mock', temperature: 0, maxOutputTokens: 6_000, timeoutMs: 5_000 };
    const config: GatewayConfig = { ...DEFAULT_CONFIG, purposes: { ...DEFAULT_CONFIG.purposes, dialogue: m }, budget: { ...DEFAULT_CONFIG.budget, dailyTokens: BATTERY_TOKENS } };
    return new Gateway({ config, adapters: { mock: mockAdapter(mockResponder) }, records: new MemoryRecordStore(100_000) });
  }
  const path = 'config/llm.json';
  const base = existsSync(path) ? parseConfig(JSON.parse(readFileSync(path, 'utf8'))) : DEFAULT_CONFIG;
  const dialogue = base.purposes.dialogue;
  if (!dialogue) throw new UsageError('config/llm.json tiene desactivado el propósito dialogue');
  const config: GatewayConfig = { ...base, purposes: { ...base.purposes, dialogue: big(dialogue) }, budget: { ...base.budget, dailyTokens: Math.max(base.budget.dailyTokens, BATTERY_TOKENS) } };
  // Los dos proveedores reales; se usa el que diga `config/llm.json` (`openai_compatible` lee LLM_BASE_URL y LLM_API_KEY, o `baseUrl`).
  let a: ProviderAdapter | undefined;
  let o: ProviderAdapter | undefined;
  const adapters = {
    anthropic: { call: (c: Parameters<ProviderAdapter['call']>[0]) => (a ??= anthropicAdapter()).call(c) },
    openai_compatible: { call: (c: Parameters<ProviderAdapter['call']>[0]) => (o ??= openaiCompatibleAdapter(dialogue.baseUrl ? { baseUrl: dialogue.baseUrl } : {})).call(c) },
  };
  return new Gateway({ config, adapters, records: new MemoryRecordStore(100_000) });
}

const TRANSIENT = /429|rate.?limit|overloaded|\b50[234]\b|\b529\b|timeout|ETIMEDOUT|ECONNRESET/i;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Aplica las pruebas de una persona, con reintentos ante límites de tasa o sobrecarga (proveedores gratuitos); otros fallos
 * no se reintentan. `perCall = 'person'`: todas en una llamada; `'instrument'`: una llamada por prueba.
 */
async function administer(gateway: Gateway, pv: PersonView, plans: Record<InstrumentId, ItemPlan[]>, perCall: string, delayMs: number): Promise<Record<InstrumentId, ItemAnswer[]>> {
  const ids = Object.keys(plans) as InstrumentId[];
  for (let attempt = 1; ; attempt++) {
    const out = (perCall === 'person'
      ? await administerBattery(gateway, pv, ids.map((id) => ({ ins: INSTRUMENTS[id], plan: plans[id] })))
      : Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await administerInstrument(gateway, pv, INSTRUMENTS[id], plans[id])])))) as Record<InstrumentId, ItemAnswer[]>;
    if (delayMs > 0) await sleep(delayMs);
    const why = ids.map((id) => out[id][0]!).find((a) => a.source === 'plantilla')?.why ?? '';
    if (!why || attempt >= 8 || !TRANSIENT.test(why)) return out;
    await sleep(Math.min(120_000, 8_000 * attempt));
  }
}

interface Checkpoint {
  battery: Battery;
  sample: Participant[];
  /** Toma a cuya fecha está ya la copia del mundo. */
  reached: 0 | 1 | 2;
}

/** Copia consistente de la base (`VACUUM INTO`) sin el cerrojo del worker, para poder avanzarla sin tocar el mundo en marcha. */
function copyWorld(src: string, dst: string): void {
  mkdirSync(dirname(dst), { recursive: true });
  for (const ext of ['', '-wal', '-shm']) rmSync(`${dst}${ext}`, { force: true });
  withDb(openReadonly(src), (db) => void db.exec(`VACUUM INTO '${dst.replace(/'/g, "''")}'`));
  withDb(openWorldDb(dst), (db) => void db.prepare("DELETE FROM meta WHERE key = 'writer_pid'").run());
}

function advanceCopy(path: string, days: number, io: Io): void {
  withDb(openWorldDb(path), (db) => {
    acquireWriterLock(db);
    try {
      const repo = new WorldRepository(db);
      const world = repo.loadWorld();
      new WorldSession(repo, lifeRunner(world)).advanceTicks((days * MINUTES_PER_DAY) / world.config.tickMinutes, (f) => io.err(`  avance: ${Math.round(f * 100)} %`));
    } finally {
      releaseWriterLock(db);
    }
  });
}

const nameOf = (w: World, id: string) => {
  const c = w.citizens.get(id as EntityId);
  return c?.name ? `${c.name.given} ${c.name.family.join(' ')}` : id;
};
const occupationOf = (w: World, id: string): string => {
  const o = w.citizens.get(id as EntityId)?.occupation;
  if (!o) return 'sin dato';
  return o.kind === 'formal' ? 'empleo formal' : o.kind === 'none' ? o.reason : `${o.kind}: ${o.trade}`;
};

/** Reparte el trabajo en `n` lanzadores a la vez (la pasarela es la que limita el ritmo real). */
async function pool<T>(items: readonly T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

export async function psychometrics(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, work: { type: 'string', default: 'data/psicometria/mundo.db' }, out: { type: 'string', default: 'data/psicometria/bateria' },
      provider: { type: 'string', default: 'mock' }, n: { type: 'string', default: String(N_SAMPLE) }, 'month-days': { type: 'string', default: '30' }, 'year-days': { type: 'string', default: '365' },
      concurrency: { type: 'string', default: '4' }, 'delay-ms': { type: 'string', default: '0' }, 'per-call': { type: 'string', default: 'person' }, resume: { type: 'boolean', default: false },
    },
  });
  if (v.provider !== 'mock' && v.provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  if (v['per-call'] !== 'person' && v['per-call'] !== 'instrument') throw new UsageError('--per-call debe ser person o instrument');
  const n = toInt('n', v.n, 8);
  const monthDays = toInt('month-days', v['month-days'], 1), yearDays = toInt('year-days', v['year-days'], 1);
  const gateway = gatewayFor(v.provider!);
  const cats = chatCatalogs(loadCatalogs());

  // Punto de control: lo hecho se guarda en disco para reanudar con `--resume` sin repetir llamadas (y sin volver a pagarlas).
  const ckptPath = `${v.out}.ckpt.json`;
  let battery: Battery = { meta: { world: '', seed: 0, provider: v.provider!, nSample: n, generatedFor: 'spec 045' }, participants: [], tomas: [], takes: [], events: [] };
  let sample: Participant[] = [];
  let reached: 0 | 1 | 2 = 0;
  const save = () => { mkdirSync(dirname(ckptPath), { recursive: true }); writeFileSync(ckptPath, JSON.stringify({ battery, sample, reached } satisfies Checkpoint)); };
  if (v.resume && existsSync(ckptPath)) {
    ({ battery, sample, reached } = JSON.parse(readFileSync(ckptPath, 'utf8')) as Checkpoint);
    io.err(`Reanudando: copia en la toma ${reached}, ${battery.takes.filter((t) => t.instruments).length} mediciones hechas`);
  } else {
    io.err(`Copiando ${v.db} → ${v.work}`);
    copyWorld(v.db!, v.work!);
  }
  const delayMs = toInt('delay-ms', v['delay-ms'], 0);
  battery.events = [];

  for (const toma of [0, 1, 2] as const) {
    if (toma > reached) {
      io.err(`Avanzando ${toma === 1 ? monthDays : yearDays} días…`);
      advanceCopy(v.work!, toma === 1 ? monthDays : yearDays, io);
      reached = toma;
      save();
    }
    const { world, events, byCitizen } = withDb(openReadonly(v.work!), (db) => {
      const w = new WorldRepository(db).loadWorld();
      const all = queryEvents(db, { limit: 5_000_000 });
      const root = createRng(w.config.seed);
      if (toma === 0 && sample.length === 0) sample = selectSample(adults(w), n, root.fork('measure:sample'));
      const per = new Map<string, { events: WorldEvent[]; trajectory: ReturnType<typeof trajectoryOf>; profile: ReturnType<typeof reportFor>['profile'] }>();
      for (const p of sample) {
        if (w.components.u8.active?.[Number(p.id.slice(4))] !== 1) continue;
        per.set(p.id, { events: queryEvents(db, { participant: p.id, limit: 1_000_000 }), trajectory: trajectoryOf(db, p.id), profile: reportFor(w, db, p.id).profile });
      }
      return { world: w, events: all, byCitizen: per };
    });
    const root = createRng(world.config.seed);
    battery.meta.world = world.id;
    battery.meta.seed = world.config.seed;
    if (!battery.tomas.some((t) => t.toma === toma)) battery.tomas.push({ toma, minute: world.now, date: dateOf(world.now, world.config.epoch), hash: stateHash(world) });
    io.err(`Toma ${toma}: ${dateOf(world.now, world.config.epoch)} · ${byCitizen.size}/${sample.length} personas vivas`);
    if (toma === 0 && battery.participants.length === 0) battery.participants = sample.map((p) => ({ id: p.id, name: nameOf(world, p.id), sex: p.sex, age: p.age, stratum: p.stratum, occupation: occupationOf(world, p.id) }));

    const jobs: { p: Participant; take: TakeRecord }[] = [];
    for (const p of sample) {
      const info = byCitizen.get(p.id);
      let take = battery.takes.find((t) => t.citizenId === p.id && t.toma === toma);
      if (!take) battery.takes.push((take = { citizenId: p.id, toma, alive: !!info }));
      if (!info) continue;
      take.indicators = indicatorsOf({ world, id: p.id, profile: info.profile, trajectory: info.trajectory, events: info.events });
      if (!take.instruments) jobs.push({ p, take });
    }
    let done = 0;
    await pool(jobs, toInt('concurrency', v.concurrency, 1), async ({ p, take }) => {
      const ind = take.indicators!;
      const pv = buildPersonView({ view: world, citizenId: p.id, now: world.now, events, memoryText: (k) => cats.memories?.[k], topicText: (k) => cats.topics?.[k] });
      const record = {} as Record<(typeof INSTRUMENT_IDS)[number], InstrumentRecord>;
      // Lo verdadero y la disposición salen del motor para todas las pruebas; el LLM solo las expresa (R-011, R-012).
      const truth = Object.fromEntries(INSTRUMENT_IDS.map((id) => [id, truthfulResponses(id, ind, root.fork(`measure:${id}:${p.id}:${toma}`))])) as Record<InstrumentId, ReturnType<typeof truthfulResponses>>;
      const said = Object.fromEntries(INSTRUMENT_IDS.map((id) => [id, dispose(id, truth[id].t, ind, root.fork(`measure:candor:${p.id}:${toma}:${id}`), 0)])) as Record<InstrumentId, ReturnType<typeof dispose>>;
      const plans = Object.fromEntries(INSTRUMENT_IDS.map((id) => [id, truth[id].t.map((_, k) => ({ n: k + 1, target: said[id].r[k]!, disposition: said[id].disposition[k]! }))])) as Record<InstrumentId, ItemPlan[]>;
      const all = await administer(gateway, pv, plans, v['per-call']!, delayMs);
      // Con un proveedor real, caer a plantilla es un fallo (clave, saldo, red), no un dato: se detiene y lo hecho queda guardado.
      const flat = INSTRUMENT_IDS.flatMap((id) => all[id]);
      const bad = flat.filter((a) => a.source === 'plantilla');
      if (v.provider === 'config' && bad.length > 0.15 * flat.length) {
        throw new UsageError(`el LLM no respondió (${bad[0]!.why ?? 'sin motivo'}). Lo hecho quedó guardado: corrija la causa y repita el mismo comando con --resume`);
      }
      for (const id of INSTRUMENT_IDS) {
        const tr = truth[id], d = said[id], answers = all[id];
        const reported = answers.map((a) => a.option);
        record[id] = {
          items: answers.map((a, k) => ({ n: a.n, truthful: tr.t[k]!, p: tr.p[k]!, disposition: d.disposition[k]!, target: d.r[k]!, reported: a.option, reply: a.reply, source: a.source })),
          reported: scoreInstrument(id, reported), truthful: scoreInstrument(id, tr.t),
        };
      }
      take.instruments = record;
      save();
      io.err(`  ${++done}/${jobs.length} ${p.id}`);
    });

    // Eventos entre tomas (solo al final, con todo el historial).
    if (toma === 2) {
      const [t0, t1] = [battery.tomas[0]!.minute, battery.tomas[1]!.minute];
      for (const p of sample) {
        const counts = new Map<string, number>();
        for (const e of byCitizen.get(p.id)?.events ?? []) {
          if (!EVENTS_OF_INTEREST.has(e.type) || e.at < t0) continue;
          const key = `${e.at < t1 ? 'Toma 0 → 1' : 'Toma 1 → 2'}|${e.type}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [k, count] of [...counts].sort(([a], [b]) => (a < b ? -1 : 1))) {
          const [interval, type] = k.split('|') as [string, string];
          battery.events.push({ citizenId: p.id, interval, type, count });
        }
      }
    }
  }

  mkdirSync(dirname(v.out!), { recursive: true });
  writeFileSync(`${v.out}.xlsx`, workbookOf(battery));
  writeFileSync(`${v.out}.json`, `${JSON.stringify(battery)}\n`);
  const m = gateway.metrics().dialogue;
  io.out(`Batería: ${battery.participants.length} personas × 3 tomas → ${v.out}.xlsx y ${v.out}.json${m ? ` · coste ${m.costMicros / 1e6} USD, p50 ${Math.round(m.totalP50)} ms` : ''}`);
}
