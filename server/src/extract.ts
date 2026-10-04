// Extracción de artículos: port de smarty-poc/app/src/lib/extract.ts al servidor (jsdom en vez del DOM del navegador).
// Wikipedia → REST nativa (summary + Parsoid HTML); resto → r.jina.ai. Ambos → Readability → DOMPurify.
import { Readability, isProbablyReaderable } from '@mozilla/readability'
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import { ov } from './config'

export interface Extracted {
  title: string
  html: string
  text: string
  hero?: string
  siteName?: string
}

const purify = createDOMPurify(new JSDOM('').window as unknown as Window & typeof globalThis)
const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'b', 'i', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'hr', 'code', 'pre', 'sub', 'sup', 'span', 'div', 'section', 'mark']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'referrerpolicy', 'loading', 'decoding', 'data-figure']
const UA = 'InnerithBot/0.1 (educational; contact andres@innerith.com)'
const maxText = () => ov.num('const.maxTextoArticulo')

const UNREADABLE = /just a moment|performing security verification|checking your (browser|site connection)|enable javascript and cookies|verify you are (a )?human|protect against malicious bots|service to protect against|attention required|requiring captcha|target url returned error|this page maybe (not yet fully loaded|requiring captcha)|consider explicitly specify a timeout/i
const looksUnreadable = (text: string) => UNREADABLE.test((text ?? '').slice(0, 1500))

const parse = (html: string, url?: string) => new JSDOM(html, url ? { url } : {}).window.document

/* ---------- imágenes (igual que Smarty) ---------- */
function toAbsolute(src: string | null, base: string): string | null {
  if (!src) return null
  try { const u = new URL(src, base).href; return u.startsWith('http:') ? u.replace(/^http:/, 'https:') : u } catch { return null }
}
function pickFromSrcset(srcset: string, base: string): string | null {
  const best = srcset.split(',').map(s => s.trim()).map(part => {
    const [url, d] = part.split(/\s+/)
    const w = d?.endsWith('w') ? parseInt(d) : 0
    const x = d?.endsWith('x') ? parseFloat(d) : 0
    return { url, score: w || x * 1000 }
  }).filter(c => c.url).sort((a, b) => b.score - a.score)[0]
  return best ? toAbsolute(best.url, base) : null
}
const upscaleWikimedia = (url: string) => (/upload\.wikimedia\.org/.test(url) ? url.replace(/\/(\d+)px-/, '/960px-') : url)
function wikimediaFileId(url: string): string {
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean)
    const ti = segs.indexOf('thumb')
    const name = ti >= 0 && segs.length > ti + 3 ? segs[ti + 3] : segs[segs.length - 1]
    return decodeURIComponent(name || '').toLowerCase()
  } catch { return url.toLowerCase() }
}
function normalizeImages(root: ParentNode, base: string, heroFileId?: string): void {
  root.querySelectorAll('img').forEach(img => {
    const w = parseInt(img.getAttribute('width') || '0'), h = parseInt(img.getAttribute('height') || '0')
    if (/math/.test(img.getAttribute('class') || '') || (w && w < 80) || (h && h < 80)) { (img.closest('figure') ?? img).remove(); return }
    const cand =
      (img.getAttribute('srcset') && pickFromSrcset(img.getAttribute('srcset')!, base)) ||
      (img.getAttribute('data-srcset') && pickFromSrcset(img.getAttribute('data-srcset')!, base)) ||
      toAbsolute(img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src'), base) ||
      toAbsolute(img.getAttribute('src'), base)
    if (!cand) { (img.closest('figure') ?? img).remove(); return }
    const finalSrc = upscaleWikimedia(cand)
    if (heroFileId && wikimediaFileId(finalSrc) === heroFileId) { (img.closest('figure') ?? img).remove(); return }
    for (const a of [...img.attributes]) img.removeAttribute(a.name)
    img.setAttribute('src', finalSrc)
    img.setAttribute('referrerpolicy', 'no-referrer')
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
  })
}

/* Links: se vuelven absolutos y se resuelven en el servidor al abrirse (moderación). Las anclas internas se pelan. */
function absolutizeLinks(root: ParentNode, base: string): void {
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') ?? ''
    const abs = href.startsWith('#') ? null : toAbsolute(href, base)
    for (const at of [...a.attributes]) a.removeAttribute(at.name)
    if (abs && /^https:\/\//.test(abs)) a.setAttribute('href', abs)
  })
}

function finish(contentHtml: string, base: string, heroFileId?: string): string {
  const doc = parse(contentHtml)
  normalizeImages(doc, base, heroFileId)
  absolutizeLinks(doc, base)
  return purify.sanitize(doc.body.innerHTML, { ALLOWED_TAGS, ALLOWED_ATTR })
}

/* ---------- Wikipedia ---------- */
function wikiTitleFromUrl(url: string): { lang: string; title: string } | null {
  try {
    const u = new URL(url)
    const m = /^([a-z]{2,3})(?:\.m)?\.wikipedia\.org$/.exec(u.hostname)
    const seg = m && u.pathname.split('/wiki/')[1]
    return m && seg ? { lang: m[1], title: decodeURIComponent(seg) } : null
  } catch { return null }
}

