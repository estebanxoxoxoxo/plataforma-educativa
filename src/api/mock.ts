// Datos de prueba. Todo lo que aparece en el prototipo está acá tal cual;
// lo que el prototipo no mostraba (otros temas, más ejercicios) es relleno coherente.
import type {
  Article, Course, CourseDetail, Exercise, Friend, FriendMessage, ImageResult, JourneyItem,
  LeagueResult, MyLeague, NodeType, PageResult, RelatedChip, ResourceKind, User, VideoResult,
} from './types';

export const ME: User = { name: 'Sofi', age: 9, nick: 'SofiExplora' };

/* ---------------- búsqueda ---------------- */
export type Topic = 'dinosaurios' | 'volcanes' | 'planetas';
export const topicOf = (q: string): Topic | null => {
  const s = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/dino|fosil|tiranos|paleont/.test(s)) return 'dinosaurios';
  if (/volc|lava|crater|erupc/.test(s)) return 'volcanes';
  if (/planet|espacio|sistema solar|astron|luna|sol\b|cohete/.test(s)) return 'planetas';
  return null;
};

const ISRC: [string, string][] = [['Enciclopedia Infantil', '#5F6368'], ['Museo de Ciencias', '#3A5BD9'], ['Revista Explora', '#F26B3A'], ['Ciencia para chicos', '#13A39A'], ['Geografía Joven', '#8A5CF5'], ['Parques Nacionales', '#18A957']];
const VMETA: [string, string][] = [['Ciencia para chicos', '24 sept 2024'], ['Explora TV', '17 sept 2024'], ['Aula Espacial', '18 nov 2025'], ['Planeta Kids', '2 mar 2025'], ['Ciencia para chicos', '8 ene 2025'], ['Astro Junior', '30 jul 2024'], ['Explora TV', '12 may 2025'], ['Canciones del Aula', '5 oct 2024']];

export const PAGES: Record<Topic, PageResult[]> = {
  dinosaurios: [
    { id: 'pg-d1', site: 'Enciclopedia Infantil', url: 'https://enciclopedia-infantil.org › wiki › Dinosauria', title: 'Dinosauria - Enciclopedia Infantil', snippet: 'Los <b>dinosaurios</b> son un grupo de reptiles que aparecieron en el período Triásico y dominaron la Tierra durante más de 160 millones de años ...', color: '#5F6368', articleId: 'dinosauria' },
    { id: 'pg-d2', site: 'Museo de Ciencias Naturales', url: 'https://museociencias.org › colecciones › t-rex', title: 'El Tiranosaurio rex, explicado para chicos', date: '14 jun 2024', snippet: 'Cuánto medía, qué comía y por qué tenía los brazos tan cortos. Conocé al <b>dinosaurio</b> carnívoro más famoso de la colección.', color: '#3A5BD9', articleId: 'tiranosaurio' },
    { id: 'pg-d3', site: 'Revista Explora', url: 'https://revistaexplora.com › paleontologia', title: '¿Cómo trabajan los paleontólogos? Herramientas y pasos', date: '3 feb 2025', snippet: 'Las herramientas y los pasos para encontrar, limpiar y estudiar un fósil de <b>dinosaurio</b>, contados por una paleontóloga.', color: '#F26B3A', articleId: 'paleontologos' },
    { id: 'pg-d4', site: 'Parques de la Patagonia', url: 'https://parquespatagonia.org.ar › huellas', title: 'Huellas de dinosaurios en la Patagonia argentina', snippet: 'Lugares de Neuquén y Río Negro donde todavía se ven pisadas de <b>dinosaurios</b> de hace 100 millones de años.', color: '#13A39A', articleId: 'huellas-patagonia' },
    { id: 'pg-d5', site: 'Juegos Educativos', url: 'https://juegoseducativos.net › fosiles', title: 'Juego: armá tu propio fósil de dinosaurio', date: '20 ago 2025', snippet: 'Uní los huesos en el orden correcto y descubrí qué <b>dinosaurio</b> es. Para chicos de 6 a 12 años.', color: '#8A5CF5', articleId: 'juego-fosil' },
  ],
  volcanes: [
    { id: 'pg-v1', site: 'Enciclopedia Infantil', url: 'https://enciclopedia-infantil.org › wiki › Volcán', title: 'Volcán - Enciclopedia Infantil', snippet: 'Un <b>volcán</b> es una abertura en la corteza terrestre por donde sale magma, gases y ceniza del interior de la Tierra ...', color: '#5F6368', articleId: 'volcan' },
    { id: 'pg-v2', site: 'Geografía Joven', url: 'https://geografiajoven.org › argentina › lanin', title: 'Los volcanes de Argentina: del Lanín al Copahue', date: '9 abr 2025', snippet: 'Un recorrido por los <b>volcanes</b> más conocidos de la cordillera y cuáles siguen activos.', color: '#8A5CF5', articleId: 'volcanes-argentina' },
    { id: 'pg-v3', site: 'Revista Explora', url: 'https://revistaexplora.com › experimentos', title: 'Experimento: hacé tu propio volcán casero', date: '11 nov 2024', snippet: 'Con bicarbonato, vinagre y un poco de colorante podés armar una erupción en la mesa de tu casa.', color: '#F26B3A', articleId: 'volcan-casero' },
    { id: 'pg-v4', site: 'Ciencia para chicos', url: 'https://cienciaparachicos.org › tierra › lava', title: '¿Qué es la lava y cómo se convierte en roca?', snippet: 'La lava es roca derretida. Cuando se enfría se vuelve basalto, piedra pómez y otras rocas <b>volcánicas</b>.', color: '#13A39A', articleId: 'lava' },
  ],
  planetas: [
    { id: 'pg-p1', site: 'Enciclopedia Infantil', url: 'https://enciclopedia-infantil.org › wiki › Planeta', title: 'Planeta - Enciclopedia Infantil', snippet: 'Un <b>planeta</b> es un cuerpo celeste que gira alrededor de una estrella. En el sistema solar hay ocho ...', color: '#5F6368', articleId: 'planeta' },
    { id: 'pg-p2', site: 'Aula Espacial', url: 'https://aulaespacial.org › sistema-solar', title: 'Los 8 planetas del sistema solar, uno por uno', date: '18 nov 2025', snippet: 'De Mercurio a Neptuno: tamaño, temperatura y datos curiosos de cada <b>planeta</b>.', color: '#3A5BD9', articleId: 'ocho-planetas' },
    { id: 'pg-p3', site: 'Museo de Ciencias Naturales', url: 'https://museociencias.org › espacio › marte', title: 'Marte, el planeta rojo, explicado para chicos', date: '2 mar 2025', snippet: 'Por qué es rojo, qué robots lo exploran y si alguna vez podremos vivir en ese <b>planeta</b>.', color: '#F26B3A', articleId: 'marte' },
  ],
};

