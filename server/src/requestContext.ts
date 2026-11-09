// Contexto POR PEDIDO (U3, familia con varios integrantes; docs/USUARIOS.md §9). La config "del chico" no solo la leen los
// puntos que tienen `req`: la leen ~25 llamadas a matchBlockedWord(text) con el default de la familia (filters.ts), el
// armado del feed, los jueces, el chat, los artículos y la respuesta EN VUELO de los NPC. Threadear el id del chico por
// todo eso sería inviable y frágil, así que el server corre cada pedido dentro de un AsyncLocalStorage con el usuario
// ACTIVO (index.ts: runWithRequest) y las funciones de "política vigente" de parent.ts (familyBlockedTerms, familyTopics,
// blackTopicsAll, whiteTopicsAll, feedMotion, featureOnNow…) lo leen SIN cambiar de firma.
// ALS propaga el contexto por await, .then y setTimeout: la respuesta de un NPC que se genera después de contestar el
// pedido (friendsFake.ts: scheduleReply) sigue sabiendo qué chico escribió.
// Fuera de un pedido (el precalentado del índice de videos al arrancar, un timer suelto) no hay usuario: parent.ts aplica
// la política "sin pedido" (la unión de todos: esconde de más, nunca de menos).
// i18n (pedido 9-nov): el mismo store lleva el IDIOMA del pedido (cabecera X-Smarty-Lang que manda el cliente en toda llamada,
// src/api/index.ts). Los textos que viajan al usuario se resuelven al servir con L() de lang.ts, que lo lee de acá sin
// threadear nada. Fuera de un pedido (o sin cabecera, o con un valor raro) es 'es': los tests y la app de siempre no cambian.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { IncomingMessage } from 'node:http'
import { actingUser, userById, type UserInfo } from './users'

export type Lang = 'es' | 'en'

const als = new AsyncLocalStorage<{ user: UserInfo; lang: Lang }>()

/** El idioma que pide el cliente: 'en' solo si la cabecera x-smarty-lang es EXACTAMENTE 'en'; cualquier otra cosa, 'es'. */
const langOf = (req: IncomingMessage): Lang => (req.headers['x-smarty-lang'] === 'en' ? 'en' : 'es')

/** Corre `fn` con el usuario ACTIVO y el idioma del pedido como contexto (lo leen los filtros, jueces, feed y chat sin recibir req). */
export function runWithRequest<T>(req: IncomingMessage, fn: () => T): T {
  return als.run({ user: actingUser(req), lang: langOf(req) }, fn)
}

/** El usuario del pedido en curso; undefined fuera de un pedido (arranque, timers sueltos). */
export const currentUser = (): UserInfo | undefined => als.getStore()?.user

/** El idioma del pedido en curso ('es' | 'en'); 'es' fuera de un pedido (arranque, timers sueltos, tests). */
export const requestLang = (): Lang => als.getStore()?.lang ?? 'es'

/** U4: corre `fn` COMO otro usuario del seed (tests y, en U5, el cierre de semana de toda la familia). Mismo ALS: la
 *  política vigente de U3 también pasa a ser la de ese usuario, y perUser().now() su slice. Id desconocido → tira (es un
 *  error de programación).
 *  `lang` (i18n, 9-nov): sin pasarlo, HEREDA el idioma del pedido en curso (requestLang(): 'es' fuera de un pedido), así
 *  el cierre de semana o el sync de medallas que corre dentro de un pedido en inglés sigue en inglés. */
export function runAsUser<T>(id: string, fn: () => T, lang: Lang = requestLang()): T {
  const user = userById(id)
  if (!user) throw new Error(`runAsUser: «${id}» no es un usuario del seed`)
  return als.run({ user, lang }, fn)
}
