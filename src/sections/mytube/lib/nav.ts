import { useLocation, useNavigate } from 'react-router-dom';

/* Navegación de MyTube. En el POC el canal y la lista son OVERLAYS sobre MyTube (la solapa queda donde estaba y «Volver»
   hace history.back()); acá son rutas, así que lo mismo viaja en location.state (nunca en la URL: la solapa del POC es
   estado local que arranca en Canales). */
export type MtTab = 'canales' | 'listas';
/** Estado de la entrada de /mytube: qué solapa estaba abierta (para volver a ella). */
export type MtHomeState = { tab?: MtTab };
/** Estado de la entrada de un canal o una lista. `fromMyTube`: se abrió desde /mytube → «Volver» = Atrás. `backTo`: otra
 *  vista que la abrió (p. ej. el chip de canal del reproductor) y quiere que se vuelva a ella; `backState`: el state con
 *  el que ESA vista se había abierto, para devolvérselo al volver (el reproductor recupera su propio «Volver» y su cola,
 *  como al cerrar el overlay del canal en el POC). */
export type MtDetailState = { fromMyTube?: boolean; backTo?: string; backLabel?: string; backState?: unknown };

export const channelPath = (id: string) => `/mytube/canal/${encodeURIComponent(id)}`;
export const listPath = (id: number) => `/mytube/lista/${id}`;
export const videoPath = (id: string) => `/buscar/video/${id}`;

/** «Volver» de una vista de detalle: Atrás si vino de /mytube; si no, a quien la abrió o a la solapa de MyTube. */
export function useMtBack(fallbackTab: MtTab): () => void {
  const go = useNavigate();
  const st = (useLocation().state ?? null) as MtDetailState | null;
  return () => {
    if (st?.fromMyTube) go(-1);
    else if (st?.backTo) go(st.backTo, st.backState != null ? { state: st.backState } : undefined);
    else go('/mytube', { state: { tab: fallbackTab } satisfies MtHomeState });
  };
}