const IMG_DATA: Record<Topic, [string, string][]> = {
  dinosaurios: [['d_ammonite', 'Fósil de amonite'], ['d_footprint', 'Huella de terópodo'], ['d_fern', 'Helecho prehistórico'], ['d_bone', 'Hueso fosilizado'], ['d_egg', 'Huevo de dinosaurio'], ['d_tracks', 'Huellas en la roca'], ['d_ammonite2', 'Amonite pulido'], ['d_leaves', 'Hojas fósiles'], ['d_skeleton', 'Esqueleto en el museo'], ['d_nest', 'Nido de huevos'], ['d_sauropod', 'Pisada gigante'], ['d_trex', 'Cráneo de tiranosaurio']],
  volcanes: [['v_eruption', 'Volcán en erupción'], ['v_crater', 'Cráter desde arriba'], ['v_basalt', 'Roca volcánica'], ['v_island', 'Isla volcánica'], ['v_lanin', 'Volcán Lanín nevado'], ['v_pumice', 'Piedra pómez'], ['v_craterlake', 'Laguna en un cráter'], ['v_dormant', 'Monte Fuji, volcán dormido'], ['v_surtsey', 'Isla nueva en el mar'], ['v_pahoehoe', 'Lava ya fría'], ['v_ash', 'Ceniza en el cielo'], ['v_aerial', 'Volcán visto desde un avión']],
  planetas: [['p_planets', 'Los planetas en fila'], ['p_saturn', 'Los anillos de Saturno'], ['p_mars', 'Marte, el planeta rojo'], ['p_jupiter', 'Nubes de Júpiter'], ['p_moon', 'La Luna llena'], ['p_sun', 'El Sol de cerca'], ['p_rocket', 'Cohete despegando'], ['p_iss', 'Vista desde la estación espacial']],
};
// mismo cálculo que el prototipo: ISRC[(caption.length + i) % 6]
export const IMAGES: Record<Topic, ImageResult[]> = Object.fromEntries(
  Object.entries(IMG_DATA).map(([t, arr]) => [t, arr.map(([img, caption], i) => {
    const s = ISRC[(caption.length + i) % ISRC.length];
    return { id: `im-${img}`, img, caption, source: { name: s[0], color: s[1] } };
  })]),
) as Record<Topic, ImageResult[]>;

