// Porte Smarty · /crear, lado server (tanda W1; reemplaza el stub del coordinador).
// Acá vive SOLO la auditoría de VERACIDAD de un fact: port EXACTO de smarty-poc app/src/learn/factAudit.ts (OpenAI Responses
// con tool-calling: `buscar_web` = Serper AMPLIO —sin la lista blanca infantil: es herramienta del editor— y
// `buscar_wikipedia` = búsqueda REST de Wikipedia, sin clave; hasta 8 rondas de tools, max_output_tokens 1500, store:false;
// SIEMPRE con fuentes: si no consultó ninguna → 'sin-datos'; solo se conservan las fuentes que las tools devolvieron de
// verdad; sin refutación adversarial ni segundo juez, como el POC).
// Corre en NUESTRO server porque las claves JAMÁS van al cliente (desvío forzado (a) del mapa §4): en el POC corre en el
// navegador con la key de Ajustes. El resto de /crear habla DIRECTO con route-lab desde el navegador, como en el POC.
//
//   POST /api/create/audit  { payload: AuditFactRequest } → AuditFactResponse        (formas ADITIVAS: las formaliza el coordinador)
//     AuditFactRequest  = { fact: { statement, front, back, quote, kind }, lang?: string }   ← auditFact(fact, { lang: 'es' }) del POC
//     AuditFactResponse = { ok: true, result: AuditResult } | { ok: false, error: string }
//     AuditResult       = { status: 'confirmado' | 'parcial' | 'contradicho' | 'sin-datos', confidence: number (0-1),
//                           summary: string, correction?: string,
//                           sources: { title, url, snippet, agrees: 'si' | 'parcial' | 'no' | 'irrelevante' }[],
//                           model: string, auditedAt: number (ms) }                       ← AuditResult de routeDraft.ts del POC
//   Lo que en el POC auditFact TIRA (y la vista muestra como "Auditoría: <mensaje>") viaja como 200 + ok:false con el MISMO
//   mensaje — 'NO_API_KEY', 'El auditor no devolvió un veredicto en el formato esperado.', los errores de la API de OpenAI —
//   porque el cliente http() descarta el cuerpo de un 4xx/5xx. Las claves que la API pudiera citar se tapan. Pedido mal
//   formado → 400.
// Modelo: AUDIT_MODEL (abajo). Prompt: el knob 'audit.prompt' del POC — el override de la familia (config.overrides, del
// respaldo) o el valor de fábrica copiado tal cual (defaults.json se volcó antes de que existiera el knob).
// Serper con el país/idioma de la familia (config.searchGl/searchHl = settings.searchGl/searchHl del POC; default ar/es).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config, fill } from './config'
import { completeWithTools, parseJudgeJson, tool } from './llm'
import { readJson, send } from './web'

/** Modelo del auditor = `auditModel()` del POC (settings.ts, clave `smarty.auditModel`, default 'gpt-5.5': "el más capaz
 *  disponible", desacoplado del preset del chat; allá el padre lo cambia en Ajustes entre gpt-5.5, gpt-5.4 y gpt-5.4-mini).
 *  Innerith todavía no tiene ese ajuste: queda el default como constante. */
const AUDIT_MODEL = 'gpt-5.5'

/** Valor de fábrica del knob 'audit.prompt' (smarty-poc app/src/lib/overrides.ts), TAL CUAL. Vars: statement, kind, quote. */
const AUDIT_PROMPT_DEFAULT = `Sos un AUDITOR DE HECHOS riguroso para material educativo de chicos. Vas a verificar si una AFIRMACIÓN es cierta: puede venir de un video mal doblado o de un transcript con errores, y no queremos enseñarle datos falsos a un niño.

AFIRMACIÓN a verificar: "{{statement}}"
Tipo de dato: {{kind}}
Cita textual de la fuente original (lo que la fuente REALMENTE decía): "{{quote}}"

Cómo trabajar:
1. USÁ las herramientas de búsqueda (buscar_web y buscar_wikipedia) para encontrar 2-3 fuentes independientes y confiables. TENÉS QUE buscar antes de concluir; nunca dictamines de memoria.
2. Compará la afirmación con las fuentes: ¿es cierta?
3. Compará también la afirmación con la cita original: ¿la traducción o transcripción cambió un número o un dato? (los datos numéricos son los más riesgosos).
4. Si es falsa o imprecisa, decí cuál es el valor correcto según las fuentes.

Devolvé SOLO un objeto JSON con esta forma EXACTA:
{"status":"confirmado|parcial|contradicho|sin-datos","confidence":0.0,"summary":"qué encontraste y la discrepancia con la cita si la hay","correction":"el valor correcto según las fuentes (solo si contradicho o parcial; si no, omitilo)","sources":[{"title":"","url":"","snippet":"lo que dice la fuente","agrees":"si|parcial|no|irrelevante"}]}

status: confirmado (las fuentes lo respaldan), parcial (parcialmente cierto o impreciso), contradicho (las fuentes dicen otra cosa), sin-datos (no encontraste fuentes suficientes). Sé honesto y conservador: si no hallaste fuentes claras, usá "sin-datos". Sos un apoyo para el editor humano, no la última palabra.`

