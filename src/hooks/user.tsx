import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { User } from '../api/types';

const UserCtx = createContext<User | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User>();
  useEffect(() => {
    let alive = true;
    (async () => {
      // DEMO: cada carga de página arranca de los valores iniciales (la economía vive en RAM del
      // server). Se espera el reset ANTES de montar las páginas para que ninguna lea estado viejo.
      await fetch('/api/demo/reset', { method: 'POST' }).catch(() => {});
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
