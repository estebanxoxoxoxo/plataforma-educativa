import { describe, expect, it, vi } from 'vitest';

/* Fix "fuzzy del Feed" (28-oct): la vía ESTRICTA de videos.ts (searchVideosStrict) contra la del POC (searchVideos, fuzzy
   0.2), sobre un catálogo FIXTURE chico. Se mockean config (los boosts y el tope de defaults.json), filters (una palabra
   bloqueada de juguete) y node:fs (el catálogo): importar videos.ts de verdad leería el catálogo real de server/data (que
   no está en git) y arrastraría parent.ts (que lee y migra parent.json). MiniSearch es el de verdad: los falsos positivos
   del fuzzy que se reproducen acá son los mismos que encontró el QA en el Feed. */

const FIXTURE = vi.hoisted(() => {
  const v = (videoId: string, title: string, extra: Partial<{ tags: string[]; topics: string[]; channelTitle: string; description: string }> = {}) => ({
    videoId, title, thumb: '', channelId: `ch-${videoId}`, channelTitle: 'Canal de prueba', source: 'Canal de prueba (1 videos)',
    description: '', duration: 300, addedAt: 0, tags: [] as string[], topics: [] as string[], ...extra,
  });
  return [
    v('w1', 'Ballenas jorobadas y la física', { tags: ['ballenas', 'océano'] }),
    v('w2', 'La ballena azul, el animal más grande'),
    v('e1', 'Ballenas🐋 en el mar'), // el emoji pegado: MiniSearch indexa «ballenas🐋» (solo el fuzzy lo alcanza)
    v('c1', 'Episodio 3', { channelTitle: 'Mundo Ballena' }), // coincide por el CANAL
    v('t1', 'Gigantes del mar', { topics: ['ballenas'] }), // coincide por los TOPICS
    v('g1', 'GALLINAS PONEDORAS de HUEVO (5 Mejores de todo el MUNDO)', { tags: ['gallinas', 'granja'] }),
    v('g2', 'Las CURIOSAS y LLAMATIVAS GALLINAS PELUDAS'),
    v('d1', 'Documental del océano', { description: 'En este video aparecen ballenas y delfines.' }), // solo en la descripción
    v('b1', 'Ballenas prohibido'), // palabra bloqueada (mock de filters)
    v('f1', 'LAS PLAYAS DE FIJI NO SON COMO IMAGINAS', { channelTitle: 'Dana Lucia' }),
    v('f2', 'Fiji 4K - Scenic Relaxation Film With Calming Music'),
    v('v1', 'Volcanes de Argentina'),
    v('r1', 'Robots que bailan'),
  ];
});

vi.mock('node:fs', () => ({ readFileSync: () => JSON.stringify(FIXTURE) }));
vi.mock('../config', () => {
  const nums: Record<string, number> = { 'const.videoScoreTitle': 3, 'const.videoScoreSource': 2, 'const.videoScoreDesc': 1, 'const.videoMostrados': 24 };
  return { SERVER_ROOT: '/fixture', ov: { num: (k: string) => nums[k] ?? 0 } };
});
vi.mock('../filters', () => ({ matchBlockedWord: (text: string) => (/prohibido/i.test(text) ? 'prohibido' : null) }));

const { searchVideos, searchVideosStrict, strictVideoMatch, wordForms } = await import('../videos');
const ids = (vs: { videoId: string }[]) => vs.map(v => v.videoId);
const byId = (id: string) => FIXTURE.find(v => v.videoId === id)!;

describe('wordForms (plural simple, sin raíces)', () => {
  it('singular ↔ plural con -s y -es', () => {
    expect(wordForms('ballenas')).toContain('ballena');
    expect(wordForms('ballena')).toContain('ballenas');
    expect(wordForms('volcan')).toContain('volcanes');
    expect(wordForms('volcanes')).toContain('volcan');
    expect(wordForms('robot')).toContain('robots');
  });
  it('no deja raíces de menos de 3 letras ni inventa parecidos', () => {
    expect(wordForms('tres')).not.toContain('tr');
    expect(wordForms('ballenas')).not.toContain('gallinas');
    expect(wordForms('niji')).not.toContain('fiji');
  });
});

describe('la vía del POC (searchVideos, fuzzy 0.2) NO cambia', () => {
  it('sigue trayendo los parecidos: ballenas → gallinas, niji → Fiji (es el buscador de Buscar, fiel al POC)', () => {
    expect(ids(searchVideos('ballenas'))).toEqual(expect.arrayContaining(['w1', 'g1', 'g2']));
    expect(ids(searchVideos('niji'))).toEqual(expect.arrayContaining(['f1', 'f2']));
  });
});

describe('searchVideosStrict (la vía del Feed)', () => {
  it('ballenas NO matchea gallinas (ni lo que solo lo dice en la descripción, ni lo bloqueado)', () => {
    const got = ids(searchVideosStrict('ballenas'));
    expect(got).toEqual(expect.arrayContaining(['w1', 'w2', 'e1', 'c1', 't1']));
    for (const no of ['g1', 'g2', 'd1', 'b1']) expect(got).not.toContain(no);
  });
  it('niji NO matchea Fiji: sin coincidencia real no hay nada (found:0 honesto)', () => {
    expect(searchVideosStrict('niji')).toEqual([]);
  });
  it('plural simple SÍ: ballena ↔ ballenas, y volcán → volcanes aunque el fuzzy no llegue', () => {
    expect(ids(searchVideosStrict('ballena'))).toEqual(expect.arrayContaining(['w1', 'w2']));
    expect(ids(searchVideosStrict('volcán'))).toEqual(['v1']);
    expect(ids(searchVideos('volcán'))).not.toContain('v1'); // 6 letras → fuzzy de 1; "volcanes" está a 2
    expect(ids(searchVideosStrict('robot'))).toEqual(['r1']);
  });
  it('AND sobre todas las palabras de contenido; las muletillas no cuentan', () => {
    expect(ids(searchVideosStrict('ballenas jorobadas'))).toEqual(['w1']);
    expect(ids(searchVideosStrict('videos de ballenas'))).toEqual(ids(searchVideosStrict('ballenas')));
    expect(searchVideosStrict('videos de')).toEqual([]);
  });
  it('lo que sobrevive del fuzzy sale en el MISMO orden que en Buscar, y respeta el límite', () => {
    const strict = ids(searchVideosStrict('ballenas'));
    const pocOrder = ids(searchVideos('ballenas', 100)).filter(id => strictVideoMatch(byId(id), 'ballenas'));
    expect(strict.slice(0, pocOrder.length)).toEqual(pocOrder);
    expect(searchVideosStrict('ballenas', 2)).toHaveLength(2);
  });
});

describe('strictVideoMatch', () => {
  it('mira título, tags, topics y canal; no la descripción', () => {
    expect(strictVideoMatch(byId('w1'), 'ballenas')).toBe(true); // título y tags
    expect(strictVideoMatch(byId('c1'), 'ballenas')).toBe(true); // canal
    expect(strictVideoMatch(byId('t1'), 'ballenas')).toBe(true); // topics
    expect(strictVideoMatch(byId('d1'), 'ballenas')).toBe(false); // solo descripción
    expect(strictVideoMatch(byId('g1'), 'ballenas')).toBe(false);
    expect(strictVideoMatch(byId('f1'), 'niji')).toBe(false);
  });
  it('sin palabras de contenido no hay coincidencia', () => {
    expect(strictVideoMatch(byId('w1'), 'videos de')).toBe(false);
  });
});
