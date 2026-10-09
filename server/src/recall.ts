// Repasar (nombre interno: Active Recall) — visión audio 17: "la plataforma va contabilizando la
// capacidad que está teniendo en cada uno de los facts y arma sesiones diarias con lo que tiene flojo".
//
// ESTE ARCHIVO ES UN STUB del coordinador: contrato montado y compilable, SIN lógica todavía.
// La tanda R lo reemplaza entero con:
//   · Ledger por fact en RAM (regla 9 de AGENTS): seed demo rico (facts REALES de los cursos, con su
//     cita textual) + ingesta en vivo desde Practicar (practice.ts llama recordResult al corregir).
//   · GET  /api/recall/summary  → RecallSummary (src/api/types.ts)
//   · POST /api/recall/session  {extra?} → RecallSession (cartas con forma Exercise, mezcla de cursos)
//   · POST /api/recall/answer   {sessionId, cardId, answer} → RecallAnswerResult (corrige server-side,
//     mueve la fuerza del fact, premia con progress.addXp SOLO la primera vez que la carta se acierta)
//   · POST /api/recall/finish   {sessionId} → RecallFinish (marca la sesión de hoy como hecha)
//   · resetRecall() registrado en POST /api/demo/reset (index.ts): todo vuelve al seed por carga.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

/** Practicar avisa acá cada respuesta corregida (gancho de la tanda R; el stub no hace nada). */
export function recordResult(_r: {
  courseId: string; courseName: string; unit: number
  /** Clave estable del ejercicio dentro del curso */ key: string
  kind: 'open' | 'mc' | 'vf'
  /** Enunciado/pregunta y cita textual del material (regla de oro) */ text: string; evidence: string
  correct: boolean
}): void { /* stub */ }

export function resetRecall(): void { /* stub */ }

export async function recallRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/api/recall/summary') {
    return send(res, 200, {
      today: { state: 'sin-material', cards: 0, courses: [] },
      weak: 0, improving: 0, firm: 0, total: 0, perCourse: [], streakDays: 0,
    })
  }
  return send(res, 404, { error: 'Repasar todavía no está (stub)' })
}
