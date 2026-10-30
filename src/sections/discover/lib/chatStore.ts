import { useSyncExternalStore } from 'react';
import type { ChatMedia, ChatTurn } from '../../../api/types';
import type { ChatMsg } from '../components/ChatBubble';

/* ════ Los chats del Chat, CLIENT-SIDE (tanda BUSCARCHAT, 30-oct — decisión del coordinador, fiel al POC, que los guardaba
   en el navegador) ════
   El server sigue SIN estado: /api/chat recibe el contexto en cada turno y no guarda conversaciones. Acá, por usuario activo,
   una lista de conversaciones en localStorage `innerith.chat.v1.<userId>` = { convs: [{ id, title, startedAt, updatedAt,
   msgs, context }] }. Nadie más los ve: el padre NO ve estos chats (igual que antes con el chat en RAM; ningún texto de la
   UI promete lo contrario). «Sacar de la lista» y «Borrar todo» los borran de verdad de este navegador (no hay copia).
   - Topes: MAX_CONVS conversaciones (se va la de actividad más vieja) y MAX_MSGS mensajes por conversación (se van los
     más viejos, FIFO). El contexto que viaja al server lo recorta aparte ChatPage (CONTEXT_MAX).
   - CADA lectura/escritura de localStorage va en try/catch: sin cuota o en modo privado se degrada a RAM sin romper (la
     RAM es la fuente de verdad mientras la app está abierta; localStorage es solo la copia para el F5).
   - Sin usuario (falló /api/me) no se persiste nada: solo RAM.
   - Lo que viene de localStorage se valida forma por forma (puede venir de otra versión o tocado a mano); una respuesta que
     quedó «Pensando…» (F5 en medio de un turno) vuelve como el fail-closed de siempre. Los ids de mensaje son por conv.
   - Migración del chat en RAM de la versión anterior: esa RAM era una variable de módulo y no sobrevive a la recarga que
     trae este código, así que no hay nada que migrar entre versiones; dentro de una misma carga, esta RAM la reemplaza
     (sobrevive la navegación entre secciones, como antes). */

export type ChatConv = { id: string; title: string; startedAt: number; updatedAt: number; msgs: ChatMsg[]; context: ChatTurn[] };
export type ChatStore = { convs: ChatConv[] };

export const MAX_CONVS = 30;
export const MAX_MSGS = 60;
/** Al volver al Chat se retoma la última conversación si su último movimiento tiene menos de esto (como el POC). */
export const RESUME_MS = 30 * 60 * 1000;
/** El fail-closed de siempre: el turno no se pudo revisar. */
export const FAIL_CLOSED = 'No puedo revisar esto ahora mismo. Probemos de nuevo en un ratito 🙂';
const KEY = (uid: string) => `innerith.chat.v1.${uid}`;
const EMPTY: ChatStore = { convs: [] };

/** Título de un chat a partir del primer mensaje (sin costo de LLM): las primeras 7 palabras, hasta 42 letras + «…». */
export function deriveChatTitle(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ');
  return (words.length > 42 ? words.slice(0, 42).trim() + '…' : words) || 'Nuevo chat';
}

/** El grupo del historial por día calendario local: Hoy / Ayer / Esta semana (hasta 7 días) / Antes. */
export function dayGroup(ts: number, now = Date.now()): 'Hoy' | 'Ayer' | 'Esta semana' | 'Antes' {
  const day = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const diff = Math.round((day(now) - day(ts)) / 864e5);
  return diff <= 0 ? 'Hoy' : diff === 1 ? 'Ayer' : diff <= 7 ? 'Esta semana' : 'Antes';
}

/* ---- validación de lo que viene de localStorage ---- */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const arr = <T>(v: unknown, ok: (x: unknown) => x is T): T[] | undefined => (Array.isArray(v) ? v.filter(ok) : undefined);

