/* parseYtUrl del POC (smarty-poc app/src/lib/youtube.ts), TAL CUAL: /crear lo usa para decidir si la fuente de un módulo es
   un video de YouTube (se manda la URL a route-lab) o un artículo (se manda el título). Fiel al POC también en su trampa F5:
   un link de video dentro de una playlist REAL (&list=PL…/UU…/OL…/FL…) se clasifica como playlist, así que /crear lo trata
   como artículo y manda el título. */

export type YtRef =
  | { type: 'video'; id: string }
  | { type: 'playlist'; id: string }
  | { type: 'canal'; handle: string };

/* Una playlist "real" (importable) tiene id con prefijo PL/UU/OL/FL. Los mixes/auto-listas (RD radio, LM, WL watch later,
   LL liked) NO son importables: cuando aparecen en un &list= los tratamos como video. */
export function esPlaylistReal(list: string): boolean {
  return /^(PL|UU|OL|FL)/.test(list);
}

export function parseYtUrl(input: string): YtRef | null {
  const s = input.trim();
  let u: URL;
  try { u = new URL(s.startsWith('http') ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const list = u.searchParams.get('list');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    // Link de video dentro de una playlist real → preferimos la playlist.
    if (list && esPlaylistReal(list)) return { type: 'playlist', id: list };
    return id ? { type: 'video', id } : null;
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (u.pathname === '/playlist' && list) return { type: 'playlist', id: list };
  // /watch?v=VID&list=PL... → preferimos la playlist real sobre el video.
  if (list && esPlaylistReal(list)) return { type: 'playlist', id: list };
  const v = u.searchParams.get('v');
  if (v) return { type: 'video', id: v };
  if (u.pathname.startsWith('/shorts/')) return { type: 'video', id: u.pathname.split('/')[2] };
  if (u.pathname.startsWith('/embed/')) return { type: 'video', id: u.pathname.split('/')[2] };
  if (u.pathname.startsWith('/@')) return { type: 'canal', handle: u.pathname.slice(1).split('/')[0] };
  return null;
}
