// Lee los valores de fábrica de TODOS los prompts/reglas/constantes de Smarty directamente de su código
// (smarty-poc/app/src/lib/overrides.ts → KNOBS), para no copiarlos a mano.
//   npx tsx server/scripts/dump-smarty-defaults.ts "<ruta a smarty-poc>"
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const smarty = process.argv[2]
if (!smarty) { console.error('Uso: tsx server/scripts/dump-smarty-defaults.ts <ruta a smarty-poc>'); process.exit(1) }
// overrides.ts lee localStorage solo al llamar ov.*; un shim vacío alcanza para importar KNOBS.
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const mod = await import(pathToFileURL(join(smarty, 'app', 'src', 'lib', 'overrides.ts')).href) as { KNOBS: { key: string; kind: string; def: string }[] }
const out = Object.fromEntries(mod.KNOBS.map(k => [k.key, { kind: k.kind, def: k.def }]))
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(join(ROOT, 'data', 'defaults.json'), JSON.stringify(out, null, 1))
console.log(`OK · ${mod.KNOBS.length} valores de fábrica de Smarty`)
