// Familia → MyTube (tanda F2, 28-oct; ex «YouTube», porte Smarty W5): lo del panel del padre que no es pantalla. Lo PURO
// (tests en __tests__/mytubeAdmin.test.ts): partir un lote de URLs, explicar los errores de la ingesta, el texto de la
// confirmación de "Eliminar" y cómo se agrupan los canales en la grilla. Y `useEntryOps`: Reingestar/Eliminar una entrada
// (lo comparten la grilla y la vista de un canal). Nada optimista: después de cada operación se relee del server.
import { useState } from 'react';
import { api } from '../../../api';
import type { MtAdminChannel, MtEntry, MtEntryType } from '../../../api/types';
import { parentCall } from './adultGate';
import { L } from '../../../shared/lib/lang';

/** Parte un texto de lote en entradas: una por línea o separadas por ";" (parseBatch del POC). */
export function parseBatch(text: string): string[] {
  return text.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
}

/** explainYtError del POC (la key vive en el server, no en Ajustes). */
export function explainYtError(err: string): string {
  if (err.includes('SIN_KEY_YOUTUBE')) return L('necesita API key de YouTube (falta en el servidor)', 'needs a YouTube API key (missing on the server)');
  if (err.includes('URL_INVALIDA')) return L('URL no reconocida', 'URL not recognized');
  if (err.includes('YA_EXISTE')) return L('ya está en la lista (no se duplicó)', 'already on the list (not duplicated)');
  return err.replace(/^Error:\s*/, '').slice(0, 80);
}
/** i18n: función (no constante) para que resuelva el idioma al usarse. */
export const NET = () => L('no hubo respuesta del servidor', 'the server didn’t respond');

/** La confirmación de "Eliminar": borrar una entrada es irreversible y en CASCADA (removeYtEntry de server/src/mytube.ts:
 *  se van sus videos del catálogo aprobado y, si su canal se queda sin videos, el canal sale de MyTube). */
export function removeText(e: Pick<MtEntry, 'title' | 'videos'>): string {
  const vids = e.videos === 0 ? L('No tiene videos aprobados.', 'It has no approved videos.')
    : e.videos === 1 ? L('Se borra su video de Smarty: nadie de tu familia lo va a poder ver.', 'Its video is removed from Smarty: no one in your family will be able to watch it.')
      : L(`Se borran sus ${e.videos} videos de Smarty: nadie de tu familia los va a poder ver.`, `Its ${e.videos} videos are removed from Smarty: no one in your family will be able to watch them.`);
  return L(`¿Eliminar «${e.title}»? ${vids} Si su canal no tiene otros videos aprobados, también sale de MyTube. No se puede deshacer.`,
    `Remove “${e.title}”? ${vids} If its channel has no other approved videos, it also leaves MyTube. This can’t be undone.`);
}

export const ENTRY_TYPE_LABEL: Record<MtEntryType, string> = {
  get video() { return L('Video', 'Video'); },
  get playlist() { return L('Playlist', 'Playlist'); },
  get canal() { return L('Canal', 'Channel'); },
};

export type FamilyChannel = { channel: MtAdminChannel; entries: MtEntry[] };
export type ChannelGroups = {
  /** canales con al menos una entrada de la familia (lo que el padre sumó), del más reciente al más viejo */
  family: FamilyChannel[];
  /** entradas cuyo canal no se conoce (sin channelId, o un canal que ya no está en la lista), de la más nueva a la más vieja */
  orphans: MtEntry[];
  /** el resto: los canales del catálogo de Smarty, en el orden del server (por channelId, como el MyTube del chico) */
  catalog: MtAdminChannel[];
};
const newer = (a: MtEntry, b: MtEntry) => b.createdAt - a.createdAt || b.id - a.id;