export const RELATED: Record<Topic, RelatedChip[]> = {
  dinosaurios: ['Tiranosaurio', 'Fósiles', 'Huellas', 'Huevos', 'Esqueletos', 'Para dibujar'].map((label, i) => ({ label, img: IMG_DATA.dinosaurios[(i * 2 + 1) % 12][0] })),
  volcanes: ['Erupción', 'Lava', 'Cráter', 'Maqueta', 'Lanín', 'Islas'].map((label, i) => ({ label, img: IMG_DATA.volcanes[(i * 2 + 1) % 12][0] })),
  planetas: ['Saturno', 'Marte', 'Luna', 'Cohetes', 'Júpiter', 'El Sol'].map((label, i) => ({ label, img: IMG_DATA.planetas[(i * 2 + 1) % 8][0] })),
};

const VID_DATA: Record<Topic, [string, string, string, string][]> = {
  planetas: [['p_planets', 'Los 8 planetas en orden', 'Viaje por el sistema solar', '5:20'], ['p_rocket', 'Cómo despega un cohete', 'Explicado para chicos', '3:45'], ['p_moon', '¿Por qué cambia la Luna?', 'Las fases lunares', '4:10'], ['p_saturn', 'Saturno y sus anillos', 'De qué están hechos', '3:05'], ['p_sun', '¿Qué es una estrella?', 'El Sol y sus vecinas', '4:30'], ['p_iss', 'Un día en la estación espacial', 'Así viven los astronautas', '6:15'], ['p_mars', 'Marte, el planeta rojo', 'Robots que lo exploran', '5:02'], ['p_jupiter', 'Canción de los planetas', 'Para aprender cantando', '2:40']],
  volcanes: [['vv_kilauea', '¿Cómo nace un volcán?', 'Explicado con dibujos', '4:20'], ['vv_inside', 'Adentro de un cráter', 'Un viaje con drones', '5:10'], ['vv_flow', 'De lava a roca', 'Cómo se enfría la lava', '3:35'], ['vv_submarine', 'Islas que salen del mar', 'Volcanes submarinos', '4:45'], ['vv_copahue', 'Volcanes de Argentina', 'Del Lanín al Copahue', '6:00'], ['vv_model', 'Experimento: volcán casero', 'Para hacer en casa', '3:15'], ['vv_scientist', 'Vulcanólogos en acción', 'Así se estudian', '5:30'], ['vv_stromboli', 'Canción de los volcanes', 'Para cantar en clase', '2:30']],
  dinosaurios: [['d_trex', 'Así era el Tiranosaurio rex', 'El carnívoro más famoso', '4:50'], ['d_skeleton', 'Cómo se arma un esqueleto', 'Detrás de escena en el museo', '5:15'], ['d_footprint', 'Huellas que cuentan historias', 'Pisadas de hace millones de años', '3:40'], ['d_egg', '¿Cómo nacían los dinosaurios?', 'Huevos y nidos', '4:05'], ['chat_asteroid', 'El día que cayó el asteroide', 'La extinción explicada', '3:40'], ['d_fern', '¿Qué comían los herbívoros?', 'Plantas del Jurásico', '3:55']],
};
const toSec = (d: string) => { const [m, s] = d.split(':').map(Number); return m * 60 + s; };
export const VIDEOS: Record<Topic, VideoResult[]> = Object.fromEntries(
  Object.entries(VID_DATA).map(([t, arr]) => [t, arr.map(([img, title, subtitle, duration], i) => ({
    id: `vd-${img}`, img, title, subtitle, duration, channel: VMETA[i % 8][0], date: VMETA[i % 8][1],
  }))]),
) as Record<Topic, VideoResult[]>;
export const videoSeconds = toSec;

