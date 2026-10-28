// Ciclo del día (tanda F2, 28-oct; docs/USUARIOS.md §11): las 8 secciones que el ciclo puede gatear, con su ruta del menú,
// y de qué sección es una RUTA del chico. Puro (tests en __tests__/cycleSections.test.ts). Las claves, el orden y los nombres
// salen de las reglas compartidas (src/shared/lib/cycleRules.ts, las MISMAS del server); acá solo se suma lo del cliente:
// la ruta de cada sección y el mapa ruta → sección (venía de scheduleRules.ts, el espejo viejo de los horarios por sección).
import type { SectionKey } from '../../../api/types';
import { SECTION_KEYS, SECTION_LABEL } from '../../../shared/lib/cycleRules';

/** La ruta del menú de cada sección (la que usa el Sidebar). */
const ROUTE: Record<SectionKey, string> = {
  chat: '/chat', buscar: '/buscar', mytube: '/mytube', aprender: '/aprender',
  tienda: '/tienda', calendario: '/calendario', espacio: '/espacio/carpetas', afterday: '/afterday',
};

/** Las secciones del ciclo en el orden del menú, con su nombre y su ruta (el Feed no está: nunca se cierra). */
export const CYCLE_SECTIONS: readonly { key: SectionKey; label: string; route: string }[] =
  SECTION_KEYS.map((key) => ({ key, label: SECTION_LABEL[key], route: ROUTE[key] }));

/** La sección del ciclo a la que pertenece una RUTA del chico (null = ninguna: siempre se muestra). Mismo mapa que tenían
 *  los horarios por sección (el featureForPath del POC con las rutas de Innerith):
 *  · buscar = solo /buscar (los resultados). El lector (/buscar/articulo/:id) y el reproductor (/buscar/video/:id) NO:
 *    siguen andando con la sección cerrada (los abren el Feed, MyTube, el chat…).
 *  · aprender = /aprender y /crear (Crear vive dentro de Aprender).
 *  · espacio = /espacio, /espacio/carpetas*, /espacio/papelera (las demás /espacio/* son redirecciones viejas a MyTube). */
export function sectionForPath(path: string): SectionKey | null {
  const p = path.replace(/\/+$/, '') || '/';
  const under = (pre: string) => p === pre || p.startsWith(pre + '/');
  if (under('/chat')) return 'chat';
  if (p === '/buscar') return 'buscar';
  if (under('/mytube')) return 'mytube';
  if (under('/aprender') || under('/crear')) return 'aprender';
  if (under('/tienda')) return 'tienda';
  if (under('/calendario')) return 'calendario';
  if (p === '/espacio' || under('/espacio/carpetas') || under('/espacio/papelera')) return 'espacio';
  if (under('/afterday')) return 'afterday';
  return null;
}
