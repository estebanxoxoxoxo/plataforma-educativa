import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { ChatReply, ChatTurn } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { IcShield } from '../../../shared/components/icons';
import { ChatBubble, type ChatMediaHandlers } from '../components/ChatBubble';
import { ChatHistory } from '../components/ChatHistory';
import { LnArrowDown, LnArrowUp, LnHistory, LnPlus } from '../components/icons';
import {
  FAIL_CLOSED, clearAll, endTurn, getConv, patchAi, removeConv, resumeIfFirst, setContext, setOpenConv, startTurn,
  useChatStore, useInflight, useOpenConv,
} from '../lib/chatStore';
import { SUGGESTED_TOPICS } from '../lib/suggestions';

/** FS-BASE-B (hallazgo web.ts:6): el contexto que viaja se recorta a los últimos CONTEXT_MAX mensajes. El server usa solo los
 *  últimos const.principalTurnos (12 de fábrica) y el juez, menos; antes crecía sin fin y, pasados los 200 KB del cuerpo,
 *  CADA mensaje siguiente del chico rebotaba (500, ahora 413) hasta recargar. 40 deja margen de sobra sobre esos knobs. */
const CONTEXT_MAX = 40;
const MAX_INPUT = 2000;
/** El contador de letras aparece desde acá. */
const COUNT_FROM = 1800;
/** «Esto está tardando más de lo normal…» (POC) después de esto sin respuesta. */
const SLOW_MS = 15000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NONE: never[] = [];

/** Chat (tanda BUSCARCHAT, 30-oct: al nivel del POC — ChildChat.tsx). Barra fina con el título del chat, el HISTORIAL a un
 *  click (cajón a la derecha) y «+ Nuevo»; la conversación en una columna angosta; el vacío AL MEDIO con su saludo y 3
 *  ideas; el composer píldora (1-4 renglones, Enter manda, Shift+Enter baja de renglón, tope 2000).
 *  Varias conversaciones, guardadas SOLO en este navegador por usuario (lib/chatStore; el server sigue sin estado).
 *  Lo que NO cambió: el contrato api.chat(contexto, texto) con el contexto en cuarentena (lo que entra a los próximos
 *  turnos lo decide el backend: childContextText/contextText), CONTEXT_MAX, el fail-closed, la revelación palabra a palabra
 *  y los handlers de medios. */
