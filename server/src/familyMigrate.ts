// Migraciones de U3 (familia con varios integrantes; docs/USUARIOS.md §9). FUNCIONES PURAS —sin fs, sin config—: parent.ts
// y schedule.ts leen y ESCRIBEN sus archivos de server/data al importarse, así que la lógica de "qué forma tiene el archivo
// después de migrar" vive acá y se testea con vitest sin tocar datos reales (__tests__/familyMigrate.test.ts).
//   · parent.json v1/v2 (la config de UN chico en el top-level) → v3 { version:3, seq, tz, pinHash, members: {[id]: …} }:
//     lo de antes pasa ENTERO a members[owner] (owner = DEFAULT_USER_ID = 'ian'). El saneo campo por campo y los integrantes
//     que falten los completa parent.ts (sanitize / ensureMembers).
//   · schedules.json v1 (el objeto entero eran las secciones de ian) → v2 { version:2, members: {[id]: secciones} }.
// Los dos TIRAN si el archivo no se puede leer como objeto (o es un v3/v2 sin `members`): el que llama lo trata como
// ilegible (parent: fail-closed; horarios: fail-open), igual que antes.

export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Lo que en v1/v2 era "del chico" y en v3 es de cada integrante (members[id]). */
export const MEMBER_FIELDS = ['features', 'items', 'topics', 'extraWords', 'volume', 'preset', 'feedMotion'] as const
export type MemberField = (typeof MEMBER_FIELDS)[number]

export type UpgradedParent = { raw: Record<string, unknown>; from: 1 | 2 | 3 }
/** parent.json → forma v3 (sin sanear). Lo de un solo chico pasa ENTERO a members[owner]. Tira si no se puede leer. */
export function upgradeParentRaw(raw: unknown, owner: string): UpgradedParent {
  if (!isObject(raw)) throw new Error('parent.json no es un objeto')
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
/** schedules.json → forma v2. En v1 el objeto entero eran las secciones de `owner`. Tira si no se puede leer. */
export function upgradeSchedulesRaw(raw: unknown, owner: string): UpgradedSchedules {
  if (!isObject(raw)) throw new Error('schedules.json no es un objeto')
  if (raw.version === 2) {
    if (!isObject(raw.members)) throw new Error('schedules.json v2 sin members')
    return { raw: { version: 2, members: raw.members }, from: 2 }
  }
  return { raw: { version: 2, members: { [owner]: raw } }, from: 1 }
}
