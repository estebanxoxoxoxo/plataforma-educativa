// Importa la configuración desde el respaldo COMPLETO de Smarty (smarty-all-*.json, cifrado con el PIN del padre).
//   npm run import:smarty -- "<ruta al smarty-all-*.json>"
//       → pide el PIN en la terminal SIN mostrarlo.
//   SMARTY_PIN_FILE=<archivo que solo tiene el PIN> npm run import:smarty -- "<ruta>"
//       → sin terminal interactiva: lee el PIN de ese archivo y lo BORRA.
// FS-BASE-A: el PIN NUNCA va en la línea de comandos. `SMARTY_PIN=xxxxxx npm run …` (el instructivo de antes) lo dejaba en el
// historial del shell y a la vista de `ps` mientras corría: el script ahora lo rechaza.
// Flags: --allow-plain (aceptar un respaldo SIN cifrar, solo si es tuyo) · --force (aceptar que el respaldo deje vacío algo
// que hoy tiene datos: catálogo, palabras, temas, sitios o claves).
// Escribe (todo gitignored, con permisos 0600: solo tu usuario los lee):
//   server/.env               → claves de API (nunca se imprimen)
//   server/data/config.json   → listas y ajustes que usa el backend
//   server/data/catalog.json  → el catálogo de videos aprobados
// FS-BASE-A — ANTES de escribir nada valida (y si algo no pasa, termina con un error claro SIN TOCAR NADA):
//   · formato 'smarty-backup' y ámbito 'all' (como importAll del POC: un smarty-setup/-catalogo/-sesion vaciaba el catálogo,
//     las claves o los filtros de fábrica —y con ellos las palabras bloqueadas de los chicos— y el script decía OK);
//   · que no se vacíe en silencio lo que hoy hay (catálogo, palabras bloqueadas, temas, sitios, claves): hace falta --force;
//   · que cada clave sea un token sin saltos de línea, espacios ni caracteres de control (una clave con "\n" plantaba una
//     línea NODE_OPTIONS en server/.env, y `tsx watch --env-file` la aplica: código ajeno en cada arranque de la API).
// Escribe todo a archivos temporales y recién después los renombra; deja copia de lo anterior en <archivo>.pre-import (0600).
// JAMÁS imprime una clave ni el PIN (solo "sí/no" por clave).
import { createDecipheriv, createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data')
const args = process.argv.slice(2)
const flags = { allowPlain: args.includes('--allow-plain'), force: args.includes('--force') }
const file = args.find(a => !a.startsWith('--'))
const USO = 'Uso: npm run import:smarty -- "<ruta al smarty-all-*.json>"   (el PIN se pide sin mostrarlo; sin terminal: SMARTY_PIN_FILE=<archivo>)'

/** Termina con un error claro; nada se escribió. */
function fail(msg) {
  console.error(`✗ ${msg}\n  No se escribió nada.`)
  process.exit(1)
}
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)

if (process.env.SMARTY_PIN !== undefined) {
  fail('Por seguridad el PIN ya no se pasa en la línea de comandos (SMARTY_PIN=…): queda en el historial del shell y se ve con `ps`.\n'
    + '  Corré sin SMARTY_PIN y el script lo pide sin mostrarlo, o usá SMARTY_PIN_FILE=<archivo con el PIN> (se borra al leerlo).\n'
    + '  Si ya lo corriste así alguna vez: borrá esa línea de ~/.zsh_history (y de ~/.zsh_sessions/) y cambiá el PIN en Smarty.')
}
// SMARTY_PIN_FILE se lee y se BORRA ya, antes que cualquier otra cosa (aunque el respaldo termine sin necesitarlo).
let pinFromFile
if (process.env.SMARTY_PIN_FILE) {
  const f = process.env.SMARTY_PIN_FILE
  try { pinFromFile = readFileSync(f, 'utf8').trim() } catch { fail('No pude leer SMARTY_PIN_FILE.') }
  try { unlinkSync(f) } catch { console.error('Aviso: no pude borrar el archivo del PIN (SMARTY_PIN_FILE): borralo a mano.') }
}
if (!file) fail(USO)

/** El PIN: el de SMARTY_PIN_FILE (ya borrado) o pedido en la terminal sin eco. */
async function readPin() {
  if (pinFromFile !== undefined) return pinFromFile
  if (!process.stdin.isTTY) fail('Sin terminal interactiva para pedir el PIN: usá SMARTY_PIN_FILE=<archivo que solo tiene el PIN> (se borra al leerlo).')
  return new Promise(resolve => {
    const stdin = process.stdin
    process.stdout.write('PIN de padres de Smarty (no se muestra): ')
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
    let pin = ''
    const onData = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n' || c === '\u0004') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(pin); return }
        if (c === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130) }
        if (c === '\u007f' || c === '\b') pin = pin.slice(0, -1)
        else pin += c
      }
    }
    stdin.on('data', onData)
  })
}

