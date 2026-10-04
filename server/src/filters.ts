// Port de smarty-poc/app/src/lib/domainFilter.ts, articleAccess.ts y wordFilter.ts.
import { articleBlacklist, blockedSiteDomains, config, whitelistSites } from './config'

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase() } catch { return url.toLowerCase() } }
const hostPathOf = (url: string) => { try { const u = new URL(url); return (u.hostname + u.pathname + u.search).toLowerCase() } catch { return url.toLowerCase() } }

/* Whitelist: hostname por sufijo; si la entrada trae '/', restricción por path. */
export function inWhitelist(url: string, list: string[]): boolean {
  const host = hostOf(url), hp = hostPathOf(url)
  return list.some(raw => {
    const e = raw.trim().toLowerCase()
    if (!e) return false
    if (e.includes('/')) return hp.includes(e)
    return host === e || host.endsWith('.' + e)
  })
}

/* Blacklist: substring de host+path (laxo a propósito: bloquear de más es seguro). */
export function inBlacklist(url: string, list: string[]): boolean {
  const hp = hostPathOf(url)
  return list.some(raw => { const e = raw.trim().toLowerCase(); return !!e && hp.includes(e) })
}

export function applyDomainFilter<T>(items: T[], getUrl: (x: T) => string, opts: { modo: string; blanca: string[]; negra: string[] }): T[] {
  const { modo, blanca, negra } = opts
  return items.filter(it => {
    const url = getUrl(it)
    if (modo === 'negra') return !inBlacklist(url, negra)
    const pasaBlanca = blanca.length > 0 && inWhitelist(url, blanca)
    if (modo === 'blanca') return pasaBlanca
    return pasaBlanca && !inBlacklist(url, negra)
  })
}

export function isBlockedSite(url: string): boolean {
  const h = hostOf(url)
  return blockedSiteDomains().some(d => h === d || h.endsWith('.' + d))
}

/* Gate de navegación (articleAccess.ts): solo sitios de la whitelist activa y fuera de la negra. Fail-closed. */
export function isAllowedArticleSite(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  if (isBlockedSite(url)) return false
  if (!inWhitelist(url, whitelistSites())) return false
  return !inBlacklist(url, articleBlacklist())
}

/* Palabras bloqueadas, por palabra/frase entera e insensible a tildes (wordFilter.ts). */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function matchBlockedWord(text: string, words: string[] = config.blockedWords): string | null {
  if (!text || !words.length) return null
  const haystack = normalize(text)
  for (const w of words) {
    const needle = normalize(w).trim()
    if (!needle) continue
    if (new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`).test(haystack)) return w
  }
  return null
}
