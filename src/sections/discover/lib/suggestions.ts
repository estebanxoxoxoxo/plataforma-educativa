/** Temas sugeridos de Buscar (chips de la home y de los vacíos) y del Chat (chips del vacío: «Contame algo sobre …»).
 *  Tanda BUSCARCHAT (30-oct): el cliente NO tiene hoy una fuente limpia de temas para el usuario activo (los temas de la
 *  familia —lista blanca/negra— son de Familia y solo los lee el adulto), así que van fijos y curados para la edad. Son
 *  la MISMA lista en Buscar y en Chat (coherencia). Tocarlos no saltea nada: cada chip dispara una búsqueda o un mensaje
 *  normal, que pasa por la moderación de siempre en el server. */
// TEEN-COPY (4-nov): de «Los planetas · Volcanes · Dinosaurios» (7 años) a temas de 13. El ORDEN importa: ChatPage arma
// «Contame algo sobre …» con los 3 primeros, así que esos leen bien en minúscula; «Aprender acordes» va 4.º (solo Buscar).
export const SUGGESTED_TOPICS: readonly string[] = ['Agujeros negros', 'Cómo funciona un motor', 'Mitología griega', 'Aprender acordes'];
