import { describe, expect, it } from 'vitest';
import { reasonLabel, renderChatList, renderTranscript } from './chat-history.ts';

describe('pestaña Charlas de la ficha (043 R-017)', () => {
  it('lista las charlas de la más reciente a la más antigua, con modo y motivo del fin', () => {
    const html = renderChatList([
      { id: 'CHS-000001', mode: 'sandbox', status: 'ended', endReason: 'visitor', createdAt: '2026-09-27T10:00:00Z' },
      { id: 'CHS-000002', mode: 'in_world', status: 'ended', endReason: 'citizen', createdAt: '2026-09-27T11:30:00Z' },
    ]);
    expect(html.indexOf('CHS-000002')).toBeLessThan(html.indexOf('CHS-000001'));
    expect(html).toContain('2026-09-27 11:30</span> · en el mundo · se fue');
    expect(html).toContain('sandbox · te despediste');
    expect(renderChatList([])).toContain('Todavía no ha charlado');
    expect(reasonLabel('interrupted')).toContain('interrumpida');
  });

  it('la transcripción muestra el tono del visitante, la postura del ciudadano y escapa el texto', () => {
    const html = renderTranscript([
      { seq: 0, speaker: 'visitor', text: '¿Quiere una relación <abierta>?', data: { tone: 'invasivo' } },
      { seq: 0, speaker: 'citizen', text: 'No, así no.', data: { stance: 'poner_limite' } },
    ]);
    expect(html).toContain('tono invasivo');
    expect(html).toContain('postura: poner un límite');
    expect(html).toContain('&lt;abierta&gt;');
    expect(html.indexOf('msg visitor')).toBeLessThan(html.indexOf('msg citizen'));
  });
});
