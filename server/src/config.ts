// Configuración importada desde Smarty (server/data/config.json, generado por scripts/import-smarty.mjs).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* FS-BASE-B (hallazgo config.ts:31): server/data/ está en .gitignore, así que en un clon limpio (o en CI) no hay config.json
   ni defaults.json, y las 20 suites que llegan a este módulo morían al importar con ENOENT. Bajo vitest (VITEST=true) y SOLO
   si falta el archivo real, se leen los FIXTURES commiteados de server/src/__tests__/fixtures/: una config SINTÉTICA (sin
   datos de la familia) y los valores de fábrica (copia de defaults.json, que sale del código del POC: no tiene nada de la
   familia). Con los archivos reales presentes no cambia nada. Fuera de los tests, sin el archivo la API no arranca, como
   siempre (correr el import de Smarty: README). */
function dataFile(name: string): string {
  const real = join(SERVER_ROOT, 'data', name)
  if (existsSync(real) || process.env.VITEST !== 'true') return real
  const fx = join(SERVER_ROOT, 'src', '__tests__', 'fixtures', name)
  console.warn(`[config] falta server/data/${name}: los tests usan el fixture ${join('server', 'src', '__tests__', 'fixtures', name)}`)
  return fx
}

export interface SmartyConfig {
  policyVersion: number
  modelPreset: 'calidad' | 'maxima' | 'economico'
  articulosModo: 'blanca' | 'negra' | 'hibrido'
  searchGl: string
  searchHl: string
  apodo: string
  instrucciones: string
  helpline: string
  soloFuentes: boolean
  imagenesActivo: boolean
  saltearJuezVideos: boolean
  moderacionEstricta: boolean
  lenses: { lenteId: string; definicion: string }[]
  ficha: { category: string; text: string }[]
  ytEntries: { id: number; title: string }[]
  sites: { domain: string; status: string; blocked: boolean }[]
  topics: { kind: 'blanca' | 'negra'; name: string; description: string; critical: boolean }[]
  domainRules: { scope: string; kind: 'blanca' | 'negra'; value: string }[]
  blockedWords: string[]
  overrides: Record<string, string>
}

export const config: SmartyConfig = JSON.parse(readFileSync(dataFile('config.json'), 'utf8'))

/* Valores de fábrica de Smarty: server/data/defaults.json, leído del código de Smarty (scripts/dump-smarty-defaults.ts).
   El override de la familia (exportado en el backup) gana sobre el de fábrica, igual que en Smarty. */
const DEFAULTS: Record<string, { kind: string; def: string }> = JSON.parse(readFileSync(dataFile('defaults.json'), 'utf8'))
const splitWords = (s: string) => s.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean)
const splitLines = (s: string) => s.split('\n').map(t => t.trim()).filter(Boolean)
export const ov = {
  text(k: string): string {
    if (k in config.overrides) return config.overrides[k]
    if (!(k in DEFAULTS)) throw new Error(`overrides: knob desconocido «${k}»`)
    return DEFAULTS[k].def
  },
  num(k: string): number { const n = Number(ov.text(k)); return Number.isFinite(n) ? n : Number(DEFAULTS[k]?.def) },
  lines: (k: string) => splitLines(ov.text(k)),
  words: (k: string) => splitWords(ov.text(k)),
}
/** Sustituye {{nombre}} por vars[nombre] (overrides.ts fill). */
export const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{(\w+)\}\}/g, (m, n) => (n in vars ? vars[n] : m))

/* Modelos por preset (smarty-poc settings.ts MODELS). El juez siempre es gpt-5.4-mini. */
export const MODELS = {
  calidad: { principal: 'gpt-5.4', juez: 'gpt-5.4-mini' },
  maxima: { principal: 'gpt-5.5', juez: 'gpt-5.4-mini' },
  economico: { principal: 'gpt-5.4-mini', juez: 'gpt-5.4-mini' },
}[config.modelPreset] ?? { principal: 'gpt-5.4', juez: 'gpt-5.4-mini' }

/* Listas derivadas (mismo criterio que articleTools.ts / articleAccess.ts). */
export function whitelistSites(): string[] {
  const blanca = config.sites.filter(s => s.status === 'activo' && !s.blocked).map(s => s.domain)
  const prio = ov.text('const.articulosPrioritarios').split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
  const rank = (d: string) => { const i = prio.indexOf(d.toLowerCase()); return i === -1 ? prio.length : i }
  return prio.length ? [...blanca].sort((a, b) => rank(a) - rank(b)) : blanca
}
export const articleBlacklist = () => config.domainRules.filter(r => r.scope === 'articulos' && r.kind === 'negra').map(r => r.value)
export const blockedSiteDomains = () => config.sites.filter(s => s.blocked).map(s => s.domain.toLowerCase())
export const blackTopics = () => config.topics.filter(t => t.kind === 'negra')
export const whiteTopics = () => config.topics.filter(t => t.kind === 'blanca')
