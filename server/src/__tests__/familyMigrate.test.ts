import { describe, expect, it } from 'vitest';
import { MEMBER_FIELDS, upgradeParentRaw, upgradeSchedulesRaw } from '../familyMigrate';

/* U3 (familia con varios integrantes): las migraciones PURAS de parent.json (v1/v2 → v3) y schedules.json (v1 → v2). El
   saneo campo por campo y los integrantes nuevos (Luna con los defaults de fábrica) los hace parent.ts al cargar: acá solo
   la FORMA, que es lo que no se puede romper sin perder la config de Ian. */

const HASH = 'a'.repeat(64);
const ITEMS = [
  { id: 1, emoji: '🎮', title: '30 minutos de videojuegos', price: 150, stock: null, archived: false, createdAt: 1 },
  { id: 2, emoji: '🍿', title: 'Elegís la película del viernes', price: 250, stock: null, archived: true, createdAt: 2 },
];

describe('upgradeParentRaw', () => {
  it('v2 → v3: todo lo del chico pasa INTACTO a members[owner]; seq, tz y pinHash quedan de la familia', () => {
    const v2 = {
      version: 2, seq: 9, features: { tienda: true, ligas: false, amigos: true, chat: false }, items: ITEMS, pinHash: HASH,
      topics: { white: ['Biblia'], black: ['Halloween'] }, extraWords: ['tonto'], volume: { maxMusic: 40, maxNoise: 70 },
      preset: 'clasico-conservador', feedMotion: 'calmo', tz: 'America/New_York',
    };
    const up = upgradeParentRaw(v2, 'ian');
    expect(up.from).toBe(2);
    expect(up.raw).toEqual({
      version: 3, seq: 9, tz: 'America/New_York', pinHash: HASH,
      members: {
        ian: {
          features: v2.features, items: ITEMS, topics: v2.topics, extraWords: ['tonto'], volume: v2.volume,
          preset: 'clasico-conservador', feedMotion: 'calmo',
        },
      },
    });
    // nada de la config del chico queda colgado en el top-level
    for (const k of MEMBER_FIELDS) expect(k in up.raw).toBe(false);
  });

  it('v2 sin tz ni feedMotion (aditivos): tz null y el integrante sin el campo (el saneo pone el default)', () => {
    const up = upgradeParentRaw({ version: 2, seq: 3, features: {}, items: [], pinHash: HASH, topics: { white: [], black: [] }, extraWords: [], volume: {}, preset: null }, 'ian');
    expect(up.raw.tz).toBeNull();
    const ian = (up.raw.members as Record<string, Record<string, unknown>>).ian;
    expect('feedMotion' in ian).toBe(false);
    expect(ian.preset).toBeNull();
  });

  it('v1 (sin version ni los campos de la v2) → v3 con lo que había, from 1', () => {
    const up = upgradeParentRaw({ seq: 9, features: { tienda: true, ligas: true, amigos: true, chat: true }, items: ITEMS }, 'ian');
    expect(up.from).toBe(1);
    expect(up.raw.version).toBe(3);
    expect(up.raw.pinHash).toBeUndefined(); // el saneo pone el del demo
    expect(up.raw.members).toEqual({ ian: { features: { tienda: true, ligas: true, amigos: true, chat: true }, items: ITEMS } });
  });

  it('v3 pasa igual (misma referencia), from 3', () => {
    const v3 = { version: 3, seq: 17, tz: null, pinHash: HASH, members: { ian: { items: ITEMS }, luna: {} } };
    const up = upgradeParentRaw(v3, 'ian');
    expect(up.from).toBe(3);
    expect(up.raw).toBe(v3);
  });

  it('v3 sin members (o con members que no es un objeto) tira: el que llama lo trata como ilegible', () => {
    expect(() => upgradeParentRaw({ version: 3, seq: 1 }, 'ian')).toThrow();
    expect(() => upgradeParentRaw({ version: 3, members: [] }, 'ian')).toThrow();
    expect(() => upgradeParentRaw({ version: 3, members: 'ian' }, 'ian')).toThrow();
  });

  it('lo que no es un objeto tira', () => {
    for (const bad of [null, undefined, 3, 'hola', [1, 2], true]) expect(() => upgradeParentRaw(bad, 'ian')).toThrow();
  });
});

describe('upgradeSchedulesRaw', () => {
  const WEEK = Array.from({ length: 7 }, (_, d) => ({ open: d !== 0, from: '16:00', to: '19:00' }));

  it('v1 vacío {} (el archivo real de hoy) → {version:2, members:{ian:{}}}', () => {
    expect(upgradeSchedulesRaw({}, 'ian')).toEqual({ raw: { version: 2, members: { ian: {} } }, from: 1 });
  });

  it('v1 con secciones → todas a ian, tal cual', () => {
    const v1 = { mytube: { restrictionActive: true, week: WEEK }, chat: { restrictionActive: false, week: WEEK } };
    const up = upgradeSchedulesRaw(v1, 'ian');
    expect(up.from).toBe(1);
    expect(up.raw).toEqual({ version: 2, members: { ian: v1 } });
  });

  it('v2 pasa igual, from 2', () => {
    const v2 = { version: 2, members: { ian: {}, luna: { mytube: { restrictionActive: true, week: WEEK } } } };
    const up = upgradeSchedulesRaw(v2, 'ian');
    expect(up.from).toBe(2);
    expect(up.raw).toEqual(v2);
  });

  it('v2 sin members (o con members que no es un objeto) tira', () => {
    expect(() => upgradeSchedulesRaw({ version: 2 }, 'ian')).toThrow();
    expect(() => upgradeSchedulesRaw({ version: 2, members: [] }, 'ian')).toThrow();
  });

  it('lo que no es un objeto tira', () => {
    for (const bad of [null, 7, 'x', [], false]) expect(() => upgradeSchedulesRaw(bad, 'ian')).toThrow();
  });
});
