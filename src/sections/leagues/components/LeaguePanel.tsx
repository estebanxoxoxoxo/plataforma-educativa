import type { ReactNode } from 'react';

/** Panel de una solapa de Ligas: el nombre del lugar (o de la liga) chiquito arriba y su tabla.
 *  Los tres paneles viven apilados en la misma celda (ver .lpanels): el inactivo queda oculto (visibility),
 *  así la caja mide lo que el más alto y cambiar de solapa no mueve el hero ni el scroll. */
export const LeaguePanel = ({ on, label, caption, children }: { on: boolean; label: string; caption: string; children: ReactNode }) => (
  <div className={`lpanel${on ? ' on' : ''}`} role="tabpanel" aria-label={label}>
    <p className="lcap">{caption}</p>
    {children}
  </div>
);
