// Datos de prueba. Todo lo que aparece en el prototipo está acá tal cual;
// lo que el prototipo no mostraba (otros temas, más ejercicios) es relleno coherente.
import type { Course, Friend, FriendMessage, User } from './types';

// Perfil de demo para los fakes del navegador; el perfil real sale de GET /api/me.
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

/* Practicar (recorrido, ejercicios y claves) ya no es mock: lo genera el server del contenido real de cada curso
   (server/src/practice.ts). El tono de okText/badText del prototipo vive ahora como ejemplos en el prompt. */

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

/* Ligas tampoco es mock del navegador: las sirve un fake de SERVIDOR (server/src/leaguesFake.ts) con la XP real. */
