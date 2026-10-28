import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { actingUserId, api, consumeKeepDemo } from '../api';
import type { User } from '../api/types';

const UserCtx = createContext<User | undefined>(undefined);

/** El reset de ESTA carga de página, decidido y disparado UNA sola vez por módulo: StrictMode (dev) monta el efecto dos
 *  veces y la segunda vería la marca del switch ya consumida y resetearía igual (además, antes salían dos POST). */
let bootReset: Promise<void> | null = null;
function resetForThisLoad(): Promise<void> {
  bootReset ??= consumeKeepDemo()
    ? Promise.resolve()
    : fetch('/api/demo/reset', { method: 'POST', headers: { 'X-Innerith-User': actingUserId() } }).then(() => {}, () => {});
  return bootReset;
}

/** El usuario ACTIVO (GET /api/me: el de la cabecera X-Innerith-User; el switch de la barra superior lo cambia y recarga).
 *  `kind` dice si es un chico (le rigen los candados de su familia) o un adulto (sin candados, con su menú Familia). */
export function UserProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User>();
  useEffect(() => {
    let alive = true;
    (async () => {
      // DEMO (regla 9, U4 — docs/USUARIOS.md §10): cada carga de página resetea SOLO al usuario activo (la economía y lo
      // social viven en RAM del server, un slice por usuario); la carga que sigue al switch de usuario NO resetea: la demo
      // de la familia sigue (consumeKeepDemo la marca y la consume: el próximo F5 ya resetea). Se espera el reset ANTES de
      // montar las páginas para que ninguna lea estado viejo. (Va por fetch directo, sin el log de http(), pero con la
      // cabecera del usuario activo como toda llamada.)
      await resetForThisLoad();
      const u = await api.me().catch(() => undefined);
      if (alive) { setUser(u); setBooted(true); }
    })();
    return () => { alive = false; };
  }, []);
  if (!booted) return null;
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>;
}
export const useUser = () => useContext(UserCtx);

/** Última búsqueda (para el "‹ Resultados" del artículo y "‹ Videos" del reproductor). */
export const lastSearch = { url: '/buscar' };
