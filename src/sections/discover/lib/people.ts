// Buscar → Personas (tanda F2, 12-oct; pedido de Esteban: "los amigos se buscan por buscador por nombre de usuario").
// Habla con el server fake de amigos (server/src/friendsFake.ts) con dos rutas ADITIVAS.
// PENDIENTE DEL COORDINADOR: pasar estas formas a src/api/types.ts y estas dos llamadas a src/api/index.ts (api.searchPeople
// y api.askToConnect, con su http()); entonces este archivo se borra y PeopleResults llama a `api` como todos. Hasta
// entonces van por un fetch local que imita a http(): loguea igual (`[api] → …`) y tira ApiError (fail-closed en la UI).
//   GET  /api/friends/search?q=          → PeopleSearchResponse  (nick parcial, sin mayúsculas ni acentos; mínimo 2 letras)
//   POST /api/friends/requests/send {id} → ConnectResult         ("Quiero contactarlo": solicitud saliente)
// MODERACIÓN: de cada chico solo viaja su nick, su línea de estado (texto fijo del demo), el color y la ropa de su avatar y
// la relación con Ian. Nada de texto libre. Con Amigos apagado por la familia, las dos responden 403.
import { ApiError } from '../../../api';
import type { Friend } from '../../../api/types';

/** friend = ya son amigos · incoming = él le pidió contacto a Ian · sent = Ian se lo pidió y espera · none = nada todavía. */
export type PersonRelation = 'friend' | 'incoming' | 'sent' | 'none';
/** Un chico encontrado por su nombre de usuario. */
export type PersonResult = {
  id: string; nick: string; color: string;
  /** Su línea de estado ("Practicando: Fracciones", "Racha de 9 días"). */
  status: string;
  /** La prenda que tiene puesta (id del set de ropa) o null. */
  accessory: string | null;
  relation: PersonRelation;
};
export type PeopleSearchResponse = { query: string; people: PersonResult[] };
/** `ok:false` = rechazo de negocio con el motivo (p. ej. "¡X ya es tu amigo!"); `friend` = quedaron amigos al toque. */
export type ConnectResult = { ok: boolean; relation: PersonRelation; error?: string; friend?: Friend };

/** Largo mínimo de una búsqueda de personas (en letras, sin contar espacios): el mismo que exige el server. */
export const PEOPLE_MIN = 2;
export const peopleQueryLen = (q: string) => q.replace(/\s+/g, '').length;

async function http<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  console.debug(`%c[api] → ${method} ${path} (backend)`, 'color:#C24B1F;font-weight:bold', body ?? '');
  const r = await fetch(path, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new ApiError(r.status, `HTTP ${r.status}`);
  const data = (await r.json()) as T;
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', data);
  return data;
}

/** Busca chicos de Innerith por su nombre de usuario. */
export const searchPeople = (q: string) => http<PeopleSearchResponse>(`/api/friends/search?q=${encodeURIComponent(q)}`);
/** "Quiero contactarlo": le manda a ese chico una solicitud de Ian (en el demo, la acepta solo a los segundos). */
export const askToConnect = (id: string) => http<ConnectResult>('/api/friends/requests/send', { id });