/** ov.text('audit.prompt') del POC: el override de la familia gana sobre el de fábrica. */
const auditPrompt = () => config.overrides?.['audit.prompt'] ?? AUDIT_PROMPT_DEFAULT

/** Las búsquedas a Wikipedia salen del server: van con la identificación de Innerith (extract.ts / images.ts). */
const UA = 'InnerithBot/0.1 (educational; contact andres@innerith.com)'

/* ---------- formas (espejo de routeDraft.ts / factAudit.ts del POC) ---------- */
export interface AuditFactInput { statement: string; front: string; back: string; quote: string; kind: string }
export interface AuditSource { title: string; url: string; snippet: string; agrees: 'si' | 'parcial' | 'no' | 'irrelevante' }
export interface AuditResult {
  status: 'confirmado' | 'parcial' | 'contradicho' | 'sin-datos'
  confidence: number
  summary: string
  correction?: string
  sources: AuditSource[]
  model: string
  auditedAt: number
}
interface Retrieved { title: string; url: string; snippet: string }
const AGREES = ['si', 'parcial', 'no', 'irrelevante'] as const

/* ---------- herramientas ---------- */
async function searchWikipedia(lang: string, q: string): Promise<Retrieved[]> {
  try {
    const base = (lang || 'es').split('-')[0]
    const r = await fetch(`https://${base}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': UA } })
    if (!r.ok) return []
    const data = (await r.json()) as { pages?: { key?: string; title: string; excerpt?: string; description?: string }[] }
    return (data.pages ?? []).map((p) => ({
      title: p.title,
      url: `https://${base}.wikipedia.org/wiki/${encodeURIComponent(p.key ?? p.title)}`,
      snippet: (p.description || p.excerpt || '').replace(/<[^>]+>/g, '').trim(),
    }))
  } catch { return [] }
}

/* serperSearchResult del POC (lib/imageEngine/serper.ts): la falla se REPORTA (al modelo), no se traga. */
interface SerperOrganic { title: string; link: string; snippet?: string }
function describeSerperError(status: number, body?: string): string {
  if (status === 401 || status === 403) return `Serper rechazó la API key (${status}). Revisá SERPER_API_KEY en server/.env.`
  if (status === 429) return 'Serper sin créditos o limitando (429). Revisá tu cuota en serper.dev.'
  const extra = body ? `: ${body.slice(0, 120)}` : ''
  return `Serper respondió HTTP ${status}${extra}`
}
async function serperSearchResult(q: string, opts?: { num?: number }): Promise<{ organic: SerperOrganic[]; error?: string }> {
  const key = (process.env.SERPER_API_KEY ?? '').trim()
  if (!key) return { organic: [], error: 'Falta la API key de Serper (SERPER_API_KEY en server/.env).' }
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: opts?.num ?? 20, gl: config.searchGl || 'ar', hl: config.searchHl || 'es' }),
    })
    if (!r.ok) { const t = await r.text().catch(() => ''); return { organic: [], error: describeSerperError(r.status, t) } }
    const data = (await r.json()) as { organic?: SerperOrganic[] }
    return { organic: (data.organic ?? []).filter((o) => o.link && o.title) }
  } catch (e) {
    return { organic: [], error: `No se pudo conectar con Serper: ${String((e as Error)?.message ?? e).slice(0, 120)}` }
  }
}
async function searchWeb(q: string): Promise<{ results: Retrieved[]; error?: string }> {
  const r = await serperSearchResult(q, { num: 6 }) // Serper AMPLIO (no la whitelist infantil): herramienta del editor
  if (r.error) return { results: [], error: r.error }
  return { results: r.organic.slice(0, 6).map((o) => ({ title: o.title, url: o.link, snippet: o.snippet ?? '' })) }
}

