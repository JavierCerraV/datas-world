import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteRecordStore, closeDb, insertChatSession, insertChatTurn, openWorldDb } from '@datas-world/persistence';
import { afterAll, describe, expect, it } from 'vitest';
import { chatStats, formatChatStats } from './chat-stats.ts';

const dir = mkdtempSync(join(tmpdir(), 'chat-stats-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const usage = { inputTokens: 1000, outputTokens: 100, cachedTokens: 500, cacheWriteTokens: 0 };

describe('chat:stats (043 R-023, L4.3)', () => {
  it('latencias p50/p95 de las respuestas con LLM y coste por propósito y por sesión', () => {
    const db = openWorldDb(join(dir, 'w.db'));
    const rec = new SqliteRecordStore(db);
    const put = (key: string, purpose: string, costMicros: number) =>
      rec.put({ key, purpose, model: 'h', response: { text: '' }, usage, costMicros, createdAt: 't', affectsWorld: false });
    for (const [id, mode] of [['CHS-000001', 'in_world'], ['CHS-000002', 'sandbox']] as const)
      insertChatSession(db, { id, citizenId: 'CIT-000001', visitorId: 'EXT-0001', mode, worldAt: 0, worldHash: 'x', testMode: false, llm: {}, status: 'ended', createdAt: 't', updatedAt: 't' });
    put('c1', 'classify', 1000);
    put('d1', 'dialogue', 2000);
    put('d2', 'dialogue', 3000);
    put('v1', 'verify', 500);
    insertChatTurn(db, { sessionId: 'CHS-000001', seq: 0, speaker: 'visitor', text: 'hola', data: { tone: 'amable', llmRef: 'c1' }, createdAt: 't' });
    insertChatTurn(db, { sessionId: 'CHS-000001', seq: 0, speaker: 'citizen', text: 'hola', data: { expression: 'llm', llmRef: 'd1', latencyMs: { firstToken: 800, total: 2000 } }, createdAt: 't' });
    insertChatTurn(db, { sessionId: 'CHS-000001', seq: 1, speaker: 'citizen', text: 'bien', data: { expression: 'llm', llmRef: 'd2', latencyMs: { firstToken: 1200, total: 6000 } }, createdAt: 't' });
    insertChatTurn(db, { sessionId: 'CHS-000002', seq: 0, speaker: 'citizen', text: 'Mmm.', data: { expression: 'template', llmRef: null, latencyMs: { total: 3 } }, createdAt: 't' });

    const s = chatStats(db);
    closeDb(db);
    expect(s).toMatchObject({ sessions: 2, inWorld: 1, turns: 3, llmTurns: 2 });
    expect(s.firstToken).toEqual({ p50: 1200, p95: 1200, n: 2 });
    expect(s.total).toEqual({ p50: 6000, p95: 6000, n: 2 });
    expect(s.meetsTargets).toEqual({ firstTokenP50: true, totalP95: false });
    expect(s.totalUsd).toBeCloseTo(0.0065);
    expect(s.usdPerSession).toBeCloseTo(0.00325);
    expect(s.costByPurpose.dialogue).toMatchObject({ calls: 2, inputTokens: 2000, cachedTokens: 1000 });
    expect(s.perSession[0]).toMatchObject({ id: 'CHS-000001', turns: 2 });
    expect(s.perSession[0]!.usd).toBeCloseTo(0.006);
    expect(formatChatStats(s).join('\n')).toContain('objetivo p95 ≤ 5000 ms: NO cumple');
  });
});
