// FS-BASE-B (hallazgo mytube.ts:142 "mapa de durabilidad" + space.ts:128): la escritura SEGURA de server/data, UN helper para
// todos. Antes cada módulo tenía su copia de tmp + rename (11: identity, space, teachers, afterday, schedule, mytube,
// learn-results, wishlist, learn-routes, parent y alerts), ninguna con fsync y con tres contratos de error distintos (tirar,
// boolean o tragarse el error); de ahí salían los casos de "RAM antes que disco". Acá:
//   · writeFileAtomic(path, data): tmp EN EL MISMO DIRECTORIO (`<archivo>.tmp`: el rename es atómico solo dentro del mismo
//     volumen) → fsync del tmp → rename sobre el archivo. TIRA si falla, y no deja el .tmp atrás. Es el ÚNICO contrato:
//     quien llama decide con qué responde (500 / ok:false) y NO cambia su RAM si esto tiró (disco primero).
//   · tryWriteFileAtomic(path, data, label): lo mismo, pero devuelve true/false y loguea la falla con UN formato
//     ("[label] no pude guardar <archivo>: …") — para los módulos que ya tenían contrato boolean.
//   · quarantine(path, label): aparta un archivo ilegible como `<archivo>.roto-<ms>` (la convención de docs/AGENTS.md §9;
//     mytube usaba `.broken-`, y quien buscaba *.roto-* no lo encontraba). Nunca tira.
//   · backupBeforeMigrate(path, suffix, text, label): el respaldo LITERAL antes de una migración. Si `<archivo><suffix>` no
//     existe lo crea; si existe con el MISMO contenido, alcanza; si existe con OTRO contenido (una segunda migración: p. ej.
//     un checkout viejo que reescribió el archivo), escribe `<archivo><suffix>-<ms>` — NUNCA saltea en silencio (hallazgo
//     schedule.ts:87). Devuelve la ruta del respaldo vigente o null si no se pudo escribir (el que llama decide si migra igual).
// FSYNC (evaluado, FS-BASE-B): SÍ del archivo temporal antes del rename, NO del directorio. Medido en esta Mac (APFS, 6 KB):
// sin fsync 0,2 ms por escritura; con fsync del archivo 4,9 ms; con el del directorio además, 9 ms. Las escrituras son a
// escala humana (un clic, un guardado del padre), así que 5 ms no se notan. Sin el fsync del archivo, tras un corte de luz
// o un kernel panic el rename puede quedar en disco ANTES que los datos y el archivo vuelve VACÍO o truncado: cae en el
// "ilegible" de cada módulo (Mi espacio vacío; schedules.json → todo disponible, fail-OPEN). Con él, lo que queda visible es
// siempre un archivo completo. El fsync del directorio solo haría durable el RENAME: sin él, tras un corte puede volver la
// versión ANTERIOR completa (se pierde el último cambio, el estado es consistente) — no vale otros 4 ms por escritura en un
// demo. OJO macOS: fsync() no vacía la caché de escritura del disco (eso es F_FULLFSYNC, que Node no expone); protege del
// panic del kernel y de un corte en Linux/Windows, y en macOS achica la ventana. Las cachés regenerables (los artículos)
// pasan `{ durable: false }`: solo atomicidad.
// WINDOWS: el rename puede tirar EPERM/EBUSY/EACCES un instante si el antivirus o el indexador tienen el archivo abierto (por
// eso graceful-fs reintenta en win32): acá se reintenta hasta 4 veces (10/30/60/100 ms) SOLO en win32. NO VERIFICADO en
// Windows (esta tanda corrió en macOS).
import { closeSync, existsSync, fchmodSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

/** La falla de escritura que una ruta convierte en 500 ("No pude guardar…"): la RAM ya volvió a lo que estaba en disco. */
export class DiskWriteError extends Error {
  constructor(readonly file: string, readonly err: unknown) {
    super(`no pude guardar ${basename(file)}: ${String((err as Error)?.message ?? err).slice(0, 160)}`)
    this.name = 'DiskWriteError'
  }
}

const RETRY_MS = [10, 30, 60, 100]
const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const sleepSync = (ms: number) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } catch { /* sin espera */ } }
function renameWithRetry(from: string, to: string): void {
  for (let i = 0; ; i++) {
    try { renameSync(from, to); return } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (process.platform !== 'win32' || !code || !RETRY_CODES.has(code) || i >= RETRY_MS.length) throw e
      sleepSync(RETRY_MS[i])
    }
  }
}

/** Escribe `data` en `path` de forma atómica (y durable salvo `durable: false`). Tira si falla, sin dejar el .tmp. `mode`
 *  (p. ej. 0o600 para alerts.json) se aplica al archivo nuevo aunque el .tmp de una escritura cortada ya existiera. */
export function writeFileAtomic(path: string, data: string, opts: { mode?: number; durable?: boolean } = {}): void {
  const tmp = `${path}.tmp`
  let fd: number | null = null
  try {
    fd = openSync(tmp, 'w', opts.mode ?? 0o644)
    if (opts.mode !== undefined) fchmodSync(fd, opts.mode)
    writeFileSync(fd, data)
    if (opts.durable !== false) fsyncSync(fd)
    closeSync(fd)
    fd = null
    renameWithRetry(tmp, path)
  } catch (e) {
    if (fd !== null) try { closeSync(fd) } catch { /* ya está */ }
    try { unlinkSync(tmp) } catch { /* no quedó */ }
    throw e
  }
}

/** writeFileAtomic con el contrato boolean: true = quedó escrito; false = no (logueado con un solo formato). */
export function tryWriteFileAtomic(path: string, data: string, label: string, opts: { mode?: number; durable?: boolean } = {}): boolean {
  try { writeFileAtomic(path, data, opts); return true } catch (e) {
    console.error(`[${label}] no pude guardar ${basename(path)}:`, e)
    return false
  }
}

/** Aparta un archivo ilegible como `<archivo>.roto-<ms>` (no se pisa: el próximo guardado escribe uno nuevo). Devuelve la
 *  ruta de la copia, o null si no se pudo (sin copia: el que llama sigue igual). Nunca tira. */
export function quarantine(path: string, label: string): string | null {
  const roto = `${path}.roto-${Date.now()}`
  try { renameSync(path, roto); console.warn(`[${label}] copia del archivo ilegible en ${basename(roto)}`); return roto }
  catch { return null }
}

/** El respaldo LITERAL de antes de migrar (ver la cabecera): la ruta del respaldo vigente, o null si no se pudo escribir. */
export function backupBeforeMigrate(path: string, suffix: string, text: string, label: string): string | null {
  const first = `${path}${suffix}`
  try {
    if (!existsSync(first)) {
      writeFileAtomic(first, text)
      console.log(`[${label}] respaldo de la versión anterior en ${basename(first)}`)
      return first
    }
    if (readFileSync(first, 'utf8') === text) return first // la misma versión ya estaba respaldada
    const again = `${first}-${Date.now()}`
    writeFileAtomic(again, text)
    console.log(`[${label}] ${basename(first)} ya tenía OTRA versión: este respaldo va en ${basename(again)}`)
    return again
  } catch (e) {
    console.error(`[${label}] no pude escribir el respaldo ${basename(first)}:`, e)
    return null
  }
}
