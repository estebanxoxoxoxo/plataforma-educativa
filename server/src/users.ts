// Usuarios de la plataforma (línea 14-oct-2026, docs/USUARIOS.md): Innerith es para grandes y chicos. Todos usan las
// MISMAS secciones; un ADULTO además tiene dependientes y su punto de menú "Familia" (la ex Zona de padres, sin portón de
// PIN: es SU menú) donde configura lo de ellos. Los CANDADOS son del dependiente: los apagados de funcionalidades y los
// horarios por sección rigen SOLO cuando el usuario activo es un chico; el adulto nunca queda afuera de su plataforma.
//
// FAKE / DEMO: tres usuarios seed EN CÓDIGO (no es config editable) — Ian (9, chico), Luna (12, chica; U3, 27-oct) y
// Andrés (38, adulto, el guardián de los dos: dependents ['ian','luna']) — y el usuario ACTIVO lo elige el cliente con el
// switch de la barra superior: guarda el id en localStorage['innerith.user'] y lo manda en CADA llamada como cabecera
// X-Innerith-User (src/api/index.ts). Acá solo se valida contra el seed: desconocida o ausente → ian (la app arranca como
// siempre). NO hay autenticación —cualquiera puede mandar la cabecera—: es el switch de demo. Cuando Esteban arme los
// usuarios en serio (cuentas, sesión de verdad, el portón del adulto), este módulo se reemplaza manteniendo las formas.
//   GET /api/users → { users: UserInfo[] }   (público; formas de src/api/types.ts: User + dependents?)
// U3 (familia con varios integrantes, docs/USUARIOS.md §9): la config "del chico" es POR INTEGRANTE (parent.json v3,
// schedules.json v2) y Familia elige a quién configura con `?member=<id>`: la regla es UNA sola, `memberFor` (abajo), y la
// usan parent.ts (las rutas /api/parent/* por integrante y los GET públicos del adulto) y schedule.ts (GET /api/schedules).
// Lo leen: index.ts (GET /api/me y los candados de horario y del chat), requestContext.ts (el usuario del pedido en curso:
// la "política vigente" de filtros, jueces, feed y chat), identity.ts (un avatar por usuario), market.ts, leaguesFake.ts y
// friendsFake.ts (sus 403 de funcionalidad apagada), parent.ts (la sesión implícita del adulto y `?member=`), schedule.ts
// y teachersFake.ts (mentores por beneficiario).
// U4: cada usuario tiene lo suyo (USUARIOS.md §10): XP/⚡/racha, canjes y guardarropas, wishlist, Learn, Mi espacio (Drive,
// listas, canales seguidos), liga, amigos y feed en vivo son POR USUARIO (perUser.ts y los archivos v2 de server/data); de
// la FAMILIA quedan el catálogo aprobado, After Day, la config del padre (U3) y las mentorías. `familyOf` (abajo) arma la
// familia de un usuario (la tabla de la semana de la familia).
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
  { id: 'luna', name: 'Luna', nick: 'Luna', age: 12, kind: 'child' },
  { id: 'andres', name: 'Andrés', nick: 'Andrés', age: 38, kind: 'adult', dependents: ['ian', 'luna'] },
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

/* ---------- integrantes de la familia (U3) ---------- */
/** Dependientes de TODOS los adultos del seed, en orden y sin repetir (['ian','luna']). Lo usan las migraciones y el
 *  armado de parent.json (un integrante por dependiente). */
export function allDependents(): string[] {
  const out: string[] = []
  for (const u of SEED) for (const d of u.dependents ?? []) if (!out.includes(d) && SEED.some(x => x.id === d)) out.push(d)
  return out
}
/** U4: la FAMILIA de un usuario, en el orden del seed y sin repetir: para un adulto, él + sus dependents; para un chico,
 *  los adultos que lo tienen como dependiente + todos los dependents de esos adultos (sus hermanos). Un chico sin
 *  guardián → solo él. Id desconocido → []. Lo usa la liga de la familia (leaguesFake.ts). */
export function familyOf(userId: string): UserInfo[] {
  const me = SEED.find(u => u.id === userId)
  if (!me) return []
  const ids = new Set<string>([me.id])
  const guardians = me.kind === 'adult' ? [me] : SEED.filter(u => u.kind === 'adult' && (u.dependents ?? []).includes(me.id))
  for (const g of guardians) { ids.add(g.id); for (const d of g.dependents ?? []) ids.add(d) }
  return SEED.filter(u => ids.has(u.id)).map(copy)
}

/** Los integrantes que este pedido puede configurar: adulto activo → sus dependents (en su orden); si no (un chico con el
 *  token DORMIDO del portón: la sesión la mira el que llama) → allDependents(). */
export function familyMembersFor(req: IncomingMessage): string[] {
  const me = actingUser(req)
  return me.kind === 'adult' ? [...(me.dependents ?? [])] : allDependents()
}
export type MemberError = 'Ese integrante no es de tu familia.' | 'No tenés integrantes en tu familia para configurar.'
/** `?member=` de Familia (trim + minúsculas, como X-Innerith-User). Ausente o vacío → el PRIMER integrante; uno que no es
 *  de la familia del pedido → 400. La sesión NO se mira acá (las rutas del padre la piden antes); con un CHICO activo los
 *  GET públicos ni llaman a esto (cada chico ve lo suyo y nunca lo de un hermano). */
export function memberFor(req: IncomingMessage, url: URL):
  | { ok: true; id: string }
  | { ok: false; status: 400; error: MemberError } {
  const members = familyMembersFor(req)
  if (!members.length) return { ok: false, status: 400, error: 'No tenés integrantes en tu familia para configurar.' }
  const id = (url.searchParams.get('member') ?? '').trim().toLowerCase()
  if (!id) return { ok: true, id: members[0] }
  return members.includes(id) ? { ok: true, id } : { ok: false, status: 400, error: 'Ese integrante no es de tu familia.' }
}

/* ---------- rutas ---------- */
export function usersRoutes(req: IncomingMessage, res: ServerResponse, url: URL): void {
  if (url.pathname.replace(/\/+$/, '') !== '/api/users') return send(res, 404, { error: 'not found' })
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
  return send(res, 200, { users: users() })
}
