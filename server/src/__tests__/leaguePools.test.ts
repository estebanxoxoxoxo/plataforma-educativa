import { describe, expect, it } from 'vitest';
import {
  ADULT_GEO_NICKS, ADULT_GEO_NICKS_PAIS, ADULT_LEAGUE, GEO_NICKS, GEO_NICKS_PAIS, GEO_POOLS, LEAGUE_NICKS, LUNA_LEAGUE, MORE_NICKS, NICKS,
} from '../leaguePools';
import { NPC_ROSTER } from '../npcRoster';
import { users } from '../users';

/* U4-B (docs/USUARIOS.md §10): cada usuario del demo compite en su liga pública con un pool de NPCs PROPIO. Regla 7 de
   docs/AGENTS.md: un chico tiene UN puntaje y aparece en UNA tabla, así que los pools son disjuntos entre sí, con los
   rankings de zona/país y con los NPCs amigos. */

/** Los 14 NPCs amigos (f1-f14). FS-BASE-B (hallazgo feedMix.test.ts:122): del seed REAL —npcRoster.ts, que friendsFake.ts
 *  verifica al arrancar—, no de una copia a mano. */
const FRIEND_NPCS = NPC_ROSTER.map((n) => n.nick);
/** Los nicks de los usuarios del seed: la fila "Vos" de cada tabla (users.ts; el de Ian sale de config.apodo). */
const USER_NICKS = users().map((u) => u.nick);

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const POOLS: Record<string, readonly string[]> = {
  ian: LEAGUE_NICKS,
  luna: LUNA_LEAGUE.pool,
  andres: ADULT_LEAGUE.pool,
  zona: GEO_NICKS,
  pais: GEO_NICKS_PAIS,
  // U4-B2: los tops de GRANDES que ve el adulto en zona y país.
  zonaGrandes: ADULT_GEO_NICKS,
  paisGrandes: ADULT_GEO_NICKS_PAIS,
};

describe('leaguePools', () => {
  it('Ian conserva su pool de siempre, en el mismo orden (sus semanas simuladas no cambian)', () => {
    expect(NICKS).toHaveLength(16);
    expect(MORE_NICKS).toHaveLength(44);
    expect(LEAGUE_NICKS).toEqual([...NICKS, ...MORE_NICKS]);
    expect(NICKS.slice(0, 3)).toEqual(['NachoNova', 'EmiFósil', 'ValenOrbita']);
    expect(MORE_NICKS[MORE_NICKS.length - 1]).toBe('MaxiRadar');
  });

  it('cada pool sin repetidos (sin mayúsculas ni acentos)', () => {
    for (const [name, pool] of Object.entries(POOLS)) {
      expect(new Set(pool.map(fold)).size, name).toBe(pool.length);
    }
  });

  it('todos los pools son disjuntos entre sí', () => {
    const names = Object.keys(POOLS);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const b = new Set(POOLS[names[j]].map(fold));
        const shared = POOLS[names[i]].filter((n) => b.has(fold(n)));
        expect(shared, `${names[i]} ∩ ${names[j]}`).toEqual([]);
      }
    }
  });

  it('ningún nick de liga ni de zona/país es un NPC amigo ni un usuario del seed', () => {
    const taken = new Set([...FRIEND_NPCS, ...USER_NICKS].map(fold));
    for (const [name, pool] of Object.entries(POOLS)) {
      expect(pool.filter((n) => taken.has(fold(n))), name).toEqual([]);
    }
  });

  it('zona y país de los chicos conservan sus nicks de siempre, en el mismo orden (sus tops no cambian)', () => {
    expect(GEO_NICKS).toEqual(['SofiAurora', 'ThiagoFoton', 'CamiCuarzo', 'BrunoTornado', 'AlmaBrisa', 'IkerMagma', 'LunaBoreal', 'DanteOrion', 'MiaTundra', 'TeoGranizo', 'VeraCeleste', 'SimonQuasar']);
    expect(GEO_NICKS_PAIS).toEqual(['RenzoPolaris', 'MiluVega', 'KiaraAndromeda', 'ManuLucero', 'AinaCenit', 'GaspiHorizonte', 'EmmaSolsticio', 'LucasRelampago', 'TatiArrecife', 'AxelMistral', 'AmpiSequoia', 'RomiEquinoccio']);
  });

  it('U4-B2: el chico ve el top de chicos de siempre y el adulto el de grandes, del mismo tamaño', () => {
    // El MISMO array (no una copia): la respuesta de un chico no cambia ni un byte.
    expect(GEO_POOLS.zona.child).toBe(GEO_NICKS);
    expect(GEO_POOLS.pais.child).toBe(GEO_NICKS_PAIS);
    expect(GEO_POOLS.zona.adult).toBe(ADULT_GEO_NICKS);
    expect(GEO_POOLS.pais.adult).toBe(ADULT_GEO_NICKS_PAIS);
    // Espejo de los de chicos (el top muestra 10 y rota 5 por semana simulada: hacen falta más de 10).
    expect(ADULT_GEO_NICKS).toHaveLength(GEO_NICKS.length);
    expect(ADULT_GEO_NICKS_PAIS).toHaveLength(GEO_NICKS_PAIS.length);
    expect(ADULT_GEO_NICKS.length).toBeGreaterThan(10);
  });

  it('las tablas del seed de Luna y de Andrés tienen 11 NPCs y están incluidas en su pool', () => {
    for (const lg of [LUNA_LEAGUE, ADULT_LEAGUE]) {
      expect(lg.table).toHaveLength(11);
      expect(lg.table.every((n) => lg.pool.includes(n))).toBe(true);
      expect(lg.pool.length).toBeGreaterThanOrEqual(30); // alcanza para muchos cierres simulados sin repetir caras
    }
  });
});
