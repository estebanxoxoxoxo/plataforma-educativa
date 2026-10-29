import { describe, expect, it } from 'vitest';
import { MEMBER_FIELDS, upgradeCycleRaw, upgradeParentRaw, upgradeSchedulesRaw } from '../familyMigrate';

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

/* Ciclo del día (F1, 28-oct): schedules.json v1/v2 → v3. Lo de antes NO se convierte (semana por sección ≠ rangos del
   día): cada integrante arranca sin rangos y schedule.ts deja el original UNA vez en .pre-v3. */
describe('upgradeCycleRaw', () => {
  const WEEK = Array.from({ length: 7 }, (_, d) => ({ open: d !== 0, from: '16:00', to: '19:00' }));
  const DEPS = ['ian', 'luna'];

  it('v2 (el archivo real de hoy) → v3 con cada integrante sin rangos, from 2', () => {
    const v2 = { version: 2, members: { ian: {}, luna: { mytube: { restrictionActive: true, week: WEEK } } } };
    expect(upgradeCycleRaw(v2, DEPS)).toEqual({ raw: { version: 3, members: { ian: { ranges: [] }, luna: { ranges: [] } } }, from: 2 });
  });

  it('v1 (con o sin secciones) → v3 sin rangos, from 1: nada se convierte', () => {
    expect(upgradeCycleRaw({}, DEPS).from).toBe(1);
    const up = upgradeCycleRaw({ chat: { restrictionActive: true, week: WEEK } }, DEPS);
    expect(up).toEqual({ raw: { version: 3, members: { ian: { ranges: [] }, luna: { ranges: [] } } }, from: 1 });
  });

  it('v3 pasa tal cual (el saneo de los rangos lo hace schedule.ts), from 3', () => {
    const v3 = { version: 3, members: { ian: { ranges: [{ id: 'a', name: 'Mañana', from: '08:00', to: '12:00', sections: ['aprender'] }] }, luna: { ranges: [] } } };
    const up = upgradeCycleRaw(v3, DEPS);
    expect(up.from).toBe(3);
    expect(up.raw).toEqual(v3);
  });

  it('v3 sin members (o con members que no es un objeto) tira; lo que no es un objeto tira', () => {
    expect(() => upgradeCycleRaw({ version: 3 }, DEPS)).toThrow();
    expect(() => upgradeCycleRaw({ version: 3, members: [] }, DEPS)).toThrow();
    for (const bad of [null, 7, 'x', [], false]) expect(() => upgradeCycleRaw(bad, DEPS)).toThrow();
  });

  it('nunca crea un integrante "__proto__" (ni le cambia el prototipo a members)', () => {
    // FS-BASE-B (hallazgo familyMigrate.test.ts:132): `members['__proto__'] = …` sobre un objeto literal NO crea una clave
    // propia —cambia el PROTOTIPO—, así que mirar solo hasOwn quedaba en verde aunque se borrara la guarda.
    const members = upgradeCycleRaw({}, ['__proto__', 'ian']).raw.members;
    expect(Object.hasOwn(members, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(members)).toBe(Object.prototype);
    expect(Object.keys(members)).toEqual(['ian']);
    expect((members as Record<string, unknown>).ranges).toBeUndefined(); // nada heredado
  });

  it('FS-BASE-B (hallazgo familyMigrate.ts:31): una versión DESCONOCIDA tira (el que llama la aparta como .roto-*); ausente = v1', () => {
    for (const version of ['3', 4, 0, null, 'v3', 2.5]) expect(() => upgradeCycleRaw({ version, members: { ian: { ranges: [] } } }, DEPS), String(version)).toThrow(/versión desconocida/);
    expect(upgradeCycleRaw({ version: 1 }, DEPS).from).toBe(1);
    expect(upgradeCycleRaw({}, DEPS).from).toBe(1);
  });
});

describe('upgradeParentRaw con una versión desconocida (FS-BASE-B, hallazgo familyMigrate.ts:31)', () => {
  it('"3" de texto, 4 o cualquier otra cosa presente → tira; antes se armaba como un v1 y Luna quedaba con la config de fábrica', () => {
    for (const version of ['3', 4, 0, null, true]) expect(() => upgradeParentRaw({ version, seq: 9, members: { ian: {} } }, 'ian'), String(version)).toThrow(/versión desconocida/);
  });
  it('los v1 de siempre (sin version) y los v2/v3 siguen igual', () => {
    expect(upgradeParentRaw({ features: {} }, 'ian').from).toBe(1);
    expect(upgradeParentRaw({ version: 2, features: {} }, 'ian').from).toBe(2);
    expect(upgradeParentRaw({ version: 3, members: {} }, 'ian').from).toBe(3);
  });
});
