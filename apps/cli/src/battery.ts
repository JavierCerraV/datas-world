// `pnpm cli chat:battery` (spec 043 R-015, §9): los guiones de `chat_scripts` contra varios ciudadanos, en charlas
// sandbox independientes (no cambian el mundo), y un informe con posturas por tono, coherencia, adherencia,
// diferencias individuales y acuerdo del tono. Con el proveedor `mock` es determinista: dos ejecuciones dan el
// mismo informe byte a byte (CA-016); por eso los archivos no llevan horas ni latencias (van a la consola).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { learningParams, stateHash } from '@datas-world/engine';
import type { EntityId } from '@datas-world/engine';
import { buildOntology, loadCatalogs } from '@datas-world/generators';
import { ChatSession, DEFAULT_CONFIG, Gateway, MemoryRecordStore, anthropicAdapter, chatCatalogs, mockAdapter, parseConfig } from '@datas-world/llm-gateway';
import type { GatewayConfig, MockResponder, ProviderAdapter } from '@datas-world/llm-gateway';
import { WorldRepository, openReadonly, queryEvents } from '@datas-world/persistence';
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_DB, UsageError, withDb } from './common.ts';
import type { Io } from './common.ts';

const ESCAPE = new Set(['evadir', 'poner_limite', 'contraatacar', 'callar', 'terminar']);

/** Proveedor determinista: la expresión repite la postura pedida; la verificación no marca nada. */
const mockResponder: MockResponder = (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return '{"tone":"neutro"}';
  if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
  if (sys.startsWith('Resume en una sola frase')) return 'Charla de prueba.';
  const stance = /POSTURA PARA ESTE TURNO: ([^.]+)\./.exec(sys)?.[1] ?? 'sin postura';
  return `[${stance}] respuesta simulada.`;
};

function gatewayFor(provider: string): Gateway {
  if (provider === 'mock') {
    const m = { provider: 'mock' as const, model: 'mock', temperature: 0, maxOutputTokens: 300, timeoutMs: 5_000 };
    const config: GatewayConfig = { ...DEFAULT_CONFIG, purposes: { ...DEFAULT_CONFIG.purposes, dialogue: m, classify: m, verify: m, summarize: m } };
    return new Gateway({ config, adapters: { mock: mockAdapter(mockResponder) }, records: new MemoryRecordStore(100_000) });
  }
  const path = 'config/llm.json';
  const config = existsSync(path) ? parseConfig(JSON.parse(readFileSync(path, 'utf8'))) : DEFAULT_CONFIG;
  let a: ProviderAdapter | undefined;
  return new Gateway({ config, adapters: { anthropic: { call: (c) => (a ??= anthropicAdapter()).call(c) } } });
}

const share = (xs: string[]) => {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, n]) => [k, Math.round((n / xs.length) * 1000) / 1000]));
};
const variance = (xs: number[]) => {
  const m = xs.reduce((a, x) => a + x, 0) / (xs.length || 1);
  return Math.round((xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length || 1)) * 10_000) / 10_000;
};

