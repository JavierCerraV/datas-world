// La pasarela del estudio (spec 047; 026 R-003, R-006): proveedor simulado o real, varias claves que se relevan cuando
// una se queda sin cuota, y un registro de respuestas en disco para retomar un piloto cortado sin repetir llamadas.
// Las claves solo se leen del entorno y nunca se escriben: los avisos dicen «clave 2 de 3» (026 INV-004).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, Gateway, MemoryRecordStore, anthropicAdapter, mockAdapter, openaiCompatibleAdapter, parseConfig } from '@datas-world/llm-gateway';
import type { GatewayConfig, LlmRecord, MockResponder, ModelConfig, ProviderAdapter, RecordStore } from '@datas-world/llm-gateway';
import { UsageError } from './common.ts';
import type { Io } from './common.ts';

/** Una sesión son unas 160 llamadas con el diálogo acumulado: el tope diario de la charla se queda corto. */
const STUDY_TOKENS = 20_000_000;

/** Terapeuta y persona deterministas: el terapeuta trabaja el primer componente pendiente; la persona dice su postura. */
const mockResponder: MockResponder = (c) => {
  const sys = c.system.map((p) => p.text).join('\n');
  if (sys.startsWith('Clasifica el tono')) return '{"tone":"neutro"}';
  if (sys.startsWith('Revisas la respuesta')) return '{"claims":[],"stance":"ok"}';
  if (c.model === 'mock-terapeuta') {
    if (!c.jsonSchema) return `Nota de prueba: ${c.messages[0]!.text.split('\n')[0]}`;
    const component = (/PENDIENTES: (.*)/.exec(sys)?.[1] ?? '').split(', ')[0] ?? '';
    return JSON.stringify({ read: 'Lectura de prueba.', say: `Hablemos de esto (${component}).`, component, covered: [], notes: 'Formulación de prueba.', close: false });
  }
  return `[${/POSTURA PARA ESTE TURNO: ([^.]+)\./.exec(sys)?.[1] ?? 'sin postura'}] respuesta simulada.`;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TRANSIENT = /429|rate.?limit|overloaded|\b50[234]\b|\b529\b|ETIMEDOUT|ECONNRESET/i;

/** Reintenta ante límites de tasa o sobrecarga con la misma credencial; otros fallos pasan tal cual. */
const withRetry = (inner: () => ProviderAdapter, io: Io): ProviderAdapter => ({
  async call(c) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await inner().call(c);
      } catch (e) {
        const msg = messageOf(e);
        if (attempt >= 6 || !TRANSIENT.test(msg) || c.signal.aborted) throw e;
        io.err(`  proveedor ocupado (${msg.slice(0, 80)}); reintento ${attempt} en ${5 * attempt} s`);
        await sleep(5_000 * attempt);
      }
    }
  },
});

/** Claves del entorno: `LLM_API_KEYS` (varias, separadas por comas o espacios) o, si falta, `LLM_API_KEY`. */
export function keysOf(env: Record<string, string | undefined>): string[] {
  const raw = env.LLM_API_KEYS?.trim() ? env.LLM_API_KEYS : (env.LLM_API_KEY ?? '');
  return [...new Set(raw.split(/[\s,;]+/).filter(Boolean))];
}

/** Cuota, crédito o clave: con otra clave puede funcionar. Y la sobrecarga del proveedor, que se pasa esperando. */
const QUOTA = /HTTP (401|402|403|429)|rate.?limit|quota|credit/i;
const BUSY = /HTTP (50[234]|529)|overloaded|ETIMEDOUT|ECONNRESET/i;

/**
 * Un adaptador sobre varias claves. Usa la que respondió la última vez; si esa se queda sin cuota, prueba las demás en
 * orden. Si ninguna responde, espera y da otra vuelta (los límites por minuto se pasan solos); tras `rounds` vueltas
 * falla, y quien llama corta el piloto para reanudarlo con claves nuevas. Un error que no es de cuota no se reintenta.
 */
export function rotatingAdapter(
  adapters: readonly ProviderAdapter[], o: { log: (line: string) => void; wait?: (ms: number) => Promise<void>; rounds?: number },
): ProviderAdapter {
  const n = adapters.length;
  const wait = o.wait ?? sleep;
  const rounds = o.rounds ?? 4;
  let current = 0;
  return {
    async call(c) {
      let last = '';
      for (let round = 1; round <= rounds; round++) {
        for (let i = 0; i < n; i++) {
          const k = (current + i) % n;
          try {
            const r = await adapters[k]!.call(c);
            current = k;
            return r;
          } catch (e) {
            last = messageOf(e);
            if (c.signal.aborted || !(QUOTA.test(last) || BUSY.test(last))) throw e;
            o.log(`  clave ${k + 1} de ${n}: ${last.slice(0, 90)}`);
          }
        }
        if (round < rounds) {
          o.log(`  ninguna clave responde; espero ${15 * round} s y vuelvo a probar (${round} de ${rounds - 1})`);
          await wait(15_000 * round);
        }
      }
      throw new Error(`${n === 1 ? 'la clave está' : `las ${n} claves están`} sin cuota o el proveedor no responde: ${last.slice(0, 160)}`);
    },
  };
}

