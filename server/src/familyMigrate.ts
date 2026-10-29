// Migraciones de U3 (familia con varios integrantes; docs/USUARIOS.md §9). FUNCIONES PURAS —sin fs, sin config—: parent.ts
// y schedule.ts leen y ESCRIBEN sus archivos de server/data al importarse, así que la lógica de "qué forma tiene el archivo
// después de migrar" vive acá y se testea con vitest sin tocar datos reales (__tests__/familyMigrate.test.ts).
//   · parent.json v1/v2 (la config de UN chico en el top-level) → v3 { version:3, seq, tz, pinHash, members: {[id]: …} }:
//     lo de antes pasa ENTERO a members[owner] (owner = DEFAULT_USER_ID = 'ian'). El saneo campo por campo y los integrantes
//     que falten los completa parent.ts (sanitize / ensureMembers).
//   · schedules.json v1 (el objeto entero eran las secciones de ian) → v2 { version:2, members: {[id]: secciones} }.
//   · schedules.json v1/v2 → v3 (Ciclo del día, F1): { version:3, members: {[id]: {ranges: []}} } — lo de antes NO se
//     convierte (ver upgradeCycleRaw).
// Todas TIRAN si el archivo no se puede leer como objeto (o es un v3/v2 sin `members`): el que llama lo trata como
// ilegible (parent: fail-closed; horarios/ciclo: fail-open), igual que antes. FS-BASE-B (hallazgo familyMigrate.ts:31):
// también tiran con una `version` DESCONOCIDA —presente y que no es 1, 2 ni 3 (un "3" de texto editado a mano, un 4 de un
// checkout futuro)—. Antes eso se "migraba" como un v1: parent.json arrancaba a Ian sin temas ni palabras y a Luna con la
// config de FÁBRICA (todo prendido) y se reescribía sin copia; schedules.json perdía los rangos. Ahora es un archivo
// ilegible: el que llama lo aparta ENTERO como .roto-<ms> (no se pierde) y arranca como con cualquier ilegible —parent.json
// CERRADO (todo apagado, sin premios), schedules.json sin rangos (todo disponible)—. Un v1 real nunca trajo `version`.

export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Tira si `raw.version` está y no es una de `known` (las versiones que este código sabe leer; ausente = v1). */
export function assertKnownVersion(raw: Record<string, unknown>, known: readonly number[], file: string): void {
  if (raw.version === undefined || known.includes(raw.version as number)) return
  throw new Error(`${file} con una versión desconocida (${JSON.stringify(raw.version).slice(0, 20)}): no la sé leer`)
}

/** Lo que en v1/v2 era "del chico" y en v3 es de cada integrante (members[id]). */
export const MEMBER_FIELDS = ['features', 'items', 'topics', 'extraWords', 'volume', 'preset', 'feedMotion'] as const
export type MemberField = (typeof MEMBER_FIELDS)[number]

export type UpgradedParent = { raw: Record<string, unknown>; from: 1 | 2 | 3 }
/** parent.json → forma v3 (sin sanear). Lo de un solo chico pasa ENTERO a members[owner]. Tira si no se puede leer. */
export function upgradeParentRaw(raw: unknown, owner: string): UpgradedParent {
  if (!isObject(raw)) throw new Error('parent.json no es un objeto')
  assertKnownVersion(raw, [1, 2, 3], 'parent.json')
  if (raw.version === 3) {
    if (!isObject(raw.members)) throw new Error('parent.json v3 sin members')
    return { raw, from: 3 }
  }
  const member: Record<string, unknown> = {}
  for (const k of MEMBER_FIELDS) if (k in raw) member[k] = raw[k] // lo que falte lo completa el saneo con su default
  return {
    raw: { version: 3, seq: raw.seq, tz: raw.tz ?? null, pinHash: raw.pinHash, members: { [owner]: member } },
    from: raw.version === 2 ? 2 : 1,
  }
}

export type UpgradedSchedules = { raw: { version: 2; members: Record<string, unknown> }; from: 1 | 2 }
/** schedules.json → forma v2. En v1 el objeto entero eran las secciones de `owner`. Tira si no se puede leer.
 *  (Histórico desde F1: schedule.ts ya no la usa —lee con upgradeCycleRaw—; queda por sus tests y como registro del v2.) */
export function upgradeSchedulesRaw(raw: unknown, owner: string): UpgradedSchedules {
  if (!isObject(raw)) throw new Error('schedules.json no es un objeto')
  if (raw.version === 2) {
    if (!isObject(raw.members)) throw new Error('schedules.json v2 sin members')
    return { raw: { version: 2, members: raw.members }, from: 2 }
  }
  return { raw: { version: 2, members: { [owner]: raw } }, from: 1 }
}

/* Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11): schedules.json v3 = { version: 3, members: { [id]: { ranges } } }.
   Los horarios SEMANALES por sección (v1/v2: por sección, 7 días con su franja) NO se convierten a rangos: los modelos no
   mapean (una semana por sección no es "en este rango del día, estas secciones") y adivinar podría encerrar al chico. Un
   v1/v2 arranca con cada integrante SIN rangos (todo disponible) y el que llama deja el original UNA vez en .pre-v3. */
export type UpgradedCycle = { raw: { version: 3; members: Record<string, unknown> }; from: 1 | 2 | 3 }
/** schedules.json → forma v3 (sin sanear: los rangos los sanea schedule.ts con sanitizeStoredRanges). v3 se lee tal cual;
 *  v1/v2 → `members` = cada id de `memberIds` con `{ranges: []}`. Tira si no es un objeto o es un v3 sin members. */
export function upgradeCycleRaw(raw: unknown, memberIds: readonly string[]): UpgradedCycle {
  if (!isObject(raw)) throw new Error('schedules.json no es un objeto')
  assertKnownVersion(raw, [1, 2, 3], 'schedules.json')
  if (raw.version === 3) {
    if (!isObject(raw.members)) throw new Error('schedules.json v3 sin members')
    return { raw: { version: 3, members: raw.members }, from: 3 }
  }
  const members: Record<string, unknown> = {}
  for (const id of memberIds) if (id !== '__proto__') members[id] = { ranges: [] }
  return { raw: { version: 3, members }, from: raw.version === 2 ? 2 : 1 }
}
