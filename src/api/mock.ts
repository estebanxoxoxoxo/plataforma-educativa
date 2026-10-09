// Datos de prueba. Todo lo que aparece en el prototipo está acá tal cual;
// lo que el prototipo no mostraba (otros temas, más ejercicios) es relleno coherente.
import type { Course } from './types';

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

/* Amigos ya no es mock del navegador: los NPCs (lista, solicitud, hilos, respuestas con modelo y moderación real)
   los sirve un fake de SERVIDOR (server/src/friendsFake.ts). Ligas tampoco: server/src/leaguesFake.ts, con la XP real. */
