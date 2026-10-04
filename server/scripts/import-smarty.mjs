// Importa la configuración desde un backup cifrado de Smarty.
//   SMARTY_PIN=xxxxxx node server/scripts/import-smarty.mjs "<ruta al smarty-all-*.json>"
// Escribe (ambos gitignored):
//   server/.env               → claves de API (nunca se imprimen)
//   server/data/config.json   → listas y ajustes que usa el backend
import { createDecipheriv, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2]
const pin = process.env.SMARTY_PIN
if (!file || !pin) {
  console.error('Uso: SMARTY_PIN=xxxxxx node server/scripts/import-smarty.mjs <backup.json>')
  process.exit(1)
}

// Mismo esquema que smarty-poc/app/src/lib/backup.ts: AES-GCM, clave = sha256(PIN) en hex → bytes.
const env = JSON.parse(readFileSync(file, 'utf8'))
let backup
if (env.format === 'smarty-backup-enc') {
  const key = createHash('sha256').update(pin).digest()
  const raw = Buffer.from(env.data, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
  decipher.setAuthTag(raw.subarray(raw.length - 16)) // WebCrypto pega el tag al final
  try {
    backup = JSON.parse(Buffer.concat([decipher.update(raw.subarray(0, raw.length - 16)), decipher.final()]).toString('utf8'))
  } catch {
    console.error('PIN incorrecto: no se pudo descifrar el respaldo.')
    process.exit(1)
  }
} else {
  backup = env
}

const s = backup.settings
const t = backup.tables
const ov = Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('smarty.ov.')).map(([k, v]) => [k.slice('smarty.ov.'.length), v]))

const config = {
  importedAt: new Date().toISOString(),
  exportedAt: backup.exportedAt,
  policyVersion: Number(s['smarty.policyVersion'] || 1),
  modelPreset: s['smarty.modelPreset'] || 'calidad',
  articulosModo: s['smarty.articulosModo'] || 'blanca',
  searchGl: s['smarty.searchGl'] || 'ar',
  searchHl: s['smarty.searchHl'] || 'es',
  // ajustes del chat / imágenes (no secretos)
  apodo: s['smarty.apodo'] || '',
  instrucciones: s['smarty.instrucciones'] || '',
  helpline: s['smarty.helpline'] || '',
  soloFuentes: s['smarty.soloFuentes'] === '1',
  imagenesActivo: s['smarty.imagenesActivo'] !== '0',
  saltearJuezVideos: s['smarty.saltearJuezVideos'] === '1',
  moderacionEstricta: s['smarty.moderacionEstricta'] !== '0',
  sites: (t.sites ?? []).map(({ domain, status, blocked }) => ({ domain, status, blocked: !!blocked })),
  topics: (t.topics ?? []).map(({ kind, name, description, critical }) => ({ kind, name, description: description ?? '', critical: !!critical })),
  lenses: (t.lenses ?? []).map(({ lenteId, definicion }) => ({ lenteId, definicion })),
  ficha: (t.ficha ?? []).map(({ category, text }) => ({ category, text })),
  ytEntries: (t.youtube ?? []).filter(e => e.status === 'activo' && (e.videoIds?.length ?? 0) > 0).map(({ id, title }) => ({ id, title })),
  domainRules: (t.domainRules ?? []).map(({ scope, kind, value }) => ({ scope, kind, value })),
  blockedWords: (t.blockedWords ?? []).map(w => w.word),
  overrides: ov,
}
mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(join(ROOT, 'data', 'config.json'), JSON.stringify(config, null, 1))

// Catálogo de videos APROBADOS (lista blanca de YouTube). Liviano: descripción truncada como en el índice de Smarty.
const entryTitle = new Map((t.youtube ?? []).map(e => [e.id, e.title ?? '']))
const seen = new Set()
const catalog = []
for (const v of t.ytVideos ?? []) {
  if (!v.videoId || seen.has(v.videoId)) continue
  seen.add(v.videoId)
  catalog.push({
    videoId: v.videoId, title: v.title ?? '', thumb: v.thumb ?? '', channelId: v.channelId ?? '', channelTitle: v.channelTitle ?? '',
    source: entryTitle.get(v.entryId) ?? '', description: (v.description ?? '').slice(0, 140), duration: v.duration ?? 0,
    addedAt: v.addedAt ?? 0, tags: Array.isArray(v.tags) ? v.tags : [], topics: Array.isArray(v.topics) ? v.topics : [],
  })
}
writeFileSync(join(ROOT, 'data', 'catalog.json'), JSON.stringify(catalog))

const KEYS = { OPENAI_API_KEY: 'smarty.openaiKey', SERPER_API_KEY: 'smarty.serperKey', YOUTUBE_API_KEY: 'smarty.youtubeKey', PIXABAY_API_KEY: 'smarty.pixabayKey', VISION_API_KEY: 'smarty.visionKey' }
const lines = Object.entries(KEYS).map(([name, k]) => `${name}=${(s[k] ?? '').trim()}`)
writeFileSync(join(ROOT, '.env'), `# Generado por import-smarty.mjs — NO commitear\nPORT=8787\n${lines.join('\n')}\n`)

console.log(`OK · ${catalog.length} videos aprobados · ${config.sites.length} sitios · ${config.topics.length} temas · ${config.domainRules.length} reglas de dominio · ${config.blockedWords.length} palabras bloqueadas`)
console.log('Claves presentes:', Object.entries(KEYS).map(([n, k]) => `${n}=${(s[k] ?? '').trim() ? 'sí' : 'no'}`).join(' · '))
