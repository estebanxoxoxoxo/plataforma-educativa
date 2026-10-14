import type { DefinitionRecipeData } from '../../../api/types';
import type { DraftModule, FactInv, ModuleInventory } from './routeDraft';

/* Cliente de route-lab para /crear. Como en el POC (RouteCreator.tsx), el navegador le habla DIRECTO a route-lab: solo
   POST /module (generar un módulo) y POST /emit (re-emitir la profundización tras curar, sin re-extraer). route-lab no lleva
   claves del lado del navegador (las suyas viven en route-lab/.env) y responde con CORS abierto.
   La URL base es configurable EN LA VISTA (input) y se recuerda en localStorage `innerith.routeLabUrl` (el
   `smarty.routeLabUrl` del POC, mismo mecanismo: se guarda al "Generar", no al "Aplicar selección").
   Errores con el MISMO texto del POC: `route-lab <status>: <detail[:300]>` (detail = el `detail` del JSON de FastAPI o el
   texto crudo; un 422 de validación de pydantic llega como arreglo y se ve "[object Object]", trampa F7 del POC). Sin
   timeout ni cancelación, como el POC (F8). */

export const ROUTE_LAB_DEFAULT_URL = 'http://localhost:5203';
export const ROUTE_LAB_URL_KEY = 'innerith.routeLabUrl';

/** La URL guardada (o el default). localStorage puede fallar (modo privado): cae al default.
 *  GUARD-RAIL Innerith (14-oct, pasó dos veces): si lo recordado apunta a la PROPIA API de Innerith
 *  (:8787, que no es route-lab y da "Failed to fetch" por CORS), se vuelve al default 5203. */
export function savedRouteLabUrl(): string {
  try {
    const saved = localStorage.getItem(ROUTE_LAB_URL_KEY) || ROUTE_LAB_DEFAULT_URL;
    return /:8787(\/|$)/.test(saved) ? ROUTE_LAB_DEFAULT_URL : saved;
  } catch { return ROUTE_LAB_DEFAULT_URL; }
}
export function rememberRouteLabUrl(url: string): void {
  try { localStorage.setItem(ROUTE_LAB_URL_KEY, url); } catch { /* sin almacenamiento: se usa igual en esta sesión */ }
}
/** La base sin barra final (`url.replace(/\/$/, '')` del POC). */
export const routeLabBase = (url: string) => url.replace(/\/$/, '');

/* ---- contratos (route-lab/server.py + stages/module.py y emit.py; se tipa solo lo que usa /crear) ---- */
export interface ModuleRequest {
  source: string; routeId: string; moduleId: string;
  edad: number; nivel: string; lang: 'es'; activityTypes: string[]; size: string;
}
type PostaRef = { id: string; title: string; target: string };
export interface ModuleResponse {
  module: { id: string; title: string; emoji: string; source: DraftModule['source'] };
  comprehension: { posta: PostaRef; definition: DefinitionRecipeData };
  profundizacion?: { posta: PostaRef; definition: DefinitionRecipeData }[];
  inventory?: ModuleInventory;
  meta?: { captionKind?: string | null; jobId?: string };
}
export interface EmitPostaSpec { postaId: string; defId: string; target: string; title: string; idPrefix: string; factIds: string[]; conceptId: string }
export interface EmitRequest {
  facts: FactInv[]; postas: EmitPostaSpec[];
  edad: number; nivel: string; lang: 'es'; activityType: string; jobId?: string;
}
export interface EmitResponse {
  definitions?: { postaId: string; defId: string; target: string; title: string; definition: DefinitionRecipeData | null; reason: string | null }[];
}

async function post<T>(base: string, path: string, body: unknown): Promise<T> {
  console.debug(`%c[route-lab] → POST ${base}${path}`, 'color:#8A2B7E;font-weight:bold', body);
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = await res.text();
    let detail: unknown = raw;
    try { detail = JSON.parse(raw).detail ?? raw; } catch { /* texto plano */ }
    throw new Error(`route-lab ${res.status}: ${String(detail).slice(0, 300)}`);
  }
  const data = (await res.json()) as T;
  console.debug(`%c[route-lab] ← POST ${base}${path}`, 'color:#3A5BD9', data);
  return data;
}

/** Generar UN módulo (síncrono: la conexión queda abierta todo el pipeline ingest → extract → module). */
export const postModule = (base: string, body: ModuleRequest) => post<ModuleResponse>(base, '/module', body);
/** Curaduría: re-emitir las postas de los conceptos tildados con los facts tildados (no re-extrae). */
export const postEmit = (base: string, body: EmitRequest) => post<EmitResponse>(base, '/emit', body);
