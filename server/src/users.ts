// Usuarios de la plataforma (línea 14-oct-2026, docs/USUARIOS.md): Innerith es para grandes y chicos. Todos usan las
// MISMAS secciones; un ADULTO además tiene dependientes y su punto de menú "Familia" (la ex Zona de padres, sin portón de
// PIN: es SU menú) donde configura lo de ellos. Los CANDADOS son del dependiente: los apagados de funcionalidades y los
// horarios por sección rigen SOLO cuando el usuario activo es un chico; el adulto nunca queda afuera de su plataforma.
//
// FAKE / DEMO: dos usuarios seed EN CÓDIGO (no es config editable) — Ian (9, chico) y Andrés (38, adulto, su guardián) —
// y el usuario ACTIVO lo elige el cliente con el switch de la barra superior: guarda el id en
// localStorage['innerith.user'] y lo manda en CADA llamada como cabecera X-Innerith-User (src/api/index.ts). Acá solo se
// valida contra el seed: desconocida o ausente → ian (la app arranca como siempre). NO hay autenticación —cualquiera
// puede mandar la cabecera—: es el switch de demo. Cuando Esteban arme los usuarios en serio (cuentas, sesión de verdad,
// el portón del adulto), este módulo se reemplaza manteniendo las formas.
//   GET /api/users → { users: UserInfo[] }   (público; formas de src/api/types.ts: User + dependents?)
// Lo leen: index.ts (GET /api/me y los candados de horario y del chat), identity.ts (un avatar por usuario), market.ts,
// leaguesFake.ts y friendsFake.ts (sus 403 de funcionalidad apagada) y parent.ts (la sesión implícita del adulto).
// Compartido a propósito (USUARIOS.md §7): XP, ligas, Tienda, amigos, chat, Drive, MyTube, Learn y el contenido del Feed
// son LOS MISMOS para los dos usuarios del demo.
// Solo importa config.ts (el apodo de Ian sale de la config de la familia) y web.ts: no vuelve hacia ningún módulo.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from './config'
import { send } from './web'

/* ---------- formas (espejo de src/api/types.ts; el server no importa de src/) ---------- */
export type UserKind = 'adult' | 'child'
export interface UserInfo {
  id: string; name: string; age: number; nick: string; kind: UserKind
  /** Solo adultos: ids de sus dependientes (lo que configura en Familia). */
  dependents?: string[]
}

/* ---------- seed del demo ---------- */
const SEED: readonly UserInfo[] = [
  { id: 'ian', name: config.apodo || 'Ian', nick: config.apodo || 'Ian', age: 9, kind: 'child' },
  { id: 'andres', name: 'Andrés', nick: 'Andrés', age: 38, kind: 'adult', dependents: ['ian'] },
]
/** El usuario de siempre: el que rige sin cabecera (o con una que no es del seed). */
export const DEFAULT_USER_ID = 'ian'

const copy = (u: UserInfo): UserInfo => ({ ...u, ...(u.dependents ? { dependents: [...u.dependents] } : {}) })
/** Todos los usuarios del demo (copias), en el orden del seed. */
export const users = (): UserInfo[] => SEED.map(copy)
/** Un usuario del seed por id (copia); undefined si no existe. */
export function userById(id: string): UserInfo | undefined {
  const u = SEED.find(x => x.id === id)
  return u ? copy(u) : undefined
}

/** El usuario ACTIVO del pedido: la cabecera X-Innerith-User (Node entrega los nombres de cabecera en minúscula) validada
 *  contra el seed; desconocida o ausente → ian. */
export function actingUser(req: IncomingMessage): UserInfo {
  const raw = req.headers['x-innerith-user']
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return userById(id) ?? userById(DEFAULT_USER_ID)!
}
/** ¿El usuario activo es un adulto? (sin candados; sesión implícita de Familia) */
export const isAdultReq = (req: IncomingMessage): boolean => actingUser(req).kind === 'adult'
/** ¿El usuario activo es un chico? (le rigen los apagados y los horarios que fijó su familia) */
export const isChildReq = (req: IncomingMessage): boolean => actingUser(req).kind === 'child'

/* ---------- rutas ---------- */
export function usersRoutes(req: IncomingMessage, res: ServerResponse, url: URL): void {
  if (url.pathname.replace(/\/+$/, '') !== '/api/users') return send(res, 404, { error: 'not found' })
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
  return send(res, 200, { users: users() })
}
