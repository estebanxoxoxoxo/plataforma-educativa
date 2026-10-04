// Abrir un artículo: gate de sitio → extracción → juez → cache. Port de fetchArticle (smarty-poc reader.ts).
// Cache de dos niveles como en Smarty: la extracción vale 7 días; el veredicto depende de policyVersion.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SERVER_ROOT, config } from './config'
import { extractArticle, type Extracted } from './extract'
import { isAllowedArticleSite } from './filters'
import { judgeText, type Verdict } from './judge'

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_DIR = join(SERVER_ROOT, 'data', 'cache', 'articles')
mkdirSync(CACHE_DIR, { recursive: true })

interface Snapshot extends Extracted { url: string; fetchedAt: number; verdict: Verdict; policyVersion: number }
const cacheFile = (url: string) => join(CACHE_DIR, createHash('sha1').update(url).digest('hex') + '.json')
const readCache = (url: string): Snapshot | null => { try { return existsSync(cacheFile(url)) ? JSON.parse(readFileSync(cacheFile(url), 'utf8')) : null } catch { return null } }
const writeCache = (s: Snapshot) => writeFileSync(cacheFile(s.url), JSON.stringify(s))

export type ArticleResult =
  | { status: 'ok'; article: { id: string; url: string; topic: string; title: string; siteName?: string; hero?: string; html: string } }
  | { status: 'blocked'; reason: string; motivo?: string }
  | { status: 'error'; reason: string }

export async function getArticle(url: string): Promise<ArticleResult> {
  // 1) Gate de sitio (fail-closed): solo sitios aprobados.
  if (!isAllowedArticleSite(url)) return { status: 'blocked', reason: 'site', motivo: 'sitio fuera de la lista blanca' }

  // 2) Cache / extracción.
  let snap = readCache(url)
  if (!snap || Date.now() - snap.fetchedAt > TTL_MS) {
    let ex: Extracted
    try { ex = await extractArticle(url) } catch (e) {
      const code = String((e as Error).message)
      return { status: 'error', reason: code === 'BOTWALL' ? 'botwall' : 'extract' }
    }
    snap = { ...ex, url, fetchedAt: Date.now(), verdict: { veredicto: 'bloqueado' }, policyVersion: -1 }
  }

  // 3) Juez (solo si cambió la política o es nuevo). Fail-closed: si el juez falla, no se muestra.
  if (snap.policyVersion !== config.policyVersion) {
    try { snap.verdict = await judgeText(snap.text) } catch { return { status: 'error', reason: 'judge' } }
    snap.policyVersion = config.policyVersion
    writeCache(snap)
  }

  if (snap.verdict.veredicto !== 'aprobado') return { status: 'blocked', reason: 'content', motivo: snap.verdict.motivo }
  return { status: 'ok', article: { id: url, url, topic: snap.title, title: snap.title, siteName: snap.siteName, hero: snap.hero, html: snap.html } }
}

/* Para el chat (extractoArticulo de articleTools.ts): texto ya juzgado de la cache, o extracción con timeout.
   Respeta el veredicto: un artículo ya juzgado no-apto no se inyecta. */
export async function articleTextForChat(url: string, timeoutMs: number): Promise<string | undefined> {
  const cached = readCache(url)
  if (cached?.text && cached.policyVersion === config.policyVersion) return cached.verdict.veredicto === 'aprobado' ? cached.text : undefined
  const ex = await Promise.race([extractArticle(url).catch(() => null), new Promise<null>(r => setTimeout(() => r(null), timeoutMs))])
  return ex?.text
}
