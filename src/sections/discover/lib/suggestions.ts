/** Temas sugeridos de Buscar (chips de la home y de los vacíos) y del Chat (chips del vacío: «Contame algo sobre …»).
 *  Tanda BUSCARCHAT (30-oct): el cliente NO tiene hoy una fuente limpia de temas para el usuario activo (los temas de la
 *  familia —lista blanca/negra— son de Familia y solo los lee el adulto), así que van fijos y curados para la edad. Son
 *  la MISMA lista en Buscar y en Chat (coherencia). Tocarlos no saltea nada: cada chip dispara una búsqueda o un mensaje
 *  normal, que pasa por la moderación de siempre en el server. */
export const SUGGESTED_TOPICS: readonly string[] = ['Los planetas', 'Volcanes', 'Dinosaurios', 'Los océanos'];