/* ---------- el auditor (auditFact del POC) ---------- */
export async function auditFact(fact: AuditFactInput, opts?: { lang?: string }): Promise<AuditResult> {
  // client() del POC: sin key de OpenAI no arranca (la vista muestra "Auditoría: NO_API_KEY").
  if (!process.env.OPENAI_API_KEY) throw new Error('NO_API_KEY')
  // Sin key de Serper igual audita con Wikipedia (keyless). El invariante "siempre con fuentes" se asegura al final.
  const lang = opts?.lang ?? 'es'
  const model = AUDIT_MODEL
  const statement = (fact.statement || `${fact.front} → ${fact.back}`).trim()

  // fuentes que el LLM consultó (dedup por url) — para asociarlas al fact y validar que no invente citas
  const consulted: Retrieved[] = []
  const byUrl = new Map<string, Retrieved>()
  const remember = (rs: Retrieved[]) => {
    for (const x of rs) if (x.url && !byUrl.has(x.url)) { byUrl.set(x.url, x); consulted.push(x) }
  }

  const tools = [
    tool('buscar_web', 'Busca en la web (Google) para verificar un hecho. Devuelve resultados con título, url y extracto.', {
      query: { type: 'string', description: 'la consulta de búsqueda' },
    }),
    tool('buscar_wikipedia', 'Busca páginas de Wikipedia relacionadas con un hecho.', {
      query: { type: 'string', description: 'el término a buscar en Wikipedia' },
    }),
  ]

  const onToolCall = async (name: string, args: Record<string, unknown>): Promise<{ output: string }> => {
    const q = String(args?.query ?? '').trim()
    if (!q) return { output: JSON.stringify({ error: 'consulta vacía' }) }
    if (name === 'buscar_web') {
      const { results, error } = await searchWeb(q)
      if (error) return { output: JSON.stringify({ error }) }
      remember(results)
      return { output: JSON.stringify({ results }) }
    }
    if (name === 'buscar_wikipedia') {
      const results = await searchWikipedia(lang, q)
      remember(results)
      return { output: JSON.stringify({ results }) }
    }
    return { output: JSON.stringify({ error: 'herramienta desconocida' }) }
  }

  const system = fill(auditPrompt(), { statement, kind: fact.kind || '', quote: fact.quote || '(sin cita)' })

  const { text } = await completeWithTools({
    model,
    system,
    messages: [{ role: 'user', content: 'Auditá la afirmación de arriba usando las herramientas de búsqueda y devolvé SOLO el JSON del veredicto.' }],
    maxTokens: 1500,
    tools,
    onToolCall,
    maxToolRounds: 8,
  })

  // SIEMPRE con fuentes: si no buscó nada, es sin-datos
  if (!consulted.length)
    return { status: 'sin-datos', confidence: 0, summary: 'El auditor no consultó ninguna fuente.', sources: [], model, auditedAt: Date.now() }

  let parsed: Partial<Omit<AuditResult, 'sources'>> & { sources?: unknown }
  try { parsed = parseJudgeJson<typeof parsed>(text) }
  catch { throw new Error('El auditor no devolvió un veredicto en el formato esperado.') }

  // anti-alucinación: solo conservamos fuentes REALMENTE consultadas (por url). Si no citó ninguna válida, mostramos lo
  // que buscó para que el humano juzgue.
  let sources: AuditSource[] = []
  for (const s of (Array.isArray(parsed.sources) ? parsed.sources : []) as Partial<AuditSource>[]) {
    if (!s || typeof s.url !== 'string') continue
    const base = byUrl.get(s.url)
    if (!base) continue
    const agrees = (AGREES as readonly string[]).includes(s.agrees as string) ? (s.agrees as AuditSource['agrees']) : 'irrelevante'
    sources.push({ title: s.title || base.title, url: s.url, snippet: s.snippet || base.snippet, agrees })
  }
  if (!sources.length) sources = consulted.slice(0, 4).map((r) => ({ ...r, agrees: 'irrelevante' as const }))

  const status = (['confirmado', 'parcial', 'contradicho', 'sin-datos'].includes(parsed.status as string) ? parsed.status : 'sin-datos') as AuditResult['status']
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0

  return {
    status,
    confidence,
    summary: (parsed.summary || '').trim() || 'Sin resumen.',
    correction: parsed.correction?.toString().trim() || undefined,
    sources,
    model,
    auditedAt: Date.now(),
  }
}

/* ---------- ruta ---------- */
const str = (x: unknown) => (typeof x === 'string' ? x : x == null ? '' : String(x))
/** El mensaje del error tal cual, con cualquier clave de OpenAI que la API cite (enmascarada o no) tapada. */
const safeMessage = (e: unknown) => String((e as Error)?.message ?? e).replace(/sk-[A-Za-z0-9_*.-]{4,}/g, 'sk-…').slice(0, 500)

export async function createRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/create/audit') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })
    let body: unknown
    try { body = await readJson<unknown>(req) } catch { return send(res, 400, { ok: false, error: 'Pedido inválido (se esperaba un objeto JSON).' }) }
    const p = (body as { payload?: { fact?: unknown; lang?: unknown } } | null)?.payload
    const f = p?.fact as Record<string, unknown> | null | undefined
    if (!f || typeof f !== 'object') return send(res, 400, { ok: false, error: 'Falta el dato a auditar (fact).' })
    const fact: AuditFactInput = { statement: str(f.statement), front: str(f.front), back: str(f.back), quote: str(f.quote), kind: str(f.kind) }
    const lang = typeof p?.lang === 'string' && p.lang ? p.lang : 'es'
    const label = (fact.statement || `${fact.front} → ${fact.back}`).slice(0, 70)
    const t0 = Date.now()
    try {
      const result = await auditFact(fact, { lang })
      console.log(`[audit] «${label}» → ${result.status} ${Math.round(result.confidence * 100)}% · ${result.sources.length} fuentes · ${result.model} (${Date.now() - t0} ms)`)
      return send(res, 200, { ok: true, result })
    } catch (e) {
      const error = safeMessage(e)
      console.warn(`[audit] «${label}» falló (${Date.now() - t0} ms): ${error}`)
      return send(res, 200, { ok: false, error })
    }
  }
  return send(res, 404, { error: 'not found' })
}