export function ChatPage() {
  const user = useUser();
  const uid = user?.id ?? '';
  const store = useChatStore(uid);
  const openId = useOpenConv(uid);
  const conv = openId ? store.convs.find((c) => c.id === openId) : undefined;
  const msgs = conv?.msgs ?? NONE;
  const busy = useInflight(openId);
  const [text, setText] = useState('');
  const [slow, setSlow] = useState(false);
  const [history, setHistory] = useState(false);
  const [newPill, setNewPill] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const go = useNavigate();

  useEffect(() => { resumeIfFirst(uid); }, [uid]);

  // «Pensando…» que se estira: el aviso de que tarda (como el POC).
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [busy]);

  // Composer: de 1 a 4 renglones según lo escrito (también los renglones que se arman solos al envolver).
  useLayoutEffect(() => {
    const el = ta.current; if (!el) return;
    el.style.height = 'auto';
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const pad = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    el.style.height = `${Math.min(el.scrollHeight, lh * 4 + pad)}px`;
  }, [text]);

  // Al cambiar de chat, al fondo y pegado.
  useLayoutEffect(() => {
    stick.current = true; setNewPill(false);
    const el = list.current; if (el) el.scrollTop = el.scrollHeight;
  }, [openId]);
  // Lo nuevo: si estaba abajo, lo sigue; si había subido a leer, aparece «↓ Nueva respuesta».
  useLayoutEffect(() => {
    const el = list.current; if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
    else setNewPill(true);
  }, [msgs]);
  const atBottom = () => { const el = list.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
  const toBottom = () => {
    const el = list.current; if (!el) return;
    stick.current = true; setNewPill(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const send = async (raw?: string) => {
    const q = (raw ?? text).trim().slice(0, MAX_INPUT);
    if (!q || busy) return;
    if (raw === undefined) setText('');
    stick.current = true;
    const { convId, aiId } = startTurn(uid, openId, q);
    const context: ChatTurn[] = getConv(uid, convId)?.context ?? [];
    let reply: ChatReply;
    try {
      reply = await api.chat(context, q);
    } catch {
      patchAi(uid, convId, aiId, { text: FAIL_CLOSED, pending: false }); // fail-closed
      endTurn(uid, convId);
      return;
    }
    // Contexto en cuarentena (Smarty RF-5.7): lo que entra a los próximos turnos lo decide el backend.
    setContext(uid, convId, [...context, { role: 'user' as const, content: reply.childContextText ?? q }, { role: 'assistant' as const, content: reply.contextText }].slice(-CONTEXT_MAX));
    console.debug('[chat] decisión:', reply.kind, '·', reply.trace);

    // La respuesta ya pasó el juez completa; se revela de a poco solo por estética.
    const words = reply.text.split(/(\s+)/);
    for (let i = 1; i <= words.length; i += 2) { patchAi(uid, convId, aiId, { text: words.slice(0, i).join(''), pending: false }); await sleep(18); }
    patchAi(uid, convId, aiId, { text: reply.text, media: reply.media, pending: false });
    endTurn(uid, convId);
  };

  const h: ChatMediaHandlers = {
    onVideo: (v) => go(`/buscar/video/${v.id}`),
    onArticle: (url) => go(`/buscar/articulo/${encodeURIComponent(url)}`),
    onImage: (img) => window.open(img.full, '_blank', 'noopener'),
  };

  const closeHistory = useCallback(() => setHistory(false), []);
  const startNew = () => { setOpenConv(uid, null); setText(''); setHistory(false); };
  const pick = (id: string) => { setOpenConv(uid, id); setHistory(false); };

  const name = user?.name?.split(' ')[0];
  const empty = msgs.length === 0;
  const title = conv?.title ?? 'Nuevo chat';

  return (
    <section className="view" id="v-chat">
      <div className="cx-bar">
        <h2 className="cx-title" title={title}>{title}</h2>
        <button type="button" className="cx-hist" aria-label="Historial de chats" title="Historial de chats" onClick={() => setHistory(true)}><LnHistory /></button>
        <button type="button" className="cx-new" onClick={startNew} aria-label="Nuevo chat"><LnPlus />Nuevo</button>
      </div>

      <div className="cx-scroll" ref={list} onScroll={() => { stick.current = atBottom(); if (stick.current) setNewPill(false); }}>
        <div className={`cx-col${empty ? ' is-empty' : ''}`}>
          {empty ? (
            <div className="cx-empty">
              <h3>¡Hola{name ? ` ${name}` : ''}! 👋</h3>
              <p>¿Qué querés saber hoy?</p>
              <div className="cx-chips">
                {SUGGESTED_TOPICS.slice(0, 3).map((t) => (
                  <button key={t} type="button" className="sx-chip" onClick={() => void send(`Contame algo sobre ${t.toLowerCase()}`)}>{t}</button>
                ))}
              </div>
            </div>
          ) : msgs.map((m) => <ChatBubble key={m.id} m={m} h={h} slow={slow} />)}
        </div>
      </div>

      <div className="cx-foot">
        {newPill && <button type="button" className="cx-newpill" onClick={toBottom}><LnArrowDown />Nueva respuesta</button>}
        <form className="cx-comp" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea ref={ta} value={text} rows={1} maxLength={MAX_INPUT} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta"
            onChange={(e) => setText(e.target.value.slice(0, MAX_INPUT))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
            }} />
          <button className="cx-send" type="submit" aria-label="Enviar" disabled={busy || !text.trim()}><LnArrowUp /></button>
        </form>
        {text.length >= COUNT_FROM && <div className="cx-count" aria-live="polite">{text.length}/{MAX_INPUT}</div>}
        <div className="cx-note"><IcShield />Respuestas y contenidos moderados para chicos</div>
      </div>

      {history && (
        <ChatHistory convs={store.convs} currentId={openId} onPick={pick} onNew={startNew} onClose={closeHistory}
          onRemove={(id) => removeConv(uid, id)} onClearAll={() => clearAll(uid)} />
      )}
    </section>
  );
}
