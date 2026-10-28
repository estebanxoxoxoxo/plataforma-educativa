// U4 (cada uno lo suyo, docs/USUARIOS.md §10): las migraciones PURAS de los tres archivos del chico que pasan a ser POR
// USUARIO — learn-results.json, wishlist.json y space.json (v1 → v2: TODO lo existente pasa ENTERO a `owner`, que en el
// demo es ian). Sin fs ni config, igual que familyMigrate.ts (U3) y por la misma razón: space.ts, learnResults.ts y
// market.ts leen y ESCRIBEN server/data/ al importarse, así que solo lo puro se testea con vitest sin tocar datos reales
// (server/src/__tests__/userDataMigrate.test.ts). El respaldo .pre-v2, el saneo fila por fila y la copia .roto-* de un
// archivo ilegible los hace cada módulo al cargar: acá solo la FORMA, que es lo que no se puede romper sin perder lo de Ian.
import { isObject } from './familyMigrate'

export type Up<T> = { raw: T; from: 1 | 2 }

/** learn-results.json: v1 = un array de filas (las de ian) → { version: 2, users: { [owner]: filas } }. v2 pasa igual.
 *  Tira si no se puede leer (ni v1 ni v2: el módulo lo trata como ilegible). */
export function upgradeLearnRaw(raw: unknown, owner: string): Up<{ version: 2; users: Record<string, unknown> }> {
  if (Array.isArray(raw)) return { raw: { version: 2, users: { [owner]: raw } }, from: 1 }
  if (isObject(raw) && raw.version === 2 && isObject(raw.users)) return { raw: raw as never, from: 2 }
  throw new Error('learn-results.json no es ni v1 (array) ni v2')
}

/** wishlist.json: v1 = array de ids (los de ian) → { version: 2, users: { [owner]: ids } }. Misma regla. */
export function upgradeWishRaw(raw: unknown, owner: string): Up<{ version: 2; users: Record<string, unknown> }> {
  if (Array.isArray(raw)) return { raw: { version: 2, users: { [owner]: raw } }, from: 1 }
  if (isObject(raw) && raw.version === 2 && isObject(raw.users)) return { raw: raw as never, from: 2 }
  throw new Error('wishlist.json no es ni v1 (array) ni v2')
}

/** space.json: v1 = { seq?, folders?, items?, playlists?, follows? } (sin `version`) → v2. A8: un v1 con `follows` vacío o
 *  ausente migra con `defaultFollows` (lo que hacía la carga de antes al arrancar, UNA vez). */
export function upgradeSpaceRaw(raw: unknown, owner: string, defaultFollows: readonly string[]):
  Up<{ version: 2; seq: number; users: Record<string, unknown> }> {
  if (!isObject(raw)) throw new Error('space.json no es un objeto')
  if (raw.version === 2) { if (!isObject(raw.users)) throw new Error('v2 sin users'); return { raw: raw as never, from: 2 } }
  const arr = (k: string) => (Array.isArray(raw[k]) ? raw[k] as unknown[] : [])
  const follows = arr('follows')
  return { raw: { version: 2, seq: Number(raw.seq) > 0 ? Number(raw.seq) : 1,
                  users: { [owner]: { folders: arr('folders'), items: arr('items'), playlists: arr('playlists'),
                                      follows: follows.length ? follows : [...defaultFollows] } } }, from: 1 }
}