/** Datos de canal para el reproductor (formato YouTube). */
export const CHANNELS: Record<string, { subscribers: string; verified: boolean }> = {
  'Ciencia para chicos': { subscribers: '1,2 M de suscriptores', verified: true },
  'Explora TV': { subscribers: '845 k de suscriptores', verified: true },
  'Aula Espacial': { subscribers: '312 k de suscriptores', verified: false },
  'Planeta Kids': { subscribers: '2,4 M de suscriptores', verified: true },
  'Astro Junior': { subscribers: '98,5 k de suscriptores', verified: false },
  'Canciones del Aula': { subscribers: '3,1 M de suscriptores', verified: true },
};
export const likesFor = (id: string) => { const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0); return `${(n % 90) + 5} k`; };

/** Posiciones donde la moderación "encuentra" contenido no apto (igual que el prototipo). */
export const BLOCKED_AT = { images: [2, 5, 7, 11, 13, 16], videos: [3, 8] };

/* ---------------- artículos ---------------- */
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Convierte cada <span class="a">X</span> en un link interno moderable. */
const linkify = (html: string) => html.replace(/<span class="a">([^<]+)<\/span>/g, (_, t) => `<span class="a" data-article="${slug(t)}">${t}</span>`);

const DINO_BODY = `<p>Los <b>dinosaurios</b> (<b>Dinosauria</b>, del griego «lagartos terribles») son un grupo de <span class="a">reptiles</span> que aparecieron durante el período <span class="a">Triásico</span>, hace unos 233 millones de años.<sup>[1]</sup> Durante más de 160 millones de años fueron los <span class="a">vertebrados</span> terrestres dominantes.</p>
<p>Había dinosaurios de todos los tamaños: algunos eran tan chicos como una gallina y otros, como el <span class="a">Argentinosaurus</span>, medían más de 30 metros de largo.<sup>[2]</sup> La mayoría se <span class="a">extinguió</span> hace 66 millones de años, pero las <span class="a">aves</span> son sus descendientes directos.<sup>[3]</sup></p>
<div class="wk-toc"><b>Contenido</b><ol><li>Características</li><li>Alimentación</li><li>Fósiles en Argentina</li><li>Extinción</li></ol></div>
<h2>Características</h2>
<p>Los dinosaurios caminaban con las patas ubicadas debajo del cuerpo, y no a los costados como los <span class="a">lagartos</span>. Eso les permitía moverse más rápido y sostener cuerpos muy grandes.<sup>[4]</sup></p>
<h2>Alimentación</h2>
<p>Algunos eran <span class="a">herbívoros</span>, como el <span class="a">diplodocus</span>, que usaba su cuello larguísimo para alcanzar las hojas de los árboles. Otros, como el <span class="a">tiranosaurio</span>, eran <span class="a">carnívoros</span>.</p>
<h2>Fósiles en Argentina</h2>
<div class="wk-thumb"><img src="/img/d_footprint.jpg" alt=""><div>Huella de un dinosaurio terópodo conservada en arenisca.</div></div>
<p>Sabemos cómo eran gracias a los <span class="a">fósiles</span>: huesos, huellas y huevos que quedaron guardados en la roca. En la <span class="a">Patagonia argentina</span> se encontraron algunos de los dinosaurios más grandes del mundo, como el <span class="a">Argentinosaurus</span>.<sup>[5]</sup></p>`;

const ARGENTO_BODY = `<p><b><i>Argentinosaurus</i></b> es un género de <span class="a">dinosaurios saurópodos</span> que vivió hace unos 95 millones de años en lo que hoy es la provincia de <span class="a">Neuquén</span>, Argentina.<sup>[1]</sup> Es uno de los animales terrestres más grandes que existieron: podía medir más de 30 metros de largo y pesar tanto como diez elefantes.<sup>[2]</sup></p>
<p>Sus fósiles se exhiben en el <span class="a">Museo Carmen Funes</span> de <span class="a">Plaza Huincul</span>. Su nombre significa «lagarto argentino».<sup>[3]</sup></p>
<div class="wk-toc"><b>Contenido</b><ol><li>Descubrimiento</li><li>Tamaño</li><li>En la cultura popular</li></ol></div>
<h2>Descubrimiento</h2>
<p>En 1987, un productor rural encontró un hueso enorme en su campo, cerca de Plaza Huincul. Al principio pensó que era un tronco petrificado.<sup>[4]</sup></p>
<h2>En la cultura popular</h2>
<p>Aparece en documentales sobre dinosaurios y en la película <span class="a">Titanes del Cretácico</span>, apta para mayores de 16 años.<sup>[5]</sup></p>`;

