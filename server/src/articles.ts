// Abrir un artículo: gate de sitio → extracción → juez → cache. Port de fetchArticle (smarty-poc reader.ts).
// Cache de dos niveles como en Smarty: la extracción vale 7 días; el veredicto depende de policyVersion.
// U3 (docs/USUARIOS.md §9): el juez suma los temas negros que RIGEN para el chico activo (cada integrante tiene los suyos),
// así que el veredicto se guarda POR HUELLA de esos temas (`verdicts`, hasta 4): alternar entre hermanos no vuelve a
// juzgar con el modelo. Los campos `verdict`/`policyVersion`/`familySalt` se siguen escribiendo con el último (lectores
// viejos) y valen como "legado" si coinciden la huella y la versión.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SERVER_ROOT, config } from './config'
import { tryWriteFileAtomic } from './durable'
import { extractArticle, type Extracted } from './extract'
import { isAllowedArticleSite } from './filters'
import { judgeText, type Verdict } from './judge'
import { familyTopics } from './parent'

/* Los temas negros de la familia que rigen en este pedido entran al juez (judge.ts): esta huella hace que cambiarlos
   invalide el veredicto cacheado, igual que policyVersion con la política de fábrica. */
const familySalt = () => [...familyTopics().black].sort().join('|')

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_DIR = join(SERVER_ROOT, 'data', 'cache', 'articles')
mkdirSync(CACHE_DIR, { recursive: true })

interface Snapshot extends Extracted { url: string; fetchedAt: number; verdict: Verdict; policyVersion: number;
  /** Huella de los temas NEGROS de la familia al juzgar: si el padre cambia los temas, se re-juzga (los
   *  blancos no afectan el veredicto). Un snapshot viejo (sin huella) se re-juzga una vez y queda al día. */
  familySalt?: string
  /** U3: veredicto POR HUELLA (huella → veredicto + la policyVersion con que se juzgó), hasta MAX_VERDICTS; se vacía al
   *  re-extraer. */
  verdicts?: Record<string, { verdict: Verdict; policyVersion: number }> }
const MAX_VERDICTS = 4
/** El veredicto vigente para esta huella: el de `verdicts`, o el legado si coinciden huella y versión; null = juzgar. */
function verdictFor(snap: Snapshot, salt: string): Verdict | null {
  const v = snap.verdicts && Object.hasOwn(snap.verdicts, salt) ? snap.verdicts[salt] : undefined
  if (v && v.policyVersion === config.policyVersion) return v.verdict
  if (snap.policyVersion === config.policyVersion && snap.familySalt === salt && snap.verdict) return snap.verdict
  return null
}
/** Guarda el veredicto de esta huella (el más reciente queda al final; se cae el más viejo) y el legado. */
function remember(snap: Snapshot, salt: string, verdict: Verdict): void {
  const verdicts = { ...(snap.verdicts ?? {}) }
  delete verdicts[salt]
  verdicts[salt] = { verdict, policyVersion: config.policyVersion }
  const keys = Object.keys(verdicts)
  for (let i = 0; i < keys.length - MAX_VERDICTS; i++) delete verdicts[keys[i]]
  snap.verdicts = verdicts
  snap.verdict = verdict
  snap.policyVersion = config.policyVersion
  snap.familySalt = salt
}
const cacheFile = (url: string) => join(CACHE_DIR, createHash('sha1').update(url).digest('hex') + '.json')
const readCache = (url: string): Snapshot | null => { try { return existsSync(cacheFile(url)) ? JSON.parse(readFileSync(cacheFile(url), 'utf8')) : null } catch { return null } }
/** FS-BASE-B (mapa de durabilidad): atómica (durable.ts; antes un writeFileSync directo podía dejar un JSON a medias), sin
 *  fsync —es una caché regenerable— y sin tirar: si no se guarda, la próxima lectura vuelve a extraer y juzgar. */
const writeCache = (s: Snapshot) => { tryWriteFileAtomic(cacheFile(s.url), JSON.stringify(s), 'article', { durable: false }) }

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
    snap = { ...ex, url, fetchedAt: Date.now(), verdict: { veredicto: 'bloqueado' }, policyVersion: -1, verdicts: {} }
  }

  // 3) Juez (solo si cambió la política —de fábrica o la de la familia que rige— o es nuevo). Fail-closed.
  const salt = familySalt()
  let verdict = verdictFor(snap, salt)
  if (!verdict) {
    try { verdict = await judgeText(snap.text) } catch { return { status: 'error', reason: 'judge' } }
    remember(snap, salt, verdict)
    writeCache(snap)
  }

  if (verdict.veredicto !== 'aprobado') return { status: 'blocked', reason: 'content', motivo: verdict.motivo }
  return { status: 'ok', article: { id: url, url, topic: snap.title, title: snap.title, siteName: snap.siteName, hero: snap.hero, html: snap.html } }
}

/* Para el chat (extractoArticulo de articleTools.ts): texto ya juzgado de la cache, o extracción con timeout.
   Respeta el veredicto: un artículo ya juzgado no-apto no se inyecta. U3: el veredicto tiene que ser el de la huella que
   rige AHORA (antes miraba solo policyVersion y reusaba el de otra política de la familia); sin él, el camino de "sin
   caché" (extracción con timeout). */
export async function articleTextForChat(url: string, timeoutMs: number): Promise<string | undefined> {
  const cached = readCache(url)
  const verdict = cached?.text ? verdictFor(cached, familySalt()) : null
  if (cached?.text && verdict) return verdict.veredicto === 'aprobado' ? cached.text : undefined
  const ex = await Promise.race([extractArticle(url).catch(() => null), new Promise<null>(r => setTimeout(() => r(null), timeoutMs))])
  return ex?.text
}