async function extractWikipedia(lang: string, title: string, sourceUrl: string): Promise<Extracted> {
  const enc = encodeURIComponent(title.replace(/ /g, '_'))
  const apiBase = `https://${lang}.wikipedia.org/api/rest_v1/page`
  const headers = { 'User-Agent': UA }
  const summary = await fetch(`${apiBase}/summary/${enc}`, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null) as
    { title?: string; extract?: string; originalimage?: { source: string }; thumbnail?: { source: string } } | null
  const hero = summary?.originalimage?.source || summary?.thumbnail?.source
  const htmlRes = await fetch(`${apiBase}/html/${enc}`, { headers })
  if (!htmlRes.ok) throw new Error(`WIKI_${htmlRes.status}`)
  const doc = parse(await htmlRes.text(), sourceUrl)
  doc.querySelectorAll(
    'style, link, script, .mw-editsection, .reference, sup.reference, .noprint, .navbox, .vertical-navbox, .infobox, .sidebar, ' +
    '.metadata, .mbox-small, .hatnote, .ambox, .sistersitebox, .mw-empty-elt, [role="navigation"], .reflist, .references, ' +
    '.gallery, table.nowraplinks, .thumbcaption .magnify, .shortdescription, #toc, .toc',
  ).forEach(el => el.remove())
  const article = new Readability(doc, { charThreshold: 200 }).parse()
  return {
    title: summary?.title || article?.title || title.replace(/_/g, ' '),
    html: finish(article?.content ?? '<div></div>', sourceUrl, hero ? wikimediaFileId(hero) : undefined),
    hero: hero ? upscaleWikimedia(hero) : undefined,
    text: (article?.textContent ?? summary?.extract ?? '').slice(0, maxText()),
    siteName: 'Wikipedia',
  }
}

/* ---------- idioma del título vs. cuerpo ---------- */
const ES_W = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'con', 'para', 'su', 'se', 'como', 'más', 'son', 'nuestro', 'nuestra'])
const EN_W = new Set(['the', 'of', 'and', 'to', 'in', 'is', 'that', 'it', 'for', 'with', 'as', 'are', 'on', 'this', 'by', 'be', 'from', 'or', 'an', 'our', 'how', 'does', 'what', 'why'])
function lang(text: string): 'es' | 'en' | '?' {
  let es = 0, en = 0
  for (const w of text.toLowerCase().split(/[^a-záéíóúñü]+/).slice(0, 1500)) { if (ES_W.has(w)) es++; else if (EN_W.has(w)) en++ }
  return es === en ? '?' : es > en ? 'es' : 'en'
}
/* Algunos sitios (ej. NASA Space Place en español) traen el <title> en inglés y el cuerpo traducido:
   en ese caso usamos el primer encabezado visible de la página. */
function pickTitle(metaTitle: string, h1: string | undefined, bodyText: string): string {
  if (!h1) return metaTitle
  const body = lang(bodyText), t = lang(metaTitle)
  return body !== '?' && t !== '?' && body !== t && lang(h1) !== t ? h1 : metaTitle
}

/* ---------- General (jina → Readability; fallback markdown) ---------- */
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

async function extractGeneral(url: string): Promise<Extracted> {
  const res = await fetch(`https://r.jina.ai/${url}`, { headers: { 'X-Return-Format': 'html', 'X-Retain-Images': 'all', 'X-Timeout': '30' } })
  if (!res.ok) throw new Error(`JINA_${res.status}`)
  const doc = parse(await res.text(), url)
  const h1 = doc.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() || undefined // antes de Readability (muta el doc)
  if (isProbablyReaderable(doc)) {
    const article = new Readability(doc, { charThreshold: 200 }).parse()
    if (article?.content && (article.length ?? 0) > 400) {
      const text = (article.textContent ?? '').slice(0, maxText())
      if (looksUnreadable(text)) throw new Error('BOTWALL')
      return { title: pickTitle(article.title || url, h1, text), html: finish(article.content, url), text, siteName: article.siteName ?? undefined }
    }
  }
  // Fallback: markdown de jina → párrafos simples.
  const md = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } }).then(r => r.text())
  const title = /Title:\s*(.+)/.exec(md)?.[1]?.trim() ?? url
  const body = md.replace(/^Title:.*\n?|^URL Source:.*\n?|^Markdown Content:\n?/gm, '').replace(/\[\d+\]/g, '').replace(/\[edit(ar)?\]/gi, '').trim().slice(0, maxText())
  if (looksUnreadable(body)) throw new Error('BOTWALL')
  if (body.length < 60) throw new Error('UNREADABLE')
  const html = body.split(/\n{2,}/).map(p => p.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()).filter(Boolean)
    .map(p => (/^#{1,6}\s/.test(p) ? `<h2>${escapeHtml(p.replace(/^#+\s*/, ''))}</h2>` : `<p>${escapeHtml(p)}</p>`)).join('')
  return { title, html, text: body }
}

export async function extractArticle(url: string): Promise<Extracted> {
  const wiki = wikiTitleFromUrl(url)
  if (wiki) {
    try { return await extractWikipedia(wiki.lang, wiki.title, url) } catch { /* cae al camino general */ }
  }
  return extractGeneral(url)
}
