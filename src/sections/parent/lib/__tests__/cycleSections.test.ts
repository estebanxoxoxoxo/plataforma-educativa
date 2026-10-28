import { describe, expect, it } from 'vitest';
import { SECTION_KEYS } from '../../../../shared/lib/cycleRules';
import { CYCLE_SECTIONS, sectionForPath } from '../cycleSections';

/* Ciclo del día (tanda F2): las secciones con su ruta del menú y el mapa ruta → sección del menú/portón (el mismo de los
   horarios por sección: el lector y el reproductor nunca se cierran). */

describe('CYCLE_SECTIONS', () => {
  it('las 8 del ciclo, en el orden del menú (el de las reglas compartidas con el server), con su ruta', () => {
    expect(CYCLE_SECTIONS.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    expect(CYCLE_SECTIONS.map((s) => s.label)).toEqual(['Chat', 'Buscar', 'MyTube', 'Aprender', 'Tienda', 'Calendario', 'Mi espacio', 'After Day']);
    for (const s of CYCLE_SECTIONS) expect(sectionForPath(s.route)).toBe(s.key); // la ruta del menú cae en su sección
  });
});

describe('sectionForPath (menú y portón)', () => {
  it('cada ruta del chico con su sección', () => {
    expect(sectionForPath('/chat')).toBe('chat');
    expect(sectionForPath('/buscar')).toBe('buscar');
    expect(sectionForPath('/buscar/')).toBe('buscar');
    expect(sectionForPath('/mytube')).toBe('mytube');
    expect(sectionForPath('/mytube/canal/UCx')).toBe('mytube');
    expect(sectionForPath('/mytube/lista/3')).toBe('mytube');
    expect(sectionForPath('/afterday')).toBe('afterday');
    expect(sectionForPath('/aprender')).toBe('aprender');
    expect(sectionForPath('/crear')).toBe('aprender');
    expect(sectionForPath('/tienda')).toBe('tienda');
    expect(sectionForPath('/calendario')).toBe('calendario');
    expect(sectionForPath('/espacio/carpetas')).toBe('espacio');
    expect(sectionForPath('/espacio/carpetas/12')).toBe('espacio');
    expect(sectionForPath('/espacio/papelera')).toBe('espacio');
  });
  it('lo que nunca se cierra: Feed, lector, reproductor, Ligas, Familia (también su MyTube y su Ciclo), redirecciones viejas', () => {
    for (const p of ['/', '/buscar/articulo/x', '/buscar/video/abc', '/ligas', '/familia', '/familia/mytube', '/familia/mytube/canal/UCx', '/familia/afterday', '/familia/ciclo', '/padres', '/padres/limites', '/espacio/videos', '/amigos', '/tiendas']) {
      expect(sectionForPath(p), p).toBeNull();
    }
  });
});
