// Estado del demo POR USUARIO (U4, docs/USUARIOS.md §10). Un "slice" por id de usuario del seed; el del pedido en curso
// sale del contexto por pedido de U3 (requestContext.ts: AsyncLocalStorage), así las funciones de los módulos conservan
// su firma y nadie threadea ids. Fuera de un pedido (arranque, timers sueltos) rige DEFAULT_USER_ID, como actingUser()
// sin cabecera. Solo importa requestContext.ts y users.ts (no vuelve hacia ningún módulo de dominio).
// Reglas de uso (spec U4 §2.4): con `req` a mano el usuario es actingUser(req) (= el de now()); dentro de /api/parent/* y
// /api/mytube/admin/* el contexto es el ADULTO, así que lo del integrante se lee SIEMPRE con of(member), nunca con now().
// Lo PERSISTIDO por usuario (space.ts, learnResults.ts, la wishlist de market.ts) no usa esto: su mapa por usuario es el
// archivo en RAM y se escribe entero.
import { currentUser } from './requestContext'
import { DEFAULT_USER_ID } from './users'

export interface PerUser<T> {
  /** El slice del usuario del pedido en curso (lo crea con su seed la primera vez). */
  now(): T
  /** El de un usuario puntual: Familia (?member=), la liga de la familia, el reset. Lo crea con su seed si no existe. */
  of(userId: string): T
  /** El id con el que resolvería now() (para logs y para los accesos explícitos). */
  nowId(): string
  /** Vuelve al seed el de un usuario; sin id, TODOS (POST /api/demo/reset {scope:'all'}). */
  reset(userId?: string): void
  /** Los ids que ya tienen slice (para recorrer: "dejar de seguir en todos los espacios", sumar canjes). */
  ids(): string[]
}

export function perUser<T>(seedFor: (userId: string) => T): PerUser<T> {
  const m = new Map<string, T>()
  const of = (id: string): T => { let s = m.get(id); if (s === undefined) { s = seedFor(id); m.set(id, s) } return s }
  const nowId = () => currentUser()?.id ?? DEFAULT_USER_ID
  return {
    now: () => of(nowId()), of, nowId,
    reset: (id?: string) => { if (id === undefined) m.clear(); else m.set(id, seedFor(id)) },
    ids: () => [...m.keys()],
  }
}
