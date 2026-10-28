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
import { AsyncLocalStorage } from 'node:async_hooks'
import type { IncomingMessage } from 'node:http'
import { actingUser, userById, type UserInfo } from './users'

const als = new AsyncLocalStorage<{ user: UserInfo }>()

/** Corre `fn` con el usuario ACTIVO del pedido como contexto (lo leen los filtros, jueces, feed y chat sin recibir req). */
export function runWithRequest<T>(req: IncomingMessage, fn: () => T): T {
  return als.run({ user: actingUser(req) }, fn)
}

/** El usuario del pedido en curso; undefined fuera de un pedido (arranque, timers sueltos). */
export const currentUser = (): UserInfo | undefined => als.getStore()?.user

/** U4: corre `fn` COMO otro usuario del seed (tests y, en U5, el cierre de semana de toda la familia). Mismo ALS: la
 *  política vigente de U3 también pasa a ser la de ese usuario, y perUser().now() su slice. Id desconocido → tira (es un
 *  error de programación). */
export function runAsUser<T>(id: string, fn: () => T): T {
  const user = userById(id)
  if (!user) throw new Error(`runAsUser: «${id}» no es un usuario del seed`)
  return als.run({ user }, fn)
}