export async function chatBattery(args: string[], io: Io): Promise<void> {
  const { values: v } = parseArgs({
    args,
    options: {
      db: { type: 'string', default: DEFAULT_DB }, citizens: { type: 'string', default: '5' }, scripts: { type: 'string', default: 'all' },
      provider: { type: 'string', default: 'mock' }, out: { type: 'string', default: 'data/bateria-charla' },
    },
  });
  if (v.provider !== 'mock' && v.provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  const catalogs = loadCatalogs();
  const cats = chatCatalogs(catalogs);
  const onto = buildOntology(catalogs);
  const scripts = v.scripts === 'all' ? cats.scripts : cats.scripts.filter((s) => v.scripts!.split(',').includes(s.key));
  if (scripts.length === 0) throw new UsageError(`guiones desconocidos: ${v.scripts}`);
  const gateway = gatewayFor(v.provider!);

  const { world, events } = withDb(openReadonly(v.db!), (db) => {
    const w = new WorldRepository(db).loadWorld();
    return { world: w, events: queryEvents(db, { limit: 1_000_000 }) };
  });
  const hash = stateHash(world);
  const adults = [...world.citizens.values()].filter((c) => c.status === 'active' && c.name && (world.components.u8.active?.[Number(c.id.slice(4))] ?? 0) === 1).map((c) => c.id).sort();
  const ids = /^\d+$/.test(v.citizens!) ? adults.slice(0, Number(v.citizens)) : v.citizens!.split(',');
  for (const id of ids) if (!world.citizens.has(id as EntityId)) throw new UsageError(`no existe ${id}`);
  const P = learningParams(world.config.profile, world.config.epoch.slice(0, 10));

  type Row = { citizen: string; script: string; tone: string; toneLlm: string | null; stance: string; expression: string; claims: Record<string, number>; stanceCheck: string };
  const rows: Row[] = [];
  for (const citizenId of ids) {
    for (const sc of scripts) {
      const seed = Number.parseInt(createHash('sha256').update(`${hash}:${citizenId}:${sc.key}`).digest('hex').slice(0, 8), 16);
      const s = new ChatSession({ gateway, catalogs: cats, onto, P, view: world, citizenId, events, sessionId: `BAT-${sc.key}`, visitorId: 'EXT-BATERIA', seed, now: world.now });
      for (const t of sc.turns) {
        if (s.ended) break;
        const out = await s.turn(t.text, { toneTag: t.tone });
        const ver = await out.verification;
        const claims: Record<string, number> = { supported: 0, contradicted: 0, unsupported: 0 };
        for (const c of ver.claims) claims[c.verdict] = (claims[c.verdict] ?? 0) + 1;
        rows.push({ citizen: citizenId, script: sc.key, tone: t.tone, toneLlm: out.tone.toneLlm ?? null, stance: out.choice.stance, expression: out.expression, claims, stanceCheck: ver.stanceCheck });
      }
    }
  }

  const byTone = Object.fromEntries(cats.tones.map((t) => [t.key, share(rows.filter((r) => r.tone === t.key).map((r) => r.stance))]));
  const byScript = Object.fromEntries(scripts.map((sc) => {
    const rs = rows.filter((r) => r.script === sc.key);
    const perCitizen = ids.map((c) => {
      const mine = rs.filter((r) => r.citizen === c);
      return mine.length === 0 ? 0 : mine.filter((r) => ESCAPE.has(r.stance)).length / mine.length;
    });
    return [sc.key, { stances: share(rs.map((r) => r.stance)), escapeVarianceAcrossCitizens: variance(perCitizen) }];
  }));
  const totalClaims = rows.reduce((a, r) => a + r.claims.supported! + r.claims.contradicted! + r.claims.unsupported!, 0);
  const checked = rows.filter((r) => r.stanceCheck !== 'unchecked');
  const withLlm = rows.filter((r) => r.toneLlm !== null);
  const report = {
    world: { hash, minute: world.now }, provider: v.provider, citizens: ids, scripts: scripts.map((s) => s.key), turns: rows.length,
    coherence: {
      claims: totalClaims,
      contradicted: totalClaims ? Math.round((rows.reduce((a, r) => a + r.claims.contradicted!, 0) / totalClaims) * 1000) / 1000 : 0,
      unsupported: totalClaims ? Math.round((rows.reduce((a, r) => a + r.claims.unsupported!, 0) / totalClaims) * 1000) / 1000 : 0,
    },
    adherence: { checked: checked.length, mismatch: checked.length ? Math.round((checked.filter((r) => r.stanceCheck === 'mismatch').length / checked.length) * 1000) / 1000 : 0 },
    toneAgreement: withLlm.length ? Math.round((withLlm.filter((r) => r.toneLlm === r.tone).length / withLlm.length) * 1000) / 1000 : null,
    templates: rows.filter((r) => r.expression === 'template').length,
    byTone, byScript,
  };
  const md = [
    '# Batería de charla (spec 043 R-015)', '',
    `Mundo \`${hash}\` (minuto ${world.now}) · proveedor \`${v.provider}\` · ${ids.length} ciudadanos · ${scripts.length} guiones · ${rows.length} turnos.`, '',
    '## Coherencia y expresión', '',
    `- Afirmaciones: ${totalClaims} (contradichas ${report.coherence.contradicted}, inventadas ${report.coherence.unsupported}).`,
    `- Desajuste con la postura: ${report.adherence.mismatch} de ${report.adherence.checked} turnos verificados.`,
    `- Acuerdo del tono (clasificador frente a guion): ${report.toneAgreement ?? 'sin clasificador'}.`,
    `- Turnos con plantilla (sin LLM): ${report.templates}.`, '',
    '## Posturas por tono', '', '| Tono | Posturas |', '|---|---|',
    ...Object.entries(byTone).filter(([, s]) => Object.keys(s).length > 0).map(([t, s]) => `| ${t} | ${Object.entries(s).map(([k, p]) => `${k} ${Math.round(p * 100)} %`).join(', ')} |`),
    '', '## Diferencias entre ciudadanos', '', '| Guion | Varianza de la proporción de escape |', '|---|---|',
    ...Object.entries(byScript).map(([k, s]) => `| ${k} | ${s.escapeVarianceAcrossCitizens} |`), '',
  ].join('\n');
  mkdirSync(dirname(v.out!), { recursive: true });
  writeFileSync(`${v.out}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${v.out}.md`, md);
  const m = gateway.metrics().dialogue;
  io.out(`Batería: ${rows.length} turnos → ${v.out}.json y ${v.out}.md${m ? ` · expresión p50 ${Math.round(m.totalP50)} ms, coste ${m.costMicros / 1e6} USD` : ''}`);
}
