import { afterEach, describe, expect, it } from 'vitest';
import {
  SqliteRecordStore, appendChatLog, chatLog, chatSessionsOf, chatTurns, getChatSession, insertChatSession, insertChatTurn, nextChatSessionId,
  openInWorldSession, updateChatSession,
} from './chat.ts';
import { closeDb, openWorldDb } from './db.ts';
import { tempDir } from './testing.ts';

let tmp = tempDir();
afterEach(() => {
  tmp.cleanup();
  tmp = tempDir();
});

const T = '2026-09-27T12:00:00.000Z';

describe('datos del laboratorio de charla (043 R-001; migración 002)', () => {
  it('sesiones, turnos y registro append-only', () => {
    const db = openWorldDb(tmp.file('w.db'));
    try {
      const id = nextChatSessionId(db);
      expect(id).toBe('CHS-000001');
      insertChatSession(db, {
        id, citizenId: 'CIT-000019', visitorId: 'EXT-0001', mode: 'in_world', worldAt: 600, worldHash: 'abc', testMode: true,
        llm: { model: 'claude-haiku-4-5-20251001' }, status: 'open', availableUntil: 700, createdAt: T, updatedAt: T,
      });
      expect(nextChatSessionId(db)).toBe('CHS-000002');
      expect(openInWorldSession(db)?.id).toBe(id);
      insertChatTurn(db, { sessionId: id, seq: 0, speaker: 'visitor', text: 'Hola', data: { tone: 'amable' }, createdAt: T });
      insertChatTurn(db, { sessionId: id, seq: 0, speaker: 'citizen', text: 'Buenas', data: { stance: 'abrirse' }, createdAt: T });
      expect(chatTurns(db, id).map((t) => t.speaker)).toEqual(['visitor', 'citizen']);
      appendChatLog(db, { sessionId: id, type: 'CHAT_STANCE_SELECTED', payload: { stance: 'abrirse' }, causes: [{ state: 'fuente.fuerza', weight: 1 }], createdAt: T });
      expect(chatLog(db, id)[0]).toMatchObject({ type: 'CHAT_STANCE_SELECTED', payload: { stance: 'abrirse' } });
      expect(() => db.prepare("UPDATE chat_log SET type = 'X'").run()).toThrow(/append-only/);
      updateChatSession(db, id, { status: 'ended', endReason: 'visitor', inputRef: '640:0' }, T);
      expect(getChatSession(db, id)).toMatchObject({ status: 'ended', endReason: 'visitor', inputRef: '640:0', testMode: true });
      expect(openInWorldSession(db)).toBeUndefined();
      expect(chatSessionsOf(db, 'CIT-000019')).toHaveLength(1);
    } finally {
      closeDb(db);
    }
  });

  it('el almacén de registros LLM: guarda, lee, marca los que afectan al mundo y poda solo los demás', () => {
    const db = openWorldDb(tmp.file('w.db'));
    try {
      const store = new SqliteRecordStore(db);
      const rec = (key: string, createdAt: string) => ({
        key, purpose: 'dialogue', model: 'm', response: { text: 'hola' }, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, cacheWriteTokens: 0 },
        costMicros: 6, createdAt, affectsWorld: false,
      });
      store.put(rec('a', '2026-01-01T00:00:00Z'));
      store.put(rec('b', '2026-01-01T00:00:00Z'));
      store.put(rec('c', '2026-09-01T00:00:00Z'));
      store.markAffectsWorld('b');
      expect(store.get('a')).toMatchObject({ response: { text: 'hola' }, affectsWorld: false });
      expect(store.prune('2026-06-01T00:00:00Z')).toBe(1);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')?.affectsWorld).toBe(true);
      expect(store.get('c')).toBeDefined();
    } finally {
      closeDb(db);
    }
  });
});