function cleanMedia(v: unknown): ChatMedia | undefined {
  if (!isObj(v)) return undefined;
  const videos = arr(v.videos, (x): x is NonNullable<ChatMedia['videos']>[number] => isObj(x) && str(x.id) && str(x.img) && str(x.title));
  const images = arr(v.images, (x): x is NonNullable<ChatMedia['images']>[number] => isObj(x) && str(x.id) && str(x.thumb) && str(x.full));
  const articles = arr(v.articles, (x): x is NonNullable<ChatMedia['articles']>[number] => isObj(x) && str(x.url) && str(x.title));
  const m: ChatMedia = {};
  if (videos?.length) m.videos = videos;
  if (images?.length) m.images = images;
  if (articles?.length) m.articles = articles;
  return Object.keys(m).length ? m : undefined;
}
function cleanMsg(v: unknown): ChatMsg | null {
  if (!isObj(v) || !num(v.id) || !str(v.text)) return null;
  if (v.role === 'kid') return { id: v.id, role: 'kid', text: v.text };
  if (v.role !== 'ai') return null;
  // una respuesta que quedó a medio camino (F5 durante el turno) = no se pudo revisar: el fail-closed de siempre
  if (v.pending) return { id: v.id, role: 'ai', text: FAIL_CLOSED };
  const media = cleanMedia(v.media);
  return media ? { id: v.id, role: 'ai', text: v.text, media } : { id: v.id, role: 'ai', text: v.text };
}
const cleanTurn = (v: unknown): v is ChatTurn => isObj(v) && (v.role === 'user' || v.role === 'assistant') && str(v.content);

/** Lo leído de localStorage → un store válido y dentro de los topes (lo inválido se descarta en silencio). Pura. */
export function sanitizeStore(raw: unknown): ChatStore {
  if (!isObj(raw) || !Array.isArray(raw.convs)) return EMPTY;
  const convs: ChatConv[] = [];
  for (const c of raw.convs) {
    if (!isObj(c) || !str(c.id) || !num(c.startedAt)) continue;
    const msgs = (Array.isArray(c.msgs) ? c.msgs : []).map(cleanMsg).filter((m): m is ChatMsg => !!m);
    if (!msgs.length) continue;
    convs.push({
      id: c.id, title: str(c.title) && c.title.trim() ? c.title : deriveChatTitle(msgs.find((m) => m.role === 'kid')?.text ?? ''),
      startedAt: c.startedAt, updatedAt: num(c.updatedAt) ? c.updatedAt : c.startedAt,
      msgs, context: arr(c.context, cleanTurn) ?? [],
    });
  }
  return capStore({ convs });
}

/** Los topes: las MAX_CONVS de actividad más reciente (primero la más reciente) y los últimos MAX_MSGS de cada una. Pura. */
export function capStore(s: ChatStore): ChatStore {
  const convs = [...s.convs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVS)
    .map((c) => (c.msgs.length > MAX_MSGS ? { ...c, msgs: c.msgs.slice(-MAX_MSGS) } : c));
  return { convs };
}

/** ¿Qué conversación se retoma al entrar al Chat? La más reciente, si se movió hace menos de RESUME_MS. Pura. */
export function pickResume(s: ChatStore, now = Date.now()): string | null {
  const last = s.convs[0];
  return last && now - last.updatedAt < RESUME_MS ? last.id : null;
}

/* ---- el store (RAM por usuario + copia en localStorage) ---- */
const mem = new Map<string, ChatStore>();
/** La conversación abierta de cada usuario en esta carga (sobrevive la navegación entre secciones). undefined = todavía no
 *  se decidió (al entrar se aplica pickResume); null = un chat nuevo, vacío. */
const open = new Map<string, string | null>();
/** Conversaciones con un turno en camino (el composer de ESA conversación espera). */
const inflight = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(uid: string): ChatStore {
  if (!uid) return EMPTY;
  try {
    const raw = localStorage.getItem(KEY(uid));
    return raw ? sanitizeStore(JSON.parse(raw)) : EMPTY;
  } catch { return EMPTY; }
}
function read(uid: string): ChatStore {
  let s = mem.get(uid);
  if (!s) { s = load(uid); mem.set(uid, s); }
  return s;
}
function persist(uid: string) {
  if (!uid) return;
  try {
    const s = mem.get(uid);
    if (s && s.convs.length) localStorage.setItem(KEY(uid), JSON.stringify(s));
    else localStorage.removeItem(KEY(uid));
  } catch { /* sin cuota / modo privado: queda en RAM */ }
}
function commit(uid: string, next: ChatStore, save: boolean) {
  mem.set(uid, next);
  if (save) persist(uid);
  emit();
}
const mapConv = (s: ChatStore, id: string, f: (c: ChatConv) => ChatConv): ChatStore =>
  ({ convs: s.convs.map((c) => (c.id === id ? f(c) : c)) });

