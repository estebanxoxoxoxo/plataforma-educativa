import { describe, expect, it } from 'vitest';
import type { MtAdminChannel, MtEntry } from '../../../../api/types';
import { channelMatches, explainYtError, groupChannels, parseBatch, removeText } from '../mytubeAdmin';

/* Familia → MyTube (tanda F2): lo puro del panel del padre (la grilla de canales como la del chico + el agregar por URL). */

const ch = (channelId: string, title: string, handle?: string): MtAdminChannel => ({ channelId, title, handle, desc: '', followed: false });
const en = (id: number, channelId: string | undefined, createdAt: number, type: MtEntry['type'] = 'video'): MtEntry =>
  ({ id, type, url: `https://youtu.be/v${id}`, title: `Entrada ${id}`, videos: id, channelId, createdAt });

describe('agregar', () => {
  it('parseBatch: una URL por línea o separadas por ";", sin vacíos', () => {
    expect(parseBatch(' a \n\n b ; c;')).toEqual(['a', 'b', 'c']);
    expect(parseBatch('   ')).toEqual([]);
  });
  it('explainYtError: los códigos del POC en castellano; el resto, recortado', () => {
    expect(explainYtError('SIN_KEY_YOUTUBE')).toMatch(/API key/);
    expect(explainYtError('URL_INVALIDA')).toBe('URL no reconocida');
    expect(explainYtError('YA_EXISTE')).toMatch(/ya está/);
    expect(explainYtError('Error: algo raro')).toBe('algo raro');
    expect(explainYtError('x'.repeat(200))).toHaveLength(80);
  });
  it('removeText: lo que se borra en cascada, en singular y plural', () => {
    expect(removeText({ title: 'Uno', videos: 1 })).toContain('Se borra su video');
    expect(removeText({ title: 'Varios', videos: 12 })).toContain('Se borran sus 12 videos');
    expect(removeText({ title: 'Nada', videos: 0 })).toContain('No tiene videos aprobados');
    expect(removeText({ title: 'X', videos: 1 })).toMatch(/^¿Eliminar «X»\?.*No se puede deshacer\.$/);
  });
});

describe('groupChannels (la grilla del padre)', () => {
  const channels = [ch('UCa', 'Alfa'), ch('UCb', 'Beta'), ch('UCc', 'Gamma'), ch('UCd', 'Delta')];
  it('primero lo que sumó la familia (del más reciente al más viejo), las entradas sin canal conocido aparte, y el resto en el orden del server', () => {
    const g = groupChannels([en(1, 'UCc', 100), en(2, 'UCa', 300), en(3, 'UCc', 200), en(4, undefined, 50), en(5, 'UCzz', 400)], channels);
    expect(g.family.map((f) => f.channel.channelId)).toEqual(['UCa', 'UCc']); // UCa: 300 · UCc: 200
    expect(g.family[1].entries.map((e) => e.id)).toEqual([3, 1]); // las de un canal, de la más nueva a la más vieja
    expect(g.orphans.map((e) => e.id)).toEqual([5, 4]); // sin channelId o con un canal que no está en la lista
    expect(g.catalog.map((c) => c.channelId)).toEqual(['UCb', 'UCd']); // sin repetir los de la familia
  });
  it('sin entradas: todo es catálogo', () => {
    const g = groupChannels([], channels);
    expect(g.family).toEqual([]);
    expect(g.orphans).toEqual([]);
    expect(g.catalog).toHaveLength(4);
  });
});

describe('channelMatches (Buscar un canal)', () => {
  it('por título o @handle, sin mayúsculas ni tildes; vacío = todos', () => {
    const c = ch('UCx', 'La Hiperactina Ciencia', '@lahiperactina');
    expect(channelMatches(c, '')).toBe(true);
    expect(channelMatches(c, '  ')).toBe(true);
    expect(channelMatches(c, 'hiperact')).toBe(true);
    expect(channelMatches(c, 'CIENCIA')).toBe(true);
    expect(channelMatches(ch('UCy', 'Educación Física'), 'educacion')).toBe(true);
    expect(channelMatches(c, '@lahiper')).toBe(true);
    expect(channelMatches(c, 'veritasium')).toBe(false);
  });
});