/* ---------- 1) leer y descifrar (mismo esquema que smarty-poc/app/src/lib/backup.ts: AES-GCM, clave = sha256(PIN)) ---------- */
let env
try { env = JSON.parse(readFileSync(file, 'utf8')) } catch { fail('No es un archivo JSON válido (¿es el respaldo de Smarty?).') }
let backup
if (env?.format === 'smarty-backup-enc') {
  const pin = await readPin()
  if (!pin) fail('Falta el PIN.')
  try {
    const key = createHash('sha256').update(pin).digest()
    const raw = Buffer.from(String(env.data ?? ''), 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(env.iv ?? ''), 'base64'))
    decipher.setAuthTag(raw.subarray(raw.length - 16)) // WebCrypto pega el tag al final
    backup = JSON.parse(Buffer.concat([decipher.update(raw.subarray(0, raw.length - 16)), decipher.final()]).toString('utf8'))
  } catch {
    fail('PIN incorrecto o respaldo dañado: no se pudo descifrar.')
  }
} else if (env?.format === 'smarty-backup') {
  if (!flags.allowPlain) fail('Este respaldo NO está cifrado: cualquiera pudo armarlo o editarlo. Si es tuyo y lo exportaste vos, repetí con --allow-plain.')
  backup = env
} else {
  fail('Ese archivo no es un respaldo de Smarty (falta format: "smarty-backup").')
}

/* ---------- 2) validar formato y ámbito ANTES de armar nada ---------- */
if (backup?.format !== 'smarty-backup') fail('El contenido no es un respaldo de Smarty (format).')
const scope = backup.scope ?? 'all' // los respaldos viejos, sin scope, eran completos (como en el POC)
if (scope !== 'all') {
  fail(`Este respaldo es del ámbito «${scope}» (smarty-${scope}-…): el importador necesita el respaldo COMPLETO, smarty-all-*.json\n`
    + '  (en Smarty: Respaldo → «Todo»). Con uno parcial quedarían vacíos el catálogo, las claves o los filtros de fábrica.')
}
if (!isObj(backup.settings) || !isObj(backup.tables)) fail('El respaldo está incompleto (faltan settings o tables).')

const s = backup.settings
const t = backup.tables
const list = k => (Array.isArray(t[k]) ? t[k] : [])
const ov = Object.fromEntries(Object.entries(s).filter(([k, v]) => k.startsWith('smarty.ov.') && typeof v === 'string').map(([k, v]) => [k.slice('smarty.ov.'.length), v]))

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
  sites: list('sites').map(({ domain, status, blocked }) => ({ domain, status, blocked: !!blocked })),
  topics: list('topics').map(({ kind, name, description, critical }) => ({ kind, name, description: description ?? '', critical: !!critical })),
  lenses: list('lenses').map(({ lenteId, definicion }) => ({ lenteId, definicion })),
  ficha: list('ficha').map(({ category, text }) => ({ category, text })),
  ytEntries: list('youtube').filter(e => e.status === 'activo' && (e.videoIds?.length ?? 0) > 0).map(({ id, title }) => ({ id, title })),
  domainRules: list('domainRules').map(({ scope, kind, value }) => ({ scope, kind, value })),
  blockedWords: list('blockedWords').map(w => w.word),
  overrides: ov,
}

// Catálogo de videos APROBADOS (lista blanca de YouTube). Liviano: descripción truncada como en el índice de Smarty.
const entryTitle = new Map(list('youtube').map(e => [e.id, e.title ?? '']))
const seen = new Set()
const catalog = []
for (const v of list('ytVideos')) {
  if (!v?.videoId || seen.has(v.videoId)) continue
  seen.add(v.videoId)
  catalog.push({
    videoId: v.videoId, title: v.title ?? '', thumb: v.thumb ?? '', channelId: v.channelId ?? '', channelTitle: v.channelTitle ?? '',
    source: entryTitle.get(v.entryId) ?? '', description: (v.description ?? '').slice(0, 140), duration: v.duration ?? 0,
    addedAt: v.addedAt ?? 0, tags: Array.isArray(v.tags) ? v.tags : [], topics: Array.isArray(v.topics) ? v.topics : [],
  })
}

/* ---------- 3) las claves: SOLO tokens (ni saltos de línea, ni espacios, ni comillas, ni caracteres de control) ---------- */
const KEYS = { OPENAI_API_KEY: 'smarty.openaiKey', SERPER_API_KEY: 'smarty.serperKey', YOUTUBE_API_KEY: 'smarty.youtubeKey', PIXABAY_API_KEY: 'smarty.pixabayKey', VISION_API_KEY: 'smarty.visionKey' }
const KEY_RE = /^[A-Za-z0-9._-]{8,512}$/
const keyVals = {}
for (const [name, k] of Object.entries(KEYS)) {
  const raw = s[k]
  if (raw === undefined || raw === null || raw === '') { keyVals[name] = ''; continue }
  if (typeof raw !== 'string') fail(`La clave ${name} del respaldo no es texto.`)
  const v = raw.trim()
  if (v && !KEY_RE.test(v)) fail(`La clave ${name} del respaldo tiene caracteres no permitidos (saltos de línea, espacios, comillas o símbolos) o un largo raro: no parece una clave.`)
  keyVals[name] = v // el valor jamás se imprime
}
const envText = `# Generado por import-smarty.mjs — NO commitear\nPORT=8787\n${Object.entries(keyVals).map(([n, v]) => `${n}=${v}`).join('\n')}\n`
// Defensa en profundidad: el .env tiene EXACTAMENTE las líneas esperadas, cada una NOMBRE=token.
const envLines = envText.split('\n').filter(Boolean)
if (envLines.length !== 2 + Object.keys(KEYS).length || !envLines.every(l => l.startsWith('# ') || /^[A-Z_]+=[A-Za-z0-9._-]*$/.test(l))) fail('El .env armado no tiene la forma esperada.')