export function useChatStore(uid: string): ChatStore {
  return useSyncExternalStore(subscribe, () => read(uid));
}
export function useInflight(id: string | null): boolean {
  return useSyncExternalStore(subscribe, () => !!id && inflight.has(id));
}
export function useOpenConv(uid: string): string | null {
  const s = useChatStore(uid);
  const id = useSyncExternalStore(subscribe, () => open.get(uid));
  if (id === undefined) return null;
  return id && s.convs.some((c) => c.id === id) ? id : null;
}
/** Al entrar al Chat: si en esta carga todavía no se eligió conversación, se retoma la reciente (pickResume). */
export function resumeIfFirst(uid: string) {
  if (open.has(uid)) return;
  open.set(uid, pickResume(read(uid)));
  emit();
}
export function setOpenConv(uid: string, id: string | null) { open.set(uid, id); emit(); }
export const getConv = (uid: string, id: string) => read(uid).convs.find((c) => c.id === id);

/** El chico manda un mensaje: se agrega con la respuesta «Pensando…». Sin conversación abierta, se crea (su título sale de
 *  este primer mensaje). Devuelve dónde quedó y el id de la respuesta para ir completándola. */
export function startTurn(uid: string, convId: string | null, text: string): { convId: string; aiId: number } {
  const now = Date.now();
  let s = read(uid);
  let conv = convId ? s.convs.find((c) => c.id === convId) : undefined;
  if (!conv) {
    conv = { id: `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: deriveChatTitle(text), startedAt: now, updatedAt: now, msgs: [], context: [] };
    s = { convs: [conv, ...s.convs] };
  }
  const base = conv.msgs.length ? conv.msgs[conv.msgs.length - 1].id : 0;
  const kid: ChatMsg = { id: base + 1, role: 'kid', text };
  const ai: ChatMsg = { id: base + 2, role: 'ai', text: '', pending: true };
  const id = conv.id;
  s = capStore(mapConv(s, id, (c) => ({ ...c, updatedAt: now, msgs: [...c.msgs, kid, ai] })));
  open.set(uid, id);
  inflight.add(id);
  commit(uid, s, true);
  return { convId: id, aiId: ai.id };
}
/** Completa la respuesta (la revelación palabra a palabra pasa por acá sin escribir en disco: `save` solo al final). */
export function patchAi(uid: string, convId: string, aiId: number, p: Partial<Extract<ChatMsg, { role: 'ai' }>>, save = false) {
  const s = read(uid);
  if (!s.convs.some((c) => c.id === convId)) return; // la sacaron de la lista mientras tanto
  commit(uid, mapConv(s, convId, (c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === aiId && m.role === 'ai' ? { ...m, ...p } : m)) })), save);
}
export function setContext(uid: string, convId: string, context: ChatTurn[]) {
  const s = read(uid);
  if (!s.convs.some((c) => c.id === convId)) return;
  commit(uid, mapConv(s, convId, (c) => ({ ...c, context })), false);
}
export function endTurn(uid: string, convId: string) {
  inflight.delete(convId);
  const s = read(uid);
  if (s.convs.some((c) => c.id === convId)) commit(uid, mapConv(s, convId, (c) => ({ ...c, updatedAt: Date.now() })), true);
  else emit();
}
export function removeConv(uid: string, id: string) {
  if (open.get(uid) === id) open.set(uid, null);
  commit(uid, { convs: read(uid).convs.filter((c) => c.id !== id) }, true);
}
export function clearAll(uid: string) {
  open.set(uid, null);
  commit(uid, { convs: [] }, true);
}
