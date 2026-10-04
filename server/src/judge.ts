// Jueces de entrada y salida. Port de judgeInput / judgeOutput (smarty-poc pipeline.ts) + prompts.ts.
// Los prompts salen del registro de Smarty: override de la familia o valor de fábrica.
import { MODELS, blackTopics, fill, ov } from './config'
import { complete, parseJudgeJson, spotlight } from './llm'

export interface Verdict { veredicto: 'aprobado' | 'bloqueado'; motivo?: string; cita?: string; mediosVetados?: string[] }
export interface InputVerdict { tema: string; en_lista_negra: boolean; es_critico: boolean; es_crisis: boolean }

/* Juez de SALIDA (judgeOutputPrompt). Fail-closed: si falla, tira error. */
export async function judgeOutput(text: string): Promise<Verdict> {
  const temas = blackTopics().map(t => `- ${t.name}: ${t.description}`).join('\n') || '(lista vacía)'
  const res = await complete({
    model: MODELS.juez,
    messages: [{ role: 'user', content: fill(ov.text('judge.output'), { listaNegra: temas, contenido: spotlight(text) }) }],
    maxTokens: ov.num('const.juezOutputMaxTokens'),
  })
  const v = parseJudgeJson<Verdict>(res.text)
  if (v.veredicto !== 'aprobado' && v.veredicto !== 'bloqueado') throw new Error('JUDGE_SCHEMA')
  return v
}

/* Para el lector de artículos (reader.ts judgeText): mismo juez de salida sobre el texto del artículo. */
export const judgeText = judgeOutput

/* Juez de ENTRADA (judgeInputPrompt): tema, lista negra, crítico, crisis. */
export async function judgeInput(lastTurns: string, signal?: AbortSignal): Promise<InputVerdict> {
  const temas = blackTopics().map(t => `- ${t.name}: ${t.description}${t.critical ? ' [CRITICO]' : ''}`).join('\n') || '(lista vacía)'
  const res = await complete({
    model: MODELS.juez,
    messages: [{ role: 'user', content: fill(ov.text('judge.input'), { listaNegra: temas, crisisCategorias: ov.text('judge.crisisCategorias'), ultimosTurnos: lastTurns }) }],
    maxTokens: ov.num('const.juezInputMaxTokens'),
    signal,
  })
  return parseJudgeJson<InputVerdict>(res.text)
}
