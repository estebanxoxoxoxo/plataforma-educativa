// Jueces de entrada y salida. Port de judgeInput / judgeOutput (smarty-poc pipeline.ts) + prompts.ts.
// Los prompts salen del registro de Smarty: override de la familia o valor de fábrica.
import { MODELS, fill, ov } from './config'
import { complete, parseJudgeJson, spotlight } from './llm'
// Lista negra = la de fábrica (Smarty) + los temas negros de la familia (Zona del padre v2), en el acto.
import { blackTopicsAll } from './parent'

export interface Verdict { veredicto: 'aprobado' | 'bloqueado'; motivo?: string; cita?: string; mediosVetados?: string[] }
export interface InputVerdict { tema: string; en_lista_negra: boolean; es_critico: boolean; es_crisis: boolean }

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const optStr = (v: unknown) => v === undefined || v === null || typeof v === 'string'

/** FS-BASE-A (hallazgo judge.ts:36): el veredicto del juez de ENTRADA tiene que traer los TRES booleanos de su prompt
 *  ({"tema", "en_lista_negra", "es_critico", "es_crisis"}). Antes se usaba tal cual: un `{}`, un `"true"` en texto o un campo
 *  faltante daban `undefined` → ni crisis ni lista negra → el mensaje pasaba (fail-OPEN). Malformado → tira JUDGE_SCHEMA
 *  y el llamador hace lo de un juez caído (fail-closed + red de crisis: chat.ts onInputJudgeDown). */
export function checkInputVerdict(v: unknown): InputVerdict {
  if (!isRec(v) || typeof v.en_lista_negra !== 'boolean' || typeof v.es_crisis !== 'boolean' || typeof v.es_critico !== 'boolean' || !optStr(v.tema))
    throw new Error('JUDGE_SCHEMA')
  return { tema: typeof v.tema === 'string' ? v.tema : '', en_lista_negra: v.en_lista_negra, es_critico: v.es_critico, es_crisis: v.es_crisis }
}
/** El veredicto del juez de SALIDA: `veredicto` conocido (como antes) y, además, `mediosVetados` lista de textos y
 *  `motivo`/`cita` textos si vienen (antes un `mediosVetados` que no era lista reventaba más adelante). Malformado → JUDGE_SCHEMA. */
export function checkOutputVerdict(v: unknown): Verdict {
  if (!isRec(v) || (v.veredicto !== 'aprobado' && v.veredicto !== 'bloqueado')) throw new Error('JUDGE_SCHEMA')
  if (!optStr(v.motivo) || !optStr(v.cita)) throw new Error('JUDGE_SCHEMA')
  if (v.mediosVetados !== undefined && v.mediosVetados !== null && (!Array.isArray(v.mediosVetados) || v.mediosVetados.some(x => typeof x !== 'string')))
    throw new Error('JUDGE_SCHEMA')
  return {
    veredicto: v.veredicto,
    ...(typeof v.motivo === 'string' ? { motivo: v.motivo } : {}),
    ...(typeof v.cita === 'string' ? { cita: v.cita } : {}),
    ...(Array.isArray(v.mediosVetados) ? { mediosVetados: v.mediosVetados as string[] } : {}),
  }
}

/* Juez de SALIDA (judgeOutputPrompt). Fail-closed: si falla, tira error. */
export async function judgeOutput(text: string): Promise<Verdict> {
  const temas = blackTopicsAll().map(t => `- ${t.name}: ${t.description}`).join('\n') || '(lista vacía)'
  const res = await complete({
    model: MODELS.juez,
    messages: [{ role: 'user', content: fill(ov.text('judge.output'), { listaNegra: temas, contenido: spotlight(text) }) }],
    maxTokens: ov.num('const.juezOutputMaxTokens'),
    budget: 'judge', // FS-BASE-B: plazo total 30 s (llm.ts); vencido TIRA → el fail-closed del llamador
  })
  return checkOutputVerdict(parseJudgeJson<unknown>(res.text))
}

/* Para el lector de artículos (reader.ts judgeText): mismo juez de salida sobre el texto del artículo. */
export const judgeText = judgeOutput

/* Juez de ENTRADA (judgeInputPrompt): tema, lista negra, crítico, crisis. */
export async function judgeInput(lastTurns: string, signal?: AbortSignal): Promise<InputVerdict> {
  const temas = blackTopicsAll().map(t => `- ${t.name}: ${t.description}${t.critical ? ' [CRITICO]' : ''}`).join('\n') || '(lista vacía)'
  const res = await complete({
    model: MODELS.juez,
    messages: [{ role: 'user', content: fill(ov.text('judge.input'), { listaNegra: temas, crisisCategorias: ov.text('judge.crisisCategorias'), ultimosTurnos: lastTurns }) }],
    maxTokens: ov.num('const.juezInputMaxTokens'),
    signal,
    budget: 'judge', // FS-BASE-B: plazo total 30 s (llm.ts); vencido TIRA → el "juez caído" de FS-BASE-A (onInputJudgeDown)
  })
  return checkInputVerdict(parseJudgeJson<unknown>(res.text))
}
