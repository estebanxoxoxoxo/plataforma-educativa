// Zona PINNEADA del Feed (tanda F2; pedido de Esteban, 12-oct: "en el Feed arriba tiene que tener una zona pinneada con
// notificaciones destacadas. Una de las destacadas es la de personas que quieren contactarse con uno").
// Pensada para CRECER: es una lista de destacados, cada uno con su `kind` y su tarjeta (components/PinnedZone elige cuál
// dibujar). Hoy hay uno solo:
//   · 'contact' = "X quiere contactarse con vos": las solicitudes de amistad pendientes (api.requests(), del server fake de
//     amigos; NO salen del feed), con Aceptar / "Ahora no" en el lugar.
// Sin destacados, la zona NO existe (nada de cajas vacías). Con Amigos apagado por la familia, tampoco.
// Para sumar un destacado nuevo: un `kind` más acá (con lo que necesite su tarjeta), su tarjeta en cards/ y su rama en
// PinnedZone; el contenedor (FeedPage) decide de dónde salen y qué hacen sus botones.
import type { FriendRequest } from '../../../api/types';

/** En qué anda un destacado: listo · esperando al server · yéndose (se pliega). */
export type PinPhase = 'idle' | 'busy' | 'out';

export type Highlight = {
  /** Único en la zona (`<kind>:<id>`). */
  key: string;
  phase: PinPhase;
} & (
  /** Alguien quiere contactarse con Ian. `accepted` = ya dijo que sí: la tarjeta festeja un instante antes de irse. */
  | { kind: 'contact'; req: FriendRequest; accepted: boolean }
);

export const contactKey = (requestId: string) => `contact:${requestId}`;

/** Une lo que trajo el server con lo que está en pantalla: lo que se está respondiendo o yéndose se queda hasta terminar
 *  su animación (aunque el server ya no lo mande), lo que sigue pendiente se actualiza, y lo nuevo entra al final. */
export function mergeContacts(cur: Highlight[], requests: FriendRequest[]): Highlight[] {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const kept = cur.flatMap((h): Highlight[] => {
    if (h.kind !== 'contact') return [h];
    if (h.phase !== 'idle') return [h];
    const r = byId.get(h.req.id);
    return r ? [{ ...h, req: r }] : [];
  });
  const fresh = requests
    .filter((r) => !cur.some((h) => h.kind === 'contact' && h.req.id === r.id))
    .map((r): Highlight => ({ key: contactKey(r.id), kind: 'contact', req: r, phase: 'idle', accepted: false }));
  return [...kept, ...fresh];
}
