import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReturnFocus, useSheetKeys, useVeil } from '../../store/lib/sheet';
import { dayGroup, type ChatConv } from '../lib/chatStore';
import { LnChat, LnPlus, LnSearch, LnTrash, LnX } from './icons';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const when = (ts: number) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** El HISTORIAL del Chat, a un click y a la DERECHA (tanda BUSCARCHAT; ChatHistory.tsx del POC): cajón fijo de 320 (88 % como
 *  mucho) sobre un velo, encima de todo (portal a <body>: .view es un contexto de apilamiento). «Tus chats», «+ Nuevo chat»,
 *  el buscador local, la lista por día (Hoy / Ayer / Esta semana / Antes; la abierta resaltada con « · actual»), la papelera
 *  de cada una y «Borrar todo el historial», con confirmación. Los chats viven solo en este navegador (lib/chatStore): los
 *  textos no prometen que alguien más los vea. Patrones de la casa: Esc cierra y Tab queda adentro (useSheetKeys), el velo
 *  cierra en el mousedown (useVeil), el foco vuelve a quien lo abrió (useReturnFocus) y «atrás» lo cierra (popstate, como
 *  los popovers de la barra: QA-T6 H-T6-6). */
export function ChatHistory({ convs, currentId, onPick, onNew, onRemove, onClearAll, onClose }: {
  convs: ChatConv[]; currentId: string | null;
  onPick: (id: string) => void; onNew: () => void; onRemove: (id: string) => void; onClearAll: () => void; onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  useSheetKeys(card, 'open', false, onClose);
  useReturnFocus();
  const veil = useVeil(onClose);
  useEffect(() => {
    window.addEventListener('popstate', onClose);
    return () => window.removeEventListener('popstate', onClose);
  }, [onClose]);

  const needle = fold(q.trim());
  const rows = needle ? convs.filter((c) => fold(c.title).includes(needle)) : convs;
  const groups: { label: string; rows: ChatConv[] }[] = [];
  for (const c of rows) {
    const label = dayGroup(c.updatedAt);
    const g = groups.find((x) => x.label === label);
    if (g) g.rows.push(c); else groups.push({ label, rows: [c] });
  }

  const remove = (c: ChatConv) => { if (window.confirm('¿Sacar este chat de tu lista?')) onRemove(c.id); };
  const clearAll = () => { if (window.confirm('¿Borrar todo el historial de chats?')) onClearAll(); };

  return createPortal(
    <div className="chx-ov" onMouseDown={veil}>
      <div className="chx" ref={card} role="dialog" aria-modal="true" aria-labelledby="chx-t" tabIndex={-1}>
        <div className="chx-h">
          <h2 id="chx-t">Tus chats</h2>
          <button type="button" className="chx-x" aria-label="Cerrar el historial" onClick={onClose} data-autofocus><LnX /></button>
        </div>
        <div className="chx-top">
          <button type="button" className="chx-new" onClick={onNew}><LnPlus />Nuevo chat</button>
          <label className="chx-find">
            <LnSearch />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus chats…" aria-label="Buscar en tus chats" enterKeyHint="search" />
          </label>
        </div>
        <div className="chx-list">
          {!rows.length && <p className="chx-empty">{q.trim() ? 'Nada con eso.' : 'Todavía no hay chats.'}</p>}
          {groups.map((g) => (
            <div key={g.label} className="chx-g">
              <p className="chx-gl">{g.label}</p>
              {g.rows.map((c) => {
                const cur = c.id === currentId;
                return (
                  <div key={c.id} className={`chx-row${cur ? ' on' : ''}`}>
                    <button type="button" className="chx-pick" onClick={() => onPick(c.id)} aria-current={cur || undefined}>
                      <LnChat className="chx-ic" />
                      <span className="chx-tx"><b>{c.title}</b><small>{when(c.updatedAt)}{cur ? ' · actual' : ''}</small></span>
                    </button>
                    <button type="button" className="chx-del" aria-label={`Sacar «${c.title}» de tu lista`} onClick={() => remove(c)}><LnTrash /></button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {convs.length > 0 && (
          <div className="chx-foot">
            <button type="button" className="chx-all" onClick={clearAll}><LnTrash />Borrar todo el historial</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
