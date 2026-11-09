import type { FamilyLeague } from '../../../api/types';
import { L } from '../../../shared/lib/lang';

/** Las solapas de /ligas (deep-link con ?tab=): Mi liga (default, sin parámetro) · Tu zona · País · Familia (U4 · D2). */
export type LTab = 'liga' | 'zona' | 'pais' | 'familia';

// Getters: el rótulo se resuelve al leerlo (en el render), no al importar (si no, quedaría en el idioma de la carga).
export const BASE_TABS: { id: LTab; label: string }[] = [
  { id: 'liga', get label() { return L('Mi liga', 'My league'); } },
  { id: 'zona', get label() { return L('Tu zona', 'Your area'); } },
  { id: 'pais', get label() { return L('País', 'Country'); } },
];
export const FAMILY_TAB: { id: LTab; label: string } = { id: 'familia', get label() { return L('Familia', 'Family'); } };

/** La solapa Familia existe solo si la tabla llegó y tiene al menos DOS integrantes (una familia de uno —p. ej. el adulto
 *  con los dos chicos con Ligas apagadas— no es una competencia). Si la lectura falló (null), tampoco: las otras siguen. */
export const familyTabOn = (f: FamilyLeague | null | undefined): boolean => !!f && f.rows.length >= 2;

/** La solapa que se muestra para `?tab=`: zona/país/familia si existen; cualquier otra cosa —o `familia` sin solapa—, Mi liga. */
export function resolveTab(q: string | null, familyOn: boolean): LTab {
  if (q === 'zona' || q === 'pais') return q;
  if (q === 'familia' && familyOn) return 'familia';
  return 'liga';
}

/** El caption de Mi liga: "Liga Cometa · 12 en tu liga" (TEEN-COPY 4-nov: «chicos» sonaba a nene para 13); para un adulto (su tabla es de OTROS GRANDES, U4 · D4) "· 12 grandes". */
export const leagueCaption = (name: string, total: number, adult: boolean) => `${name} · ${total} ${adult ? L('grandes', 'adults') : L('en tu liga', 'in your league')}`;

/** El caption de Tu zona / País: el lugar ("Palermo"); para un adulto, "Grandes de Palermo" (U4-B2: sus tops son de
 *  grandes, con la misma fórmula y anclas que los de los chicos). */
export const geoCaption = (name: string, adult: boolean) => (adult ? L(`Grandes de ${name}`, `Adults in ${name}`) : name);
