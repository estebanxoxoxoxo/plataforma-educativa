// Portada de las rutas de ARTÍCULO (tanda "Deudas técnicas", 14-oct): el paso 3 del routeCover del POC, hecho en el SERVER.
// POC (smarty-poc app/src/lib/routeCover.ts → useRouteCover): portada = 1. la MANUAL (route.cover, data URL que sube el
// creador) · 2. la miniatura del video si el PRIMER contenido es un video de YouTube · 3. la imagen principal del ARTÍCULO
// (API summary de Wikipedia, `thumbnail.source`, pedida DESDE EL NAVEGADOR y cacheada en localStorage) · 4. null → emoji.
// En Innerith el paso 3 no se portó al cliente (W3: la UI no sale a la red fuera de `api`); acá lo hace el server y la URL
// (http, no data URL) queda guardada como `route.cover` en la fila del catálogo (learnRoutes.ts: al importar y, para las
// existentes, lazy al listar). Este módulo es PURO (sin estado ni disco): qué pedir y el pedido en sí.
//   firstContent / wikiTitle = los del POC TAL CUAL (el source del 1er módulo si trae url o videoId; si no, la lectura de la
//   1ª posta que tenga una · solo *.wikipedia.org con /wiki/<título>). El summary se pide al MISMO host del artículo (como el
//   POC: un artículo de es.wikipedia → es.wikipedia.org/api/rest_v1/page/summary/<título>), con el User-Agent de los demás
//   pedidos a Wikimedia del server y un timeout corto. Sin thumbnail, con error o vencido → null (la ruta sigue con emoji).

const UA = 'InnerithBot/0.1 (educational; contact andres@innerith.com)'
export const COVER_TIMEOUT_MS = 4000

type Content = { url?: unknown; title?: unknown; kind?: unknown; videoId?: unknown }
type RouteLike = { cover?: unknown; modules?: unknown; postas?: unknown }

/** Primer contenido de la ruta (firstContent del POC): el source del 1er módulo, o el reading de la 1ª posta que lo tenga. */
export function firstContent(route: RouteLike): Content | undefined {
  const mods = Array.isArray(route.modules) ? (route.modules as { source?: Content }[]) : []
  const m = mods[0]?.source
  if (m && (m.url || m.videoId)) return m
  const postas = Array.isArray(route.postas) ? (route.postas as { reading?: Content }[]) : []
  return postas.find((p) => p?.reading)?.reading
}

/** El título de un artículo de Wikipedia (wikiTitle del POC); null si la URL no es de *.wikipedia.org/wiki/…. */
export function wikiTitle(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)wikipedia\.org$/.test(u.hostname)) return null
    const m = u.pathname.match(/\/wiki\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

export type WikiTarget = { url: string; host: string; title: string }
/** ¿Esta ruta cae en el paso 3? Sin portada manual, primer contenido que NO es un video (el paso 2 gana) y que es un
 *  artículo de Wikipedia. null = no hay nada que pedir (portada manual, video primero, otro sitio o sin contenido). */
export function wikiTarget(route: RouteLike): WikiTarget | null {
  if (route.cover) return null
  const first = firstContent(route)
  if (!first) return null
  if (first.kind === 'video' && first.videoId) return null
  if (typeof first.url !== 'string' || !first.url) return null
  const title = wikiTitle(first.url)
  if (!title) return null
  return { url: first.url, host: new URL(first.url).hostname, title }
}

/** La imagen del artículo: `thumbnail.source` del summary (solo una URL http(s)); null sin imagen o ante cualquier falla. */
export async function fetchWikiThumb(t: WikiTarget, fetchFn: typeof fetch = fetch, timeoutMs = COVER_TIMEOUT_MS): Promise<string | null> {
  try {
    const r = await fetchFn(`https://${t.host}/api/rest_v1/page/summary/${encodeURIComponent(t.title)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { thumbnail?: { source?: unknown } } | null
    const src = j?.thumbnail?.source
    return typeof src === 'string' && /^https?:\/\//i.test(src) ? src : null
  } catch {
    return null
  }
}