/**
 * Registro de respuestas en un archivo JSONL (026 R-003), mientras llega el de SQLite. Cada respuesta se añade al
 * archivo en cuanto llega, así que un proceso que muere pierde como mucho la llamada en curso. Una respuesta vacía no
 * se guarda: al reanudar se vuelve a pedir.
 */
export class FileRecordStore implements RecordStore {
  #path: string;
  #map = new Map<string, LlmRecord>();

  constructor(path: string) {
    this.#path = path;
    if (!existsSync(path)) return;
    const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim());
    let bad = 0;
    for (const line of lines) {
      try {
        const r = JSON.parse(line) as LlmRecord;
        if (typeof r.key !== 'string' || typeof r.response !== 'object') throw new Error('forma');
        this.#map.set(r.key, r);
      } catch {
        bad++;
      }
    }
    // Una línea cortada al final es un proceso que murió escribiendo; más que eso, es otro tipo de archivo.
    if (bad > 1 || (bad === 1 && this.#map.size === 0)) throw new UsageError(`${path} no es un registro de respuestas del LLM`);
    if (bad === 1) appendFileSync(path, '\n');
  }

  get size(): number {
    return this.#map.size;
  }

  get(key: string): LlmRecord | undefined {
    return this.#map.get(key);
  }

  put(record: LlmRecord): void {
    if (record.response.data === undefined && !record.response.text?.trim()) return;
    this.#map.set(record.key, structuredClone(record));
    mkdirSync(dirname(this.#path), { recursive: true });
    appendFileSync(this.#path, `${JSON.stringify(record)}\n`);
  }

  markAffectsWorld(key: string): void {
    const r = this.#map.get(key);
    if (r) r.affectsWorld = true;
  }

  /** El registro del estudio no se poda: es lo que permite reanudarlo. */
  prune(): number {
    return 0;
  }
}

/**
 * Pasarela del estudio. `config`: el archivo debe definir `therapist` y `dialogue`; su `budget` es el tope de gasto.
 * Con `recordsPath`, las respuestas se guardan en disco y una ejecución posterior las reutiliza sin llamar a la red.
 */
export function gatewayFor(provider: string, llmConfig: string, io: Io, recordsPath?: string): Gateway {
  const budget = (c: GatewayConfig): GatewayConfig => ({ ...c, budget: { ...c.budget, dailyTokens: Math.max(c.budget.dailyTokens, STUDY_TOKENS) } });
  const records = recordsPath ? new FileRecordStore(recordsPath) : new MemoryRecordStore(10_000);
  if (provider === 'mock') {
    const m = (model: string): ModelConfig => ({ provider: 'mock', model, maxOutputTokens: 800, timeoutMs: 5_000 });
    const purposes = { ...DEFAULT_CONFIG.purposes, dialogue: m('mock-persona'), classify: m('mock'), verify: m('mock'), therapist: m('mock-terapeuta') };
    return new Gateway({ config: budget({ ...DEFAULT_CONFIG, purposes }), adapters: { mock: mockAdapter(mockResponder) }, records });
  }
  if (provider !== 'config') throw new UsageError('--provider debe ser mock o config');
  if (!existsSync(llmConfig)) throw new UsageError(`no existe ${llmConfig} (use --llm-config RUTA)`);
  const config = budget(parseConfig(JSON.parse(readFileSync(llmConfig, 'utf8'))));
  const { therapist, dialogue } = config.purposes;
  if (!therapist || !dialogue) throw new UsageError(`${llmConfig} debe definir los propósitos therapist y dialogue`);
  if (records instanceof FileRecordStore && records.size > 0) io.err(`Registro de respuestas: ${records.size} ya guardadas en ${recordsPath} (no se vuelven a pedir)`);
  let a: ProviderAdapter | undefined;
  let o: ProviderAdapter | undefined;
  // `openai_compatible`: una o varias claves de LLM_API_KEYS (o LLM_API_KEY) y la URL de `baseUrl` o LLM_BASE_URL.
  const rotating = (): ProviderAdapter => {
    const keys = keysOf(process.env);
    if (keys.length === 0) throw new Error('openai_compatible: falta la clave (LLM_API_KEYS o LLM_API_KEY)');
    if (keys.length > 1) io.err(`Claves disponibles: ${keys.length}`);
    const base = therapist.baseUrl ? { baseUrl: therapist.baseUrl } : {};
    return rotatingAdapter(keys.map((apiKey) => openaiCompatibleAdapter({ ...base, apiKey })), { log: (l) => io.err(l) });
  };
  const adapters = {
    anthropic: withRetry(() => (a ??= anthropicAdapter()), io),
    openai_compatible: { call: (c: Parameters<ProviderAdapter['call']>[0]) => (o ??= rotating()).call(c) },
  };
  return new Gateway({ config, adapters, records });
}