export const ARTICLES: Record<string, Article> = {
  dinosauria: {
    id: 'dinosauria', topic: 'Dinosaurios', title: 'Dinosauria', hatnote: '«Dinosaurio» redirige aquí.',
    infobox: {
      title: 'Dinosaurios', img: 'a_hero',
      range: '<span class="a">Rango temporal</span>: 233 – 66 Ma<br><span class="a">Triásico Superior</span> – <span class="a">Reciente</span>',
      caption: 'Esqueleto de <i>Argentinosaurus</i>, uno de los dinosaurios más grandes, hallado en Neuquén.',
      taxonomy: [['Dominio:', 'Eukaryota'], ['Reino:', 'Animalia', 'a'], ['Filo:', 'Chordata', 'a'], ['Clase:', 'Sauropsida', 'a'], ['Superorden:', 'Dinosauria', 'b']],
    },
    html: linkify(DINO_BODY),
  },
  argentinosaurus: {
    id: 'argentinosaurus', topic: 'Dinosaurios', title: 'Argentinosaurus',
    infobox: {
      title: 'Argentinosaurus', img: 'a_hero',
      range: '<span class="a">Rango temporal</span>: 97 – 93 Ma<br><span class="a">Cretácico Superior</span>',
      caption: 'Reconstrucción del esqueleto de <i>Argentinosaurus huinculensis</i> en un museo.',
      taxonomy: [['Reino:', 'Animalia', 'a'], ['Clase:', 'Sauropsida', 'a'], ['Superorden:', 'Dinosauria', 'a'], ['Suborden:', 'Sauropodomorpha', 'a'], ['Género:', 'Argentinosaurus', 'b']],
    },
    html: linkify(ARGENTO_BODY),
  },
};
/** Links que la moderación rechaza. */
export const BLOCKED_ARTICLES = new Set(['titanes-del-cretacico']);

const TOPIC_HERO: Record<Topic, string> = { dinosaurios: 'a_hero', volcanes: 'v_eruption', planetas: 'p_planets' };
const TOPIC_NAME: Record<Topic, string> = { dinosaurios: 'Dinosaurios', volcanes: 'Volcanes', planetas: 'Planetas' };

/** Artículo de relleno para cualquier link/resultado sin artículo propio. */
export function stubArticle(id: string): Article {
  const page = Object.values(PAGES).flat().find((p) => p.articleId === id);
  const title = page ? page.title.replace(/ - Enciclopedia Infantil$/, '') : id.split('-').map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
  const topic = topicOf(page ? page.title + page.snippet : id) ?? 'dinosaurios';
  return {
    id, topic: TOPIC_NAME[topic], title,
    infobox: { title, img: TOPIC_HERO[topic], range: `Tema: <span class="a">${TOPIC_NAME[topic]}</span>`, caption: 'Imagen de referencia.', taxonomy: [] },
    html: linkify(`<p>${page ? page.snippet : `<b>${title}</b> es un artículo de ejemplo.`}</p><p>Este contenido es de prueba: cuando el backend esté conectado, acá va el artículo completo ya moderado. Mientras tanto podés volver a <span class="a">Dinosauria</span>.</p>`),
  };
}

/* ---------------- cursos ---------------- */
export const COURSES: Course[] = [
  { id: 'solar', name: 'El sistema solar', units: 6, progress: 33, img: 'c_solar', bg: ['#3A5BD9', '#1E2F7A'] },
  { id: 'frac', name: 'Fracciones', units: 7, progress: 15, img: 'c_fractions', bg: ['#F26B3A', '#B8431C'] },
  { id: 'ocean', name: 'Animales del océano', units: 6, progress: 50, img: 'c_ocean', bg: ['#1C9BD6', '#0E5F8A'] },
  { id: 'body', name: 'Mi cuerpo', units: 5, progress: 0, img: 'c_body', bg: ['#E5487A', '#9E2350'] },
  { id: 'eng', name: 'Inglés inicial', units: 8, progress: 85, img: 'c_english', bg: ['#8A5CF5', '#5431B3'] },
];
export const GEN_COURSE: Record<string, Pick<Course, 'img' | 'bg'>> = {
  Dinosaurios: { img: 'c_dino', bg: ['#13A39A', '#0B6B66'] },
  Volcanes: { img: 'v_eruption', bg: ['#F26B3A', '#B8431C'] },
  Planetas: { img: 'p_planets', bg: ['#3A5BD9', '#1E2F7A'] },
};

