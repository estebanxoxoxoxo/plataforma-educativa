// FS-BASE-B (hallazgo feedMix.test.ts:122): la IDENTIDAD de los 14 NPCs del demo (id, nick, si es chica) y el GRAFO de
// arranque de cada usuario (a quién tiene de amigo y quién le pidió contacto), en un módulo PURO —solo constantes, sin
// imports—, como leaguePools.ts. friendsFake.ts (que importa chat, llm y parent: los tests no lo pueden levantar entero) lo
// usa como fuente y FALLA FUERTE al arrancar si su lista de NPCs o su GRAPH_SEEDS se apartan de esto; los tests
// (feedMix, feedFake, leaguePools) importan de acá los invariantes del seed REAL en vez de copiarlos a mano (antes, si
// cambiaban los amigos de Luna o se sumaba un NPC, npm test seguía en verde contra la copia).
// Sumar o cambiar un NPC = tocarlo acá Y en friendsFake.ts (su persona, noticias, etc.): el arranque avisa si no coinciden.

export interface NpcIdentity { id: string; nick: string; girl: boolean }

/** Los 14 chicos del demo, en el orden de friendsFake.NPCS. */
export const NPC_ROSTER: readonly NpcIdentity[] = [
  { id: 'f1', nick: 'TomiCohete', girl: false },
  { id: 'f2', nick: 'LuliVolcan', girl: true },
  { id: 'f3', nick: 'MateoDino', girl: false },
  { id: 'f4', nick: 'CataEstrella', girl: true },
  { id: 'f5', nick: 'JuanchiRayo', girl: false },
  { id: 'f6', nick: 'MartuLuna', girl: true },
  { id: 'f7', nick: 'NicoRobot', girl: false },
  { id: 'f8', nick: 'TriniPiano', girl: true },
  { id: 'f9', nick: 'FedeAjedrez', girl: false },
  { id: 'f10', nick: 'MicaPincel', girl: true },
  { id: 'f11', nick: 'GeroColibrí', girl: false },
  { id: 'f12', nick: 'LeaTelescopio', girl: true },
  { id: 'f13', nick: 'NahueGol', girl: false },
  { id: 'f14', nick: 'ConiCiencia', girl: true },
]

/** El grafo de ARRANQUE de cada usuario del seed (ids de NPC): amigos en el orden de su lista y solicitudes ENTRANTES. */
export const GRAPH_IDS: Readonly<Record<string, { friends: readonly string[]; requests: readonly string[] }>> = {
  ian: { friends: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'], requests: ['f7'] },
  luna: { friends: ['f4', 'f6', 'f12', 'f8'], requests: ['f9'] },
  andres: { friends: [], requests: [] },
}

const nickOf = (id: string) => NPC_ROSTER.find(n => n.id === id)?.nick ?? id
/** Los nicks que un usuario ve en su feed al arrancar (amigos + quien le pidió contacto: friendsFake.isVisibleNpc). */
export function visibleNicksAtStart(user: string): string[] {
  const g = GRAPH_IDS[user]
  return g ? [...g.friends, ...g.requests].map(nickOf) : []
}