/* ---------- 4) no vaciar en silencio lo que hoy hay ---------- */
const ENV_FILE = join(ROOT, '.env'), CONFIG_FILE = join(DATA, 'config.json'), CATALOG_FILE = join(DATA, 'catalog.json')
function current() {
  const out = { catalog: false, blockedWords: 0, topics: 0, sites: 0, keys: 0 }
  try { out.catalog = existsSync(CATALOG_FILE) && statSync(CATALOG_FILE).size > 2 } catch { /* sin catálogo */ }
  try {
    const c = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
    out.blockedWords = Array.isArray(c.blockedWords) ? c.blockedWords.length : 0
    out.topics = Array.isArray(c.topics) ? c.topics.length : 0
    out.sites = Array.isArray(c.sites) ? c.sites.length : 0
  } catch { /* sin config */ }
  try {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
      if (m && Object.hasOwn(KEYS, m[1]) && m[2].trim()) out.keys++ // solo se cuentan: el valor no se mira
    }
  } catch { /* sin .env */ }
  return out
}
const cur = current()
const newKeys = Object.values(keyVals).filter(Boolean).length
const gone = []
if (!catalog.length && cur.catalog) gone.push('el catálogo de videos aprobados')
if (!config.blockedWords.length && cur.blockedWords) gone.push(`las palabras bloqueadas de fábrica (hoy ${cur.blockedWords})`)
if (!config.topics.length && cur.topics) gone.push(`los temas (hoy ${cur.topics})`)
if (!config.sites.length && cur.sites) gone.push(`los sitios aprobados (hoy ${cur.sites})`)
if (!newKeys && cur.keys) gone.push(`las claves de API (hoy ${cur.keys})`)
if (gone.length && !flags.force) {
  fail(`El respaldo dejaría VACÍO: ${gone.join(', ')}.\n  ¿Es el respaldo correcto (smarty-all-*.json)? Si de verdad querés vaciarlo, repetí con --force.`)
}

/* ---------- 5) escribir: todo a temporales (0600), copia de lo anterior, y recién ahí renombrar ---------- */
mkdirSync(DATA, { recursive: true })
const outputs = [
  [CONFIG_FILE, JSON.stringify(config, null, 1)],
  [CATALOG_FILE, JSON.stringify(catalog)],
  [ENV_FILE, envText],
]
const tmpOf = p => `${p}.tmp-import`
try {
  for (const [p, text] of outputs) writeFileSync(tmpOf(p), text, { mode: 0o600 })
} catch (e) {
  for (const [p] of outputs) rmSync(tmpOf(p), { force: true })
  fail(`No pude escribir los archivos nuevos (${String(e?.code ?? e?.message ?? e)}).`)
}
for (const [p] of outputs) {
  if (!existsSync(p)) continue
  try { copyFileSync(p, `${p}.pre-import`); chmodSync(`${p}.pre-import`, 0o600) } catch { console.error(`Aviso: no pude guardar la copia de ${p} (.pre-import).`) }
}
for (const [p] of outputs) { renameSync(tmpOf(p), p); chmodSync(p, 0o600) }

console.log(`OK · ${catalog.length} videos aprobados · ${config.sites.length} sitios · ${config.topics.length} temas · ${config.domainRules.length} reglas de dominio · ${config.blockedWords.length} palabras bloqueadas`)
console.log('Claves presentes:', Object.entries(keyVals).map(([n, v]) => `${n}=${v ? 'sí' : 'no'}`).join(' · '))
console.log('Archivos con permisos 0600 (solo tu usuario); lo anterior quedó en *.pre-import.')
if (!existsSync(join(DATA, 'defaults.json'))) {
  console.log('Falta server/data/defaults.json (los valores de fábrica de Smarty): corré\n  npx tsx server/scripts/dump-smarty-defaults.ts "<ruta a smarty-poc>"\n  antes de npm run dev (sin él la API no levanta).')
}
console.log('IMPORTANTE: el respaldo equivale a texto plano (un PIN de 6 dígitos se adivina en segundos). Borralo ya —y vaciá la\n'
  + '  Papelera— o guardalo en un volumen cifrado; no lo mandes por mail, chat ni Drive.')
