// Cliente de /api/mytube/* (tanda W5, porte Smarty). Formas ADITIVAS espejo del POC, documentadas también en
// server/src/mytube.ts: el coordinador las pasa a src/api/types.ts + src/api/index.ts al cierre (esta tanda no toca esos
// archivos). Mis listas y Seguir NO pasan por acá: usan el CRUD que ya existe (api.playlists*, api.toggleFollow).
import { ApiError } from '../../../api';

/** Un video aprobado como lo dibuja MyTube (subconjunto de YtVideo del POC). */
export type MtVideo = { videoId: string; title: string; thumb: string; /** segundos */ duration?: number; /** epoch ms */ addedAt?: number; channelId?: string; channelTitle?: string };
/** Tarjeta de Canales: SOLO seguidos con contenido, orden por channelId; `videos` cuenta sin descontar palabras bloqueadas. */
export type MtChannelCard = { channelId: string; title: string; thumb?: string; videos: number };
export type MtChannel = { channelId: string; title: string; handle?: string; /** curada (o la del padre) */ desc?: string; thumb?: string };
export type MtChannelPlaylist = { playlistId: string; title: string };
/** `channel: null` = no existe (sin videos aprobados). `pending` = enriquecimiento on-demand en curso: volver a pedir. */
export type MtChannelDetail = { channel: MtChannel | null; followed: boolean; total: number; playlists: MtChannelPlaylist[]; pending: boolean };

/* ---- panel del padre (públicos como /api/teachers; la pantalla vive tras el portón) ---- */
export type MtEntryType = 'video' | 'playlist' | 'canal';
export type MtEntry = { id: number; type: MtEntryType; url: string; title: string; /** = videoIds.length */ videos: number; channelId?: string; createdAt: number };
export type MtAdminState = { entries: MtEntry[]; /** videos aprobados: catálogo base + familia */ total: number; /** 0 = sin tope */ videoCap: number };
export type MtAdminChannel = { channelId: string; title: string; handle?: string; thumb?: string; desc: string; followed: boolean };
/** `error` = el código del POC (URL_INVALIDA, YA_EXISTE, SIN_KEY_YOUTUBE, …) o el mensaje de la falla. */
export type MtIngestResult = { ok: true; added: number; title: string } | { ok: false; error: string };

async function http<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  console.debug(`%c[api] → ${method} ${path} (backend)`, 'color:#C24B1F;font-weight:bold', body ?? '');
  const r = await fetch(path, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new ApiError(r.status, `HTTP ${r.status}`);
  const data = (await r.json()) as T;
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', data);
  return data;
}
const q = encodeURIComponent;

export const mytubeApi = {
  /* lado chico */
  channels: () => http<{ channels: MtChannelCard[] }>('/api/mytube/channels'),
  channel: (id: string) => http<MtChannelDetail>(`/api/mytube/channel?id=${q(id)}`),
  channelVideos: (id: string, offset: number, limit: number) =>
    http<{ videos: MtVideo[]; total: number }>(`/api/mytube/channel/videos?id=${q(id)}&offset=${offset}&limit=${limit}`),
  channelPlaylist: (playlistId: string) => http<{ videos: MtVideo[] }>(`/api/mytube/channel/playlist?id=${q(playlistId)}`),

  /* panel del padre */
  adminState: () => http<MtAdminState>('/api/mytube/admin/state'),
  adminChannels: () => http<{ channels: MtAdminChannel[] }>('/api/mytube/admin/channels'),
  add: (url: string) => http<MtIngestResult>('/api/mytube/admin/add', { url }),
  reingest: (id: number) => http<MtIngestResult>('/api/mytube/admin/reingest', { id }),
  remove: (id: number) => http<{ ok: boolean }>('/api/mytube/admin/remove', { id }),
  backfill: () => http<{ ok: true; completados: number; canales: number } | { ok: false; error: string }>('/api/mytube/admin/backfill', {}),
  dedup: () => http<{ ok: true; removed: number } | { ok: false; error: string }>('/api/mytube/admin/dedup', {}),
  setCap: (cap: string) => http<{ ok: boolean; videoCap: number }>('/api/mytube/admin/cap', { cap }),
  setChannelDesc: (channelId: string, desc: string) => http<{ ok: boolean }>('/api/mytube/admin/channel-desc', { channelId, desc }),
};
