/* FIX-MINT (hallazgo ALTA de QA-SEGURIDAD en server/src/learnRoutes.ts checkBounds): hasta dónde ESCALAN los generadores
   'math' y 'capitales-latam' (dominó y quiz) con sus params. Es la ÚNICA fuente de los topes, para las dos defensas:
     · el importador del server (server/src/learnRoutes.ts → IMPORT_LIMITS.scaled) rechaza con 400, ANTES del acuñado seco,
       todo valor de estas claves que no sea un número de 0 a su tope (también un número escrito como texto, "5000000": el
       generador lo coaccionaba y armaba un Array de millones; con "200000000" el server moría por falta de memoria);
     · los generadores los usan de TOPE DURO (defensa en profundidad) donde una clave hace crecer un loop o una alocación
       —maxValue y tileCount del dominó, questionCount del quiz—, por si un valor de más llega por otro camino (una fila del
       catálogo de antes del arreglo que hidrata el cliente, un llamador nuevo): se acuña como su tope, nunca como millones.
       optionCount y count ya tienen cota en el generador (los 200 intentos de los distractores; el tamaño del dataset).
   Con un valor dentro del tope —todo lo del seed (definitions.ts), los presets y lo que acepta el import— el resultado es
   IDÉNTICO al del POC. El POC nunca emite estas claves en un bundle (route-lab y /crear solo emiten el generador 'static');
   viven en el seed en código, siempre como números. */
export const SCALED_PARAM_MAX = { maxValue: 1000, tileCount: 60, questionCount: 100, optionCount: 12, count: 100 } as const
