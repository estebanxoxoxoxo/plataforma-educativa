// Datos de prueba. Todo lo que aparece en el prototipo está acá tal cual;
// lo que el prototipo no mostraba (otros temas, más ejercicios) es relleno coherente.
import type {
  Course, Exercise, Friend, FriendMessage, JourneyItem,
  AssignedLeague, NodeType, User,
} from './types';

// Solo para los fakes del navegador (ligas); el perfil real sale de GET /api/me.
export const ME: User = { name: 'Ian', age: 9, nick: 'Ian' };

/* ---------------- búsqueda ---------------- */
export type Topic = 'dinosaurios' | 'volcanes' | 'planetas';
export const topicOf = (q: string): Topic | null => {
  const s = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/dino|fosil|tiranos|paleont/.test(s)) return 'dinosaurios';
  if (/volc|lava|crater|erupc/.test(s)) return 'volcanes';
  if (/planet|espacio|sistema solar|astron|luna|sol\b|cohete/.test(s)) return 'planetas';
  return null;
};

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

/* ---------------- journey + ejercicios ---------------- */
// mismo orden que ITEMS del prototipo
export const JOURNEY_ITEMS = (sec1: string, sec2: string): JourneyItem[] => {
  const seq: (NodeType | { div: string })[] = [{ div: sec1 }, 'vf', 'mc', 'open', 'mc', 'vf', 'open', 'mc', 'vf', 'trophy', { div: sec2 }, 'vf', 'open', 'mc', 'vf'];
  let n = 0;
  return seq.map((s): JourneyItem => (typeof s === 'string' ? { kind: 'node', n: n++, type: s, xp: 0 } : { kind: 'div', title: s.div }));
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
export const ASSIGNED: AssignedLeague = { id: 'lg-cometa', name: 'Liga Cometa', color: '#F2A81D', pos: 7, total: 30, closes: 'el domingo' };
export const LEAGUE_TOP_XP: Record<string, number> = { 'lg-cometa': 1820 };
export const GEO = {
  zona: { name: 'Palermo', off: 0, top: 4980, me: 37, xp: 1240 },
  pais: { name: 'Argentina', off: 6, top: 12650, me: 4812, xp: 1240 },
};
