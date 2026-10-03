import { createContext, useContext, type ReactNode } from 'react';
import { api } from '../api';
import type { User } from '../api/types';
import { useAsync } from './useAsync';

const UserCtx = createContext<User | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { data } = useAsync(() => api.me(), []);
  return <UserCtx.Provider value={data}>{children}</UserCtx.Provider>;
}
export const useUser = () => useContext(UserCtx);

/** Última búsqueda (para el "‹ Resultados" del artículo y "‹ Videos" del reproductor). */
export const lastSearch = { url: '/descubrir/busqueda' };
