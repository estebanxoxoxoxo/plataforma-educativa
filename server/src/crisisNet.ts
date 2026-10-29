// RED DE CRISIS determinística (tanda FS-BASE-A, hallazgo chat.ts:252 del workflow base-review-2). SOLO corre cuando el juez
// de ENTRADA no respondió —caído, vencido o con un veredicto fuera de esquema (judge.ts)—: no reemplaza al juez ni lo
// adelanta. Es la red para que, con el juez caído, un mensaje de crisis no se pierda en silencio (antes: "Probemos de nuevo
// en un ratito", sin guion, sin línea de ayuda y sin aviso al padre). El POC al menos registraba un evento 'fallo' para el
// padre (smarty-poc pipeline.ts:236); acá, si la red pega → el MISMO guion de contención que el juez + aviso de crisis al
// padre marcado "sin clasificar"; si no pega → fail-closed con la línea de ayuda y un aviso "sin clasificar" agrupado
// (chat.ts: onInputJudgeDown; parent.ts: notifyParent {unclassified} y notifyUnreviewed).
// Las frases van normalizadas (sin tildes, minúsculas, espacios simples) y cortadas por palabra al principio; las que
// terminan en '*' son raíces ("suicid*" = suicidio, suicidarme…). Bloquear de más acá es lo seguro: un falso positivo muestra
// el guion y avisa al padre (que lo lee y decide); un falso negativo es justo lo que hay que evitar. Puro: sin config.
const PHRASES = [
  // ideación suicida / autolesión
  'me quiero morir', 'quiero morir*', 'me voy a morir de tristeza', 'quisiera morir*', 'ojala me muera', 'ojala estuviera muert*',
  'me quiero matar', 'me voy a matar', 'matarme', 'me mato', 'suicid*', 'no quiero vivir', 'no quiero seguir viviendo',
  'no quiero existir', 'quiero desaparecer', 'mejor si no existiera', 'no vale la pena vivir',
  'lastimarme', 'hacerme dano', 'me voy a hacer dano', 'me hago dano', 'cortarme', 'me corto', 'me lastimo',
  // abuso / violencia hacia el chico
  'me pegan', 'me pega', 'me pegaron', 'me lastiman', 'me lastima', 'me maltrat*', 'abusan de mi', 'abuso de mi', 'me abus*', 'me tocan',
  'me toco sus partes', 'me toca sus partes', 'me tocaron', 'me violaron', 'me obligan a', 'tengo miedo de volver a casa',
  // acoso / bullying grave
  'me hacen bullying', 'me amenazan', 'me quieren pegar', 'nadie me quiere', 'odio mi vida', 'todos me odian',
  // inglés (búsquedas y mensajes en inglés)
  'kill myself', 'want to die', 'wanna die', 'suicide', 'self harm', 'hurt myself', 'cut myself', 'end my life',
]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RES = PHRASES.map(p => {
  const stem = p.endsWith('*')
  const body = norm(stem ? p.slice(0, -1) : p).split(' ').map(escape).join(' ')
  return { p, re: new RegExp(`(^| )${body}${stem ? '' : '( |$)'}`) }
})

/** ¿El texto trae una frase de crisis? Devuelve la frase de la red que pegó (para la traza; nunca se loguea el texto del
 *  chico) o null. */
export function crisisNetHit(text: string): string | null {
  const t = norm(String(text ?? ''))
  if (!t) return null
  for (const { p, re } of RES) if (re.test(t)) return p
  return null
}
