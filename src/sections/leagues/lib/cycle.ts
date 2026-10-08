import type { AssignedLeague } from '../../../api/types';

/** Ciclo semanal de la liga (VISION §7, capa 4): cómo se nombran el cierre y las medallas.
 *  Lo usan el hero de Ligas y el aside del feed, así los dos dicen lo mismo con las mismas palabras. */
export type Medal = NonNullable<NonNullable<AssignedLeague['lastWeek']>['medal']>;

export const MEDAL_INFO: Record<Medal, { emoji: string; name: string; pos: number }> = {
  oro: { emoji: '🥇', name: 'Medalla de oro', pos: 1 },
  plata: { emoji: '🥈', name: 'Medalla de plata', pos: 2 },
  bronce: { emoji: '🥉', name: 'Medalla de bronce', pos: 3 },
};

/** 0 → "¡Cierra hoy!" · 1 → "Cierra en 1 día" · N → "Cierra en N días". */
export const closesLabel = (days: number) => (days <= 0 ? '¡Cierra hoy!' : `Cierra en ${days} ${days === 1 ? 'día' : 'días'}`);

/** "2º la semana pasada" */
export const lastWeekLabel = (pos: number) => `${pos}º la semana pasada`;