type R = [ResourceKind, string];
const ch = (title: string, ...resources: R[]) => ({ title, resources: resources.map(([kind, label]) => ({ kind, label })) });
export const SOLAR_UNITS: CourseDetail['unitList'] = [
  { title: 'El Sol', chapters: [ch('¿Qué es una estrella?', ['video', 'Video 4 min'], ['lect', 'Lectura'], ['imgr', 'Imágenes']), ch('La luz y el calor', ['video', 'Video 3 min'], ['lect', 'Lectura'], ['act', 'Actividad']), ch('El Sol y las estaciones', ['lect', 'Lectura'], ['imgr', 'Imágenes'])] },
  { title: 'Los planetas', chapters: [ch('Planetas rocosos', ['video', 'Video 5 min'], ['lect', 'Lectura']), ch('Gigantes gaseosos', ['video', 'Video 4 min'], ['imgr', 'Imágenes']), ch('¿Por qué Plutón ya no es planeta?', ['lect', 'Lectura'], ['act', 'Actividad'])] },
  { title: 'La Luna', chapters: [ch('Las fases de la Luna', ['video', 'Video 4 min'], ['imgr', 'Imágenes']), ch('Las mareas', ['lect', 'Lectura']), ch('Viajes a la Luna', ['video', 'Video 6 min'], ['act', 'Actividad'])] },
  { title: 'Estrellas y constelaciones', chapters: [ch('¿Por qué brillan?', ['lect', 'Lectura']), ch('Constelaciones famosas', ['imgr', 'Imágenes'], ['act', 'Actividad']), ch('La Vía Láctea', ['video', 'Video 3 min'])] },
  { title: 'Cometas y asteroides', chapters: [ch('¿Qué es un cometa?', ['video', 'Video 3 min'], ['lect', 'Lectura']), ch('El cinturón de asteroides', ['imgr', 'Imágenes']), ch('Estrellas fugaces', ['lect', 'Lectura'], ['act', 'Actividad'])] },
  { title: 'Explorar el espacio', chapters: [ch('Cohetes y satélites', ['video', 'Video 5 min']), ch('La estación espacial', ['video', 'Video 6 min'], ['imgr', 'Imágenes']), ch('Robots en Marte', ['lect', 'Lectura'], ['act', 'Actividad'])] },
];
export function genericUnits(name: string, n: number): CourseDetail['unitList'] {
  return Array.from({ length: n }, (_, i) => ({
    title: `${name}: parte ${i + 1}`,
    chapters: [ch('Introducción', ['video', 'Video 4 min'], ['lect', 'Lectura']), ch('Conceptos clave', ['lect', 'Lectura'], ['imgr', 'Imágenes']), ch('A practicar', ['act', 'Actividad'])],
  }));
}

/* ---------------- journey + ejercicios ---------------- */
// mismo orden que ITEMS del prototipo
export const JOURNEY_ITEMS = (sec1: string, sec2: string): JourneyItem[] => {
  const seq: (NodeType | { div: string })[] = [{ div: sec1 }, 'vf', 'mc', 'open', 'mc', 'vf', 'open', 'mc', 'vf', 'trophy', { div: sec2 }, 'vf', 'open', 'mc', 'vf'];
  let n = 0;
  return seq.map((s): JourneyItem => (typeof s === 'string' ? { kind: 'node', n: n++, type: s } : { kind: 'div', title: s.div }));
};

