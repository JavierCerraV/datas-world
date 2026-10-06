// `pnpm cli psychometrics` (spec 045): aplica AAQ-II, GHQ-12, GPQ-9, GTQ, DASS-21 y SWLS a una muestra de adultos en tres
// tomas (hoy, +30 días, +1 año) sobre una COPIA de la base (el mundo en marcha no se toca) y escribe un Excel y un JSON.
// La respuesta verdadera y la disposición las decide el motor; el LLM las expresa como charla y el motor las valida.
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { INSTRUMENTS, INSTRUMENT_IDS, MINUTES_PER_DAY, N_SAMPLE, adults, createRng, dispose, indicatorsOf, scoreInstrument, selectSample, stateHash, truthfulResponses } from '@datas-world/engine';
import type { EntityId, Participant, World, WorldEvent } from '@datas-world/engine';
import { lifeRunner, loadCatalogs } from '@datas-world/generators';
import { DEFAULT_CONFIG, Gateway, MemoryRecordStore, administerInstrument, anthropicAdapter, buildPersonView, chatCatalogs, mockAdapter, parseConfig } from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ModelConfig, ProviderAdapter } from '@datas-world/llm-gateway';
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
  const answers = [...text.matchAll(/ÍTEM (\d+):[\s\S]*?Opciones: (\d+) = [\s\S]*?(\d+) = [^;\n]*\.\n\s*RANGO (\d+)-(\d+)/g)].map((m) => {
    const [n, min, max, lo, hi] = m.slice(1).map(Number) as [number, number, number, number, number];
    // Con rango par es que el objetivo está en un extremo de la escala: se queda en él.
    const option = (lo + hi) % 2 === 0 ? (lo + hi) / 2 : lo === min ? lo : hi === max ? hi : lo;
    return { n, reply: `Pues más o menos, ${option}.`, option };
  });
  return JSON.stringify({ answers });
};

function gatewayFor(provider: string): Gateway {
  // Cada instrumento va en una llamada: más salida y más tiempo que una réplica de charla.
  const big = (m: ModelConfig): ModelConfig => ({ ...m, maxOutputTokens: 6_000, timeoutMs: 120_000, temperature: 0.7 });
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
  let a: ProviderAdapter | undefined;
  return new Gateway({ config, adapters: { anthropic: { call: (c) => (a ??= anthropicAdapter()).call(c) } }, records: new MemoryRecordStore(100_000) });
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
      concurrency: { type: 'string', default: '4' },
    },
  });
  if (v.provider !== 'mock' && v.provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  const n = toInt('n', v.n, 8);
  const monthDays = toInt('month-days', v['month-days'], 1), yearDays = toInt('year-days', v['year-days'], 1);
  const gateway = gatewayFor(v.provider!);
  const cats = chatCatalogs(loadCatalogs());

  io.err(`Copiando ${v.db} → ${v.work}`);
  copyWorld(v.db!, v.work!);

  const battery: Battery = { meta: { world: '', seed: 0, provider: v.provider!, nSample: n, generatedFor: 'spec 045' }, participants: [], tomas: [], takes: [], events: [] };
  let sample: Participant[] = [];

  for (const toma of [0, 1, 2] as const) {
    if (toma === 1) { io.err(`Avanzando ${monthDays} días…`); advanceCopy(v.work!, monthDays, io); }
    if (toma === 2) { io.err(`Avanzando ${yearDays} días…`); advanceCopy(v.work!, yearDays, io); }
    const { world, events, byCitizen } = withDb(openReadonly(v.work!), (db) => {
      const w = new WorldRepository(db).loadWorld();
      const all = queryEvents(db, { limit: 5_000_000 });
      const root = createRng(w.config.seed);
      if (toma === 0) sample = selectSample(adults(w), n, root.fork('measure:sample'));
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
    battery.tomas.push({ toma, minute: world.now, date: dateOf(world.now, world.config.epoch), hash: stateHash(world) });
    io.err(`Toma ${toma}: ${dateOf(world.now, world.config.epoch)} · ${byCitizen.size}/${sample.length} personas vivas`);
    if (toma === 0) battery.participants = sample.map((p) => ({ id: p.id, name: nameOf(world, p.id), sex: p.sex, age: p.age, stratum: p.stratum, occupation: occupationOf(world, p.id) }));

    const jobs: { p: Participant; take: TakeRecord }[] = [];
    for (const p of sample) {
      const info = byCitizen.get(p.id);
      const take: TakeRecord = { citizenId: p.id, toma, alive: !!info };
      battery.takes.push(take);
      if (!info) continue;
      take.indicators = indicatorsOf({ world, id: p.id, profile: info.profile, trajectory: info.trajectory, events: info.events });
      jobs.push({ p, take });
    }
    let done = 0;
    await pool(jobs, toInt('concurrency', v.concurrency, 1), async ({ p, take }) => {
      const ind = take.indicators!;
      const pv = buildPersonView({ view: world, citizenId: p.id, now: world.now, events, memoryText: (k) => cats.memories?.[k], topicText: (k) => cats.topics?.[k] });
      const record = {} as Record<(typeof INSTRUMENT_IDS)[number], InstrumentRecord>;
      for (const id of INSTRUMENT_IDS) {
        const tr = truthfulResponses(id, ind, root.fork(`measure:${id}:${p.id}:${toma}`));
        const d = dispose(id, tr.t, ind, root.fork(`measure:candor:${p.id}:${toma}:${id}`), 0);
        const answers = await administerInstrument(gateway, pv, INSTRUMENTS[id], tr.t.map((_, k) => ({ n: k + 1, target: d.r[k]!, disposition: d.disposition[k]! })));
        const reported = answers.map((a) => a.option);
        record[id] = {
          items: answers.map((a, k) => ({ n: a.n, truthful: tr.t[k]!, p: tr.p[k]!, disposition: d.disposition[k]!, target: d.r[k]!, reported: a.option, reply: a.reply, source: a.source })),
          reported: scoreInstrument(id, reported), truthful: scoreInstrument(id, tr.t),
        };
      }
      take.instruments = record;
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