/** Las entradas de la familia + los canales de MyTube → los tres grupos de la grilla del padre. */
export function groupChannels(entries: readonly MtEntry[], channels: readonly MtAdminChannel[]): ChannelGroups {
  const known = new Set(channels.map((c) => c.channelId));
  const by = new Map<string, MtEntry[]>();
  const orphans: MtEntry[] = [];
  for (const e of entries) {
    if (e.channelId && known.has(e.channelId)) by.set(e.channelId, [...(by.get(e.channelId) ?? []), e]);
    else orphans.push(e);
  }
  const family = channels.filter((c) => by.has(c.channelId))
    .map((channel) => ({ channel, entries: [...by.get(channel.channelId)!].sort(newer) }))
    .sort((a, b) => newer(a.entries[0], b.entries[0]));
  return { family, orphans: orphans.sort(newer), catalog: channels.filter((c) => !by.has(c.channelId)) };
}

/** Sin mayúsculas ni tildes, para el filtro de canales. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
/** ¿El canal coincide con lo que se escribió en "Buscar un canal"? (título o @handle; vacío = todos) */
export function channelMatches(c: Pick<MtAdminChannel, 'title' | 'handle'>, q: string): boolean {
  const want = fold(q.trim());
  if (!want) return true;
  return fold(c.title).includes(want) || (!!c.handle && fold(c.handle).includes(want));
}

/** Reingestar / Eliminar (con su confirmación) una entrada de la familia. `after` = qué hacer cuando terminó (releer). El
 *  "sí" de la confirmación lo da el contenedor con `ask` + `answer`. */
export function useEntryOps(after: () => Promise<void> | void) {
  const [reingId, setReingId] = useState<number | null>(null); // entrada que se está reingestando
  const [askDel, setAskDel] = useState<MtEntry | null>(null); // entrada esperando la confirmación de "Eliminar"
  const [removing, setRemoving] = useState<number | null>(null); // entrada que se está eliminando
  const [note, setNote] = useState<{ text: string; err: boolean } | null>(null);

  const reingest = async (e: MtEntry) => {
    if (reingId !== null || removing !== null) return;
    setReingId(e.id); setNote(null);
    try {
      const r = await parentCall(api.mtReingest(e.id));
      setNote(r.ok ? { text: L(`✓ Reingestada: ${r.title} · ${r.added} video(s)`, `✓ Re-imported: ${r.title} · ${r.added} video(s)`), err: false } : { text: L(`Error al reingestar: ${explainYtError(r.error)}`, `Couldn’t re-import: ${explainYtError(r.error)}`), err: true });
    } catch {
      setNote({ text: L(`Error al reingestar: ${NET()}`, `Couldn’t re-import: ${NET()}`), err: true });
    } finally {
      setReingId(null);
    }
    await after();
  };

  // Solo después del "sí" de la confirmación. Si falla, se dice (nada se traga) y se relee igual.
  const remove = async (e: MtEntry) => {
    if (removing !== null) return;
    setRemoving(e.id); setNote(null);
    try {
      const r = await parentCall(api.mtRemove(e.id));
      setNote(r.ok
        ? { text: L(`✓ Eliminada: «${e.title}»${e.videos === 1 ? ' y su video' : e.videos ? ` y sus ${e.videos} videos` : ''}.`, `✓ Removed: “${e.title}”${e.videos === 1 ? ' and its video' : e.videos ? ` and its ${e.videos} videos` : ''}.`), err: false }
        : { text: L(`Error al eliminar «${e.title}». Probá de nuevo.`, `Couldn’t remove “${e.title}”. Try again.`), err: true });
    } catch {
      setNote({ text: L(`Error al eliminar «${e.title}»: ${NET()}. Probá de nuevo.`, `Couldn’t remove “${e.title}”: ${NET()}. Try again.`), err: true });
    } finally {
      setRemoving(null);
    }
    await after();
  };

  const ask = (e: MtEntry) => { setNote(null); setAskDel(e); };
  const answer = (yes: boolean) => {
    const e = askDel;
    setAskDel(null);
    if (yes && e) void remove(e);
  };
  return { reingId, removing, askDel, note, locked: reingId !== null || removing !== null, reingest, ask, answer, clearNote: () => setNote(null) };
}
