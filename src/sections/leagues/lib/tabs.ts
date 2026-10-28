import type { FamilyLeague } from '../../../api/types';

/** Las solapas de /ligas (deep-link con ?tab=): Mi liga (default, sin parámetro) · Tu zona · País · Familia (U4 · D2). */
export type LTab = 'liga' | 'zona' | 'pais' | 'familia';

export const BASE_TABS: { id: LTab; label: string }[] = [
  { id: 'liga', label: 'Mi liga' },
  { id: 'zona', label: 'Tu zona' },
  { id: 'pais', label: 'País' },
];
export const FAMILY_TAB: { id: LTab; label: string } = { id: 'familia', label: 'Familia' };

/** La solapa Familia existe solo si la tabla llegó y tiene al menos DOS integrantes (una familia de uno —p. ej. el adulto
 *  con los dos chicos con Ligas apagadas— no es una competencia). Si la lectura falló (null), tampoco: las otras siguen. */
export const familyTabOn = (f: FamilyLeague | null | undefined): boolean => !!f && f.rows.length >= 2;

/** La solapa que se muestra para `?tab=`: zona/país/familia si existen; cualquier otra cosa —o `familia` sin solapa—, Mi liga. */
export function resolveTab(q: string | null, familyOn: boolean): LTab {
  if (q === 'zona' || q === 'pais') return q;
  if (q === 'familia' && familyOn) return 'familia';
  return 'liga';
}

/** El caption de Mi liga: "Liga Cometa · 12 chicos"; para un adulto (su tabla es de OTROS GRANDES, U4 · D4) "· 12 grandes". */
export const leagueCaption = (name: string, total: number, adult: boolean) => `${name} · ${total} ${adult ? 'grandes' : 'chicos'}`;

/** El caption de Tu zona / País: el lugar ("Palermo"); para un adulto, "Grandes de Palermo" (U4-B2: sus tops son de
 *  grandes, con la misma fórmula y anclas que los de los chicos). */
export const geoCaption = (name: string, adult: boolean) => (adult ? `Grandes de ${name}` : name);
