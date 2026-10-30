import { describe, expect, it } from 'vitest';
import { FAIL_CLOSED, MAX_CONVS, MAX_MSGS, capStore, dayGroup, deriveChatTitle, pickResume, sanitizeStore, type ChatConv } from '../chatStore';

// Tanda BUSCARCHAT (30-oct): las partes puras del store de chats del cliente (lo que se lee de localStorage puede venir de
// otra versión o tocado a mano: se valida; los topes recortan; el título sale del primer mensaje).
const conv = (id: string, updatedAt: number, n = 2): ChatConv => ({
  id, title: id, startedAt: updatedAt, updatedAt, context: [],
  msgs: Array.from({ length: n }, (_, i) => (i % 2 ? { id: i + 1, role: 'ai' as const, text: 'r' } : { id: i + 1, role: 'kid' as const, text: 'p' })),
});

describe('deriveChatTitle', () => {
  it('toma las primeras 7 palabras', () => {
    expect(deriveChatTitle('  uno dos   tres cuatro cinco seis siete ocho nueve ')).toBe('uno dos tres cuatro cinco seis siete');
  });
  it('corta a 42 letras con «…»', () => {
    const t = deriveChatTitle('supercalifragilístico expialidoso extraordinariamente larguísimo');
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(43);
  });
  it('vacío → «Nuevo chat»', () => { expect(deriveChatTitle('   ')).toBe('Nuevo chat'); });
});

describe('dayGroup', () => {
  const now = new Date(2026, 9, 30, 10).getTime();
  it('agrupa por día calendario', () => {
    expect(dayGroup(new Date(2026, 9, 30, 0, 5).getTime(), now)).toBe('Hoy');
    expect(dayGroup(new Date(2026, 9, 29, 23, 59).getTime(), now)).toBe('Ayer');
    expect(dayGroup(new Date(2026, 9, 25).getTime(), now)).toBe('Esta semana');
    expect(dayGroup(new Date(2026, 9, 1).getTime(), now)).toBe('Antes');
  });
});

describe('sanitizeStore', () => {
  it('descarta lo que no tiene forma y no rompe con basura', () => {
    expect(sanitizeStore(null).convs).toEqual([]);
    expect(sanitizeStore({ convs: 'x' }).convs).toEqual([]);
    expect(sanitizeStore({ convs: [{ id: 1 }, { id: 'a', startedAt: 1, msgs: [] }] }).convs).toEqual([]);
  });
  it('una respuesta que quedó «Pensando…» vuelve como el fail-closed; los medios inválidos se van', () => {
    const s = sanitizeStore({ convs: [{ id: 'a', startedAt: 5, title: '', msgs: [
      { id: 1, role: 'kid', text: 'hola qué tal' },
      { id: 2, role: 'ai', text: '', pending: true },
      { id: 3, role: 'ai', text: 'ok', media: { videos: [{ id: 'v' }], images: [{ id: 'i', thumb: 't', full: 'f', title: 'x' }] } },
      { id: 4, role: 'system', text: 'no' },
    ], context: [{ role: 'user', content: 'hola' }, { role: 'tool', content: 'x' }] }] });
    const c = s.convs[0];
    expect(c.title).toBe('hola qué tal');
    expect(c.updatedAt).toBe(5);
    expect(c.msgs).toHaveLength(3);
    expect(c.msgs[1]).toEqual({ id: 2, role: 'ai', text: FAIL_CLOSED });
    expect(c.msgs[2]).toMatchObject({ media: { images: [{ id: 'i' }] } });
    expect((c.msgs[2] as { media?: { videos?: unknown } }).media?.videos).toBeUndefined();
    expect(c.context).toEqual([{ role: 'user', content: 'hola' }]);
  });
});

describe('capStore y pickResume', () => {
  it('se queda con las más recientes y con los últimos mensajes', () => {
    const s = capStore({ convs: [...Array.from({ length: MAX_CONVS + 5 }, (_, i) => conv(`c${i}`, i)), conv('big', 1000, MAX_MSGS + 10)] });
    expect(s.convs).toHaveLength(MAX_CONVS);
    expect(s.convs[0].id).toBe('big');
    expect(s.convs[0].msgs).toHaveLength(MAX_MSGS);
    expect(s.convs[0].msgs[0].id).toBe(11);
  });
  it('retoma la última si se movió hace menos de 30 min', () => {
    const now = 10_000_000;
    expect(pickResume({ convs: [conv('a', now - 60_000)] }, now)).toBe('a');
    expect(pickResume({ convs: [conv('a', now - 31 * 60_000)] }, now)).toBeNull();
    expect(pickResume({ convs: [] }, now)).toBeNull();
  });
});