export const SOLAR_EXERCISES: Exercise[] = [
  { n: 0, type: 'vf', progress: 10, seconds: 20, statement: 'El Sol es una estrella.' },
  { n: 1, type: 'mc', progress: 20, seconds: 30, question: '¿Qué nos da el Sol?', hint: 'Puede haber varias correctas, una sola o ninguna. Marcá todas las correctas.', options: ['Luz', 'Lluvia', 'Calor', 'Nieve'] },
  { n: 2, type: 'open', progress: 30, seconds: 60, question: '¿Por qué el Sol es tan importante para la vida en la Tierra?', placeholder: 'Escribí tu respuesta con tus palabras…' },
  { n: 3, type: 'mc', progress: 55, seconds: 30, question: '¿Cuáles de estos planetas son rocosos?', hint: 'Puede haber varias correctas, una sola o ninguna. Marcá todas las correctas.', options: ['Mercurio', 'Júpiter', 'Marte', 'Saturno'] },
  { n: 4, type: 'vf', progress: 80, seconds: 20, statement: 'El Sol es el planeta más grande del sistema solar.' },
  { n: 5, type: 'open', progress: 85, seconds: 60, question: '¿Qué pasaría si un día el Sol se apagara?', placeholder: 'Escribí tu respuesta con tus palabras…' },
  { n: 6, type: 'mc', progress: 90, seconds: 30, question: '¿Cuáles de estos son estrellas?', hint: 'Puede haber varias correctas, una sola o ninguna. Marcá todas las correctas.', options: ['La Luna', 'Marte', 'Júpiter', 'Venus'] },
  { n: 7, type: 'vf', progress: 95, seconds: 20, statement: 'La luz del Sol tarda unos 8 minutos en llegar a la Tierra.' },
  { n: 9, type: 'vf', progress: 25, seconds: 20, statement: 'Júpiter es el planeta más grande del sistema solar.' },
  { n: 10, type: 'open', progress: 50, seconds: 60, question: '¿En qué se diferencian los planetas rocosos de los gaseosos?', placeholder: 'Escribí tu respuesta con tus palabras…' },
  { n: 11, type: 'mc', progress: 75, seconds: 30, question: '¿Cuál de estos planetas tiene anillos muy famosos?', hint: 'Puede haber varias correctas, una sola o ninguna. Marcá todas las correctas.', options: ['Saturno', 'Marte', 'Mercurio', 'Venus'] },
  { n: 12, type: 'vf', progress: 100, seconds: 20, statement: 'Plutón es el noveno planeta del sistema solar.' },
];
/** Claves de corrección (viven "en el servidor"). */
export const KEYS: Record<number, { mc?: string[]; vf?: boolean; open?: RegExp; okText: string; badText: string }> = {
  0: { vf: true, okText: 'El Sol es la estrella más cercana a la Tierra.', badText: 'El Sol sí es una estrella: la más cercana a nosotros.' },
  1: { mc: ['Luz', 'Calor'], okText: 'Marcaste exactamente las correctas: Luz y Calor.', badText: 'Las correctas eran Luz y Calor.' },
  2: { open: /luz|calor|energ|plantas|vida|frio|oscur/, okText: 'Explicaste bien que el Sol nos da luz y calor, y que sin él no habría vida.', badText: 'Pensá qué cosas nos da el Sol todos los días: ¿qué pasaría sin luz ni calor?' },
  3: { mc: ['Mercurio', 'Marte'], okText: 'Marcaste exactamente las correctas: Mercurio y Marte.', badText: 'Los rocosos de esta lista son Mercurio y Marte.' },
  4: { vf: false, okText: 'El Sol no es un planeta: es una estrella.', badText: 'El Sol no es un planeta: es una estrella.' },
  5: { open: /oscur|frio|helad|plantas|vida|morir/, okText: 'Muy bien: sin el Sol todo quedaría oscuro y muy frío, y las plantas no podrían crecer.', badText: 'Pensá en la luz y el calor: ¿qué pasaría con las plantas y los animales?' },
  6: { mc: [], okText: 'Ninguna es una estrella: la Luna es un satélite y los demás son planetas.', badText: 'Ninguna es estrella: la Luna es un satélite y los demás son planetas.' },
  7: { vf: true, okText: 'La luz viaja muy rápido, pero igual tarda unos 8 minutos.', badText: 'Es verdadero: la luz del Sol tarda unos 8 minutos en llegar.' },
  9: { vf: true, okText: 'Júpiter es tan grande que entrarían más de mil Tierras.', badText: 'Es verdadero: Júpiter es el más grande.' },
  10: { open: /roca|solid|gas|duro|superficie/, okText: 'Bien: los rocosos tienen superficie sólida y los gaseosos son de gas.', badText: 'Pensá de qué están hechos: ¿se podría pisar un planeta gaseoso?' },
  11: { mc: ['Saturno'], okText: 'Saturno es famoso por sus anillos de hielo y roca.', badText: 'El de los anillos famosos es Saturno.' },
  12: { vf: false, okText: 'Desde 2006 se lo considera un planeta enano.', badText: 'Es falso: desde 2006 Plutón es un planeta enano.' },
};

