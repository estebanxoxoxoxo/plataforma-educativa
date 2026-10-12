import type { AssignedLeague, CloseWeekResult } from '../../../api/types';

/** Ciclo semanal de la liga (VISION §7, capa 4): cómo se nombran el cierre y las medallas.
 *  Lo usan el hero de Ligas y las noticias de liga del Feed, así los dos dicen lo mismo con las mismas palabras. */
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

/** Evento de ventana que dispara Ligas después de cada cierre (botón de demo "Simular cierre de semana"); `detail` = el
 *  CloseWeekResult. Para lo que muestra el ciclo fuera de Ligas y quiera volver a pedirlo en el acto. */
export const LEAGUE_WEEK_CLOSED = 'innerith:league-week-closed';

/** Lo que cuenta el aviso del cierre de semana (botón de demo "Simular cierre de semana"), armado SOLO con lo que
 *  devolvió el server (CloseWeekResult): honesto con o sin medalla, y amable si toca bajar de liga.
 *  - Podio: "¡Cerró la semana y ganaste la medalla de plata!" · "Subís a la Liga Estrella" (en la más alta: "Seguís…").
 *  - Sin podio: "¡Cerró la semana!" · "Seguís en la Liga Cometa" + "¡Esta semana vamos por el podio!".
 *  - 10º-12º: "Esta semana te toca la Liga Chispa" + "¡A sumar XP para volver a subir!". */
export function closeCopy(r: CloseWeekResult): { title: string; result: string; move: string; cheer: string | null } {
  const m = r.closed.medal ? MEDAL_INFO[r.closed.medal] : null;
  const next = r.next.league.name;
  const xp = r.closed.xp > 0 ? ` con ${r.closed.xp.toLocaleString('es-AR')} XP` : '';
  const { movement } = r.next;
  return {
    title: m ? `¡Cerró la semana y ganaste la ${m.name.toLowerCase()}!` : '¡Cerró la semana!',
    result: `Saliste ${r.closed.pos}º de ${r.closed.total} en la ${r.closed.league.name}${xp}.`,
    // El podio solo se queda en la liga más alta de la escalera: no hay más arriba.
    move: movement === 'sube' ? `Subís a la ${next}` : movement === 'baja' ? `Esta semana te toca la ${next}` : m ? `Seguís en la ${next}, la más alta` : `Seguís en la ${next}`,
    cheer: movement === 'baja' ? '¡A sumar XP para volver a subir!' : movement === 'queda' && !m ? '¡Esta semana vamos por el podio!' : null,
  };
}
