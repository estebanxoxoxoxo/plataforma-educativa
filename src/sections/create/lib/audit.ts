import type { AuditResult, FactInv } from './routeDraft';
import { L, getLang } from '../../../shared/lib/lang';

/* Auditoría de veracidad de un fact desde /crear → POST /api/create/audit (NUESTRO server corre el factAudit del POC: las
   claves de OpenAI/Serper jamás llegan al navegador). Formas ADITIVAS (el coordinador las formaliza en types.ts al cierre);
   documentadas también en server/src/create.ts:
     request  (api.auditFacts(payload)) = { fact: { statement, front, back, quote, kind }, lang?: string }
     response = { ok: true, result: AuditResult } | { ok: false, error: string } */

export interface AuditFactInput { statement: string; front: string; back: string; quote: string; kind: string }
export interface AuditFactRequest { fact: AuditFactInput; lang?: string }
export type AuditFactResponse = { ok: true; result: AuditResult } | { ok: false; error: string };

/** El pedido para un fact del inventario: lo que el POC le pasaba a auditFact(…, { lang }) — con el idioma ACTIVO de la
 *  app (14-nov, idioma por ruta): la auditoría de una ruta en inglés busca sus fuentes en en.wikipedia. */
export const auditRequestFor = (f: FactInv): AuditFactRequest => ({
  fact: { statement: f.statement, front: f.front, back: f.back, quote: f.quote, kind: f.kind },
  lang: getLang(),
});

/** Lo que el auditFact del POC devolvía o tiraba: el veredicto, o un Error con el mensaje del auditor (la vista lo muestra
 *  como "Auditoría: <mensaje>"). */
export function auditResultOf(res: unknown): AuditResult {
  const r = res as Partial<{ ok: boolean; result: AuditResult; error: string }> | null;
  if (r?.ok && r.result) return r.result;
  throw new Error(r?.error || L('El auditor no devolvió un veredicto.', "The auditor didn't return a verdict."));
}
