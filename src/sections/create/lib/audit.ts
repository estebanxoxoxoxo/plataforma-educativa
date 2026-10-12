import type { AuditResult, FactInv } from './routeDraft';

/* Auditoría de veracidad de un fact desde /crear → POST /api/create/audit (NUESTRO server corre el factAudit del POC: las
   claves de OpenAI/Serper jamás llegan al navegador). Formas ADITIVAS (el coordinador las formaliza en types.ts al cierre);
   documentadas también en server/src/create.ts:
     request  (api.auditFacts(payload)) = { fact: { statement, front, back, quote, kind }, lang?: string }
     response = { ok: true, result: AuditResult } | { ok: false, error: string } */

export interface AuditFactInput { statement: string; front: string; back: string; quote: string; kind: string }
export interface AuditFactRequest { fact: AuditFactInput; lang?: string }
export type AuditFactResponse = { ok: true; result: AuditResult } | { ok: false; error: string };

/** El pedido para un fact del inventario: lo mismo que el POC le pasaba a auditFact(…, { lang: 'es' }). */
export const auditRequestFor = (f: FactInv): AuditFactRequest => ({
  fact: { statement: f.statement, front: f.front, back: f.back, quote: f.quote, kind: f.kind },
  lang: 'es',
});

/** Lo que el auditFact del POC devolvía o tiraba: el veredicto, o un Error con el mensaje del auditor (la vista lo muestra
 *  como "Auditoría: <mensaje>"). */
export function auditResultOf(res: unknown): AuditResult {
  const r = res as Partial<{ ok: boolean; result: AuditResult; error: string }> | null;
  if (r?.ok && r.result) return r.result;
  throw new Error(r?.error || 'El auditor no devolvió un veredicto.');
}
