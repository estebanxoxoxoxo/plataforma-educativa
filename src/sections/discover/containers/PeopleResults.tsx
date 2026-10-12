import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../../api';
import type { PersonRelation, PersonResult } from '../../../api/types';
import { chatAwait, chatFriendsChanged, openChat, useChatDock } from '../../friends/lib/chatDock';
import { PersonCard } from '../cards/PersonCard';

/** Largo mínimo de una búsqueda de personas (en letras, sin contar espacios): el mismo que exige el server
 *  (GET /api/friends/search, server/src/friendsFake.ts). */
const PEOPLE_MIN = 2;
const peopleQueryLen = (q: string) => q.replace(/\s+/g, '').length;

/** Buscar → Personas (tanda F2: Amigos dejó de ser sección; a la gente se la BUSCA por su nombre de usuario). Contenedor:
 *  busca en el server fake de amigos (api.searchPeople) y resuelve las acciones de cada resultado:
 *    · "Quiero contactarlo" → solicitud saliente; el dock la espera (chatAwait) y, cuando el chico acepta (en el demo, solo
 *      a los segundos), su conversación llega minimizada con su saludo y esta tarjeta pasa a "Ya son amigos".
 *    · "Aceptar" (él ya quería contactarse con Ian) → como en la zona pinneada del Feed: amigos y su conversación abierta.
 *    · "Ya son amigos" → su conversación en el dock.
 *  Escucha friendsRev del dock: cuando cambia el grafo social (aceptaciones, acá o en otro lado) vuelve a buscar, sin
 *  esqueletos. Lo monta SearchPage solo con Amigos prendido. */
export function PeopleResults({ q }: { q: string }) {
  const { friendsRev } = useChatDock();
  const [res, setRes] = useState<{ q: string; people: PersonResult[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const short = peopleQueryLen(q) < PEOPLE_MIN;

  // Una búsqueda vieja no pisa a una más nueva.
  const seq = useRef(0);
  useEffect(() => {
    if (short) { seq.current++; setRes(null); setFailed(false); return; }
    const n = ++seq.current;
    api.searchPeople(q).then(
      (r) => { if (n === seq.current) { setRes({ q, people: r.people }); setFailed(false); } },
      () => { if (n === seq.current) setFailed(true); },
    );
  }, [q, short, friendsRev]);
  useEffect(() => { setNote(null); }, [q]);

  /** Lo que respondió el server para ese chico (manda el server: nada optimista). */
  const setRelation = (id: string, relation: PersonRelation) =>
    setRes((cur) => cur && { ...cur, people: cur.people.map((x) => (x.id === id ? { ...x, relation } : x)) });

  const connect = async (p: PersonResult) => {
    if (busy) return;
    setBusy(p.id); setNote(null);
    try {
      const r = await api.askToConnect(p.id);
      setRelation(p.id, r.relation);
      if (r.relation === 'sent') chatAwait(p.id);
      else if (r.relation === 'friend' && r.ok) { chatFriendsChanged(); openChat(p.id); }
      if (!r.ok && r.error) setNote(r.error);
    } catch (e) {
      setNote(e instanceof ApiError && e.status === 404 ? 'Ese chico ya no está en Innerith.' : 'No pude mandar tu solicitud ahora. Probá de nuevo en un ratito.');
    } finally {
      setBusy(null);
    }
  };
  const accept = async (p: PersonResult) => {
    if (busy) return;
    setBusy(p.id); setNote(null);
    try {
      await api.acceptRequest(p.id);
      setRelation(p.id, 'friend');
      chatFriendsChanged();
      openChat(p.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) chatFriendsChanged(); // ya se respondió en otro lado: se vuelve a buscar
      else setNote('No pude aceptar ahora. Probá de nuevo en un ratito.');
    } finally {
      setBusy(null);
    }
  };

  if (!q) return <p className="sempty ppl-empty">Escribí el nombre de usuario de otro chico de Innerith para encontrarlo.</p>;
  if (short) return <p className="sempty ppl-empty">Escribí al menos {PEOPLE_MIN} letras de su nombre de usuario.</p>;
  const people = res?.q === q ? res.people : null;
  if (failed && !people) return <p className="sempty ppl-empty">No pude buscar ahora mismo. Probemos de nuevo en un ratito.</p>;
  if (!people) {
    return (
      <div className="ppl" role="status" aria-label="Buscando chicos con ese nombre">
        {[0, 1, 2].map((i) => <div key={i} className="ppl-row sk"><span className="ph-a" /><span className="ph-b"><i /><i /></span></div>)}
      </div>
    );
  }
  if (!people.length) return <p className="sempty ppl-empty">No encontré a nadie con ese nombre de usuario. Fijate si está bien escrito.</p>;
  return (
    <div className="ppl">
      {note && <p className="ppl-msg" role="status">{note}</p>}
      {people.map((p) => (
        <PersonCard key={p.id} p={p} busy={busy === p.id} onConnect={() => void connect(p)} onAccept={() => void accept(p)} onChat={() => openChat(p.id)} />
      ))}
    </div>
  );
}
