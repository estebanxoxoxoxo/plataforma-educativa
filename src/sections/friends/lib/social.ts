// U4 · D4 (docs/USUARIOS.md §10): lo SOCIAL de Innerith es de los CHICOS. Amigos, el dock de Mensajes (y su "Buscar
// personas"), Buscar → Personas, las solicitudes de la campana y de la zona pinneada del Feed y los regalos de ropa a un
// amigo existen solo con un chico activo y con Amigos prendido por su familia. Un ADULTO no tiene amigos chicos: su grafo
// nace vacío y el server ya le responde vacío (`search` → `people: []`, `requests/send` → ok:false); la UI no le muestra
// superficies muertas. Ojo: useFeatures() le da al adulto TODO prendido (los candados son del chico), por eso la regla mira
// `kind` aparte —igual que Mentores en Buscar, al revés—. Lo que NO es social y sí ve el adulto: su liga, la tabla de la
// familia y el botón de demo "Simular NPCs" del Feed (trae la carrera de SU liga).
import type { User } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { useFeatures } from '../../parent/lib/features';

/** true = lo social se muestra · false = no existe (Amigos apagado para el chico activo, o el activo es un adulto) ·
 *  undefined = todavía no se sabe si Amigos está prendido (fail-closed: no se muestra; patrón de useFeatures).
 *  Sin usuario resuelto (falló /api/me) se trata como chico: manda lo que diga Amigos. Puro (tests en __tests__). */
export function socialOn(amigos: boolean | undefined, kind: User['kind'] | undefined): boolean | undefined {
  if (kind === 'adult') return false;
  return amigos;
}

/** Lo de arriba para el usuario ACTIVO (con su useFeatures()). */
export function useSocial(): boolean | undefined {
  const amigos = useFeatures()?.amigos;
  const kind = useUser()?.kind;
  return socialOn(amigos, kind);
}
