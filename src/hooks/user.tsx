import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { actingUserId, api } from '../api';
import type { User } from '../api/types';

const UserCtx = createContext<User | undefined>(undefined);

/** El usuario ACTIVO (GET /api/me: el de la cabecera X-Innerith-User; el switch de la barra superior lo cambia y recarga).
 *  `kind` dice si es un chico (le rigen los candados de su familia) o un adulto (sin candados, con su menú Familia). */
export function UserProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User>();
  useEffect(() => {
    let alive = true;
    (async () => {
      // DEMO: cada carga de página arranca de los valores iniciales (la economía vive en RAM del
      // server). Se espera el reset ANTES de montar las páginas para que ninguna lea estado viejo.
      // (Va por fetch directo, sin el log de http(), pero con la cabecera del usuario activo como toda llamada.)
      await fetch('/api/demo/reset', { method: 'POST', headers: { 'X-Innerith-User': actingUserId() } }).catch(() => {});
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