/* ---------------- amigos ---------------- */
export const FRIENDS: Friend[] = [
  { id: 'f1', nick: 'TomiCohete', color: '#3A5BD9', status: 'Practicando: El sistema solar', xp: '3.120', streak: '12 días', league: 'Liga Cometa', since: 'marzo', commonCourses: ['El sistema solar', 'Dinosaurios'] },
  { id: 'f2', nick: 'LuliVolcan', color: '#F26B3A', status: 'Racha de 8 días', xp: '2.870', streak: '8 días', league: 'Liga Cometa', since: 'abril', commonCourses: ['Animales del océano'] },
  { id: 'f3', nick: 'MateoDino', color: '#13A39A', status: 'Terminó la unidad 2 de Dinosaurios', xp: '4.010', streak: '21 días', league: 'Liga Estrella', since: 'marzo', commonCourses: ['Dinosaurios', 'Fracciones'] },
  { id: 'f4', nick: 'CataEstrella', color: '#E5487A', status: 'Practicando: Inglés inicial', xp: '1.940', streak: '3 días', league: 'Liga Cometa', since: 'mayo', commonCourses: ['Inglés inicial'] },
  { id: 'f5', nick: 'JuanchiRayo', color: '#F2A81D', status: 'Racha de 2 días', xp: '1.380', streak: '2 días', league: 'Liga Chispa', since: 'junio', commonCourses: ['Fracciones'] },
  { id: 'f6', nick: 'MartuLuna', color: '#8A5CF5', status: 'Practicando: Mi cuerpo', xp: '2.210', streak: '5 días', league: 'Liga Cometa', since: 'marzo', commonCourses: ['Mi cuerpo', 'El sistema solar'] },
];
export const THREADS: Record<string, FriendMessage[]> = {
  f3: [{ id: 'm1', from: 'them', text: '¡Hola! ¿Viste el curso nuevo de dinosaurios?' }, { id: 'm2', from: 'them', text: 'Yo ya terminé la primera unidad.' }],
  f1: [{ id: 'm1', from: 'them', text: '¿Cuántos planetas te faltan en el curso?' }],
  f2: [{ id: 'm1', from: 'them', text: '¡Llegué a 8 días de racha!' }],
};
export const REPLIES = ['¡Dale! Te espero en Practicar.', '¡Buenísimo!', 'Jaja, ¡sí!', '¿Hacemos una carrera de XP?'];

/* ---------------- ligas ---------------- */
export const NICKS = ['NachoNova', 'EmiFósil', 'ValenOrbita', 'GuadaGalaxia', 'FeliTrex', 'AguMeteoro', 'PiliCometa', 'BautiLava', 'JoaquiSaturno', 'ZoeVolcan', 'FrancoPlaneta', 'MiliEclipse', 'LautiCrater', 'RenataLuna', 'SantiAsteroide', 'OliviaNebula'];
export const COLS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957'];
export const GEO = { zona: { off: 0, top: 4980, me: 37, xp: 1240 }, prov: { off: 3, top: 7420, me: 324, xp: 1240 }, pais: { off: 6, top: 12650, me: 4812, xp: 1240 } };
export const ASSIGNED: MyLeague = { id: 'lg-cometa', name: 'Liga Cometa', desc: '30 chicos con un avance parecido al tuyo', color: '#F2A81D', tag: 'assigned', pos: 7, total: 30 };
/** XP del primer puesto por liga (para fakear el ranking completo). */
export const LEAGUE_TOP_XP: Record<string, number> = { 'lg-cometa': 1820 };
export const ALL_LEAGUES: (Omit<LeagueResult, 'joined'> & { size: number })[] = [
  { id: 'lg-dino', name: 'Exploradores de dinosaurios', desc: '128 chicos · Dinosaurios', color: '#13A39A', size: 128 },
  { id: 'lg-paleo', name: 'Paleontólogos en acción', desc: '64 chicos · Dinosaurios y fósiles', color: '#F26B3A', size: 64 },
  { id: 'lg-dquiz', name: 'Dino Quiz Club', desc: '212 chicos · Preguntas de dinosaurios', color: '#3A5BD9', size: 212 },
  { id: 'lg-huellas', name: 'Huellas y fósiles', desc: '45 chicos · Fósiles', color: '#8A5CF5', size: 45 },
  { id: 'lg-astro', name: 'Astronautas junior', desc: '156 chicos · El sistema solar', color: '#3A5BD9', size: 156 },
  { id: 'lg-volc', name: 'Cazadores de volcanes', desc: '73 chicos · Volcanes', color: '#F26B3A', size: 73 },
  { id: 'lg-frac', name: 'Reyes de las fracciones', desc: '98 chicos · Fracciones', color: '#E5487A', size: 98 },
];
