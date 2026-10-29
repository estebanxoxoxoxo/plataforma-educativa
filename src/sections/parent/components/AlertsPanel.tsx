import { useState } from 'react';
import type { FamilyMember, ParentAlert } from '../../../api/types';
import { AlertRow } from '../cards/AlertRow';
import { listEs } from '../lib/format';
import { PanelState } from './PanelState';

type Filter = 'member' | 'all';

/** "Avisos": lo que Innerith le avisa al adulto sobre la seguridad de cada integrante (un mensaje de crisis —CON lo que
 *  escribió, textual, para que pueda actuar: decisión 11-oct—, un intento de pasar datos de contacto o de salir de la
 *  plataforma, y mensajes frenados una y otra vez), del más nuevo al más viejo.
 *  U3 · M2: `alerts` son los de TODA la familia (cada uno dice sobre quién: childId/childName). Filtro "Solo {integrante}" /
 *  "Toda la familia" (estado local: arranca en el integrante elegido; con "toda la familia" cada fila dice "Sobre {nombre}").
 *  Si el filtro esconde avisos sin ver de otro integrante, se dice y se ofrece verlos. "Marcar todos como vistos" marca los
 *  del filtro. Casi pura: datos y acciones los resuelve el contenedor (ParentZone, que además lleva los contadores). */
export function AlertsPanel({ member, members, alerts, failed, busy, onSeen, onSeenAll, onRetry }: {
  member: FamilyMember;
  members: FamilyMember[];
  alerts: ParentAlert[] | null;
  failed: boolean;
  busy: number[];
  onSeen: (id: number) => void;
  onSeenAll: (ids: number[]) => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('member');
  const kid = member.name;
  const shown = alerts && (filter === 'all' ? alerts : alerts.filter((a) => a.childId === member.id));
  const unseen = shown?.filter((a) => !a.seen) ?? [];
  // Avisos sin ver que el filtro "Solo {kid}" deja afuera (de otro integrante): que no pasen desapercibidos.
  const hidden = filter === 'member' && alerts ? alerts.filter((a) => !a.seen && a.childId !== member.id) : [];
  const hiddenWho = members.filter((m) => hidden.some((a) => a.childId === m.id)).map((m) => m.name);
  const nameOf = (a: ParentAlert) => a.childName ?? members.find((m) => m.id === a.childId)?.name ?? null;
  const several = members.length > 1;

  return (
    <section className="pz-panel" aria-labelledby="pz-al-h">
      <header className="pz-panel-head pz-panel-head--act">
        <div>
          <h3 id="pz-al-h">Avisos</h3>
          <p>Lo que el Moderador y el chat te avisan sobre {filter === 'all' ? 'cada integrante de tu familia' : kid}: mensajes de crisis, intentos de pasar datos de contacto y mensajes frenados una y otra vez.</p>
        </div>
        {unseen.length > 1 && <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy.length > 0} onClick={() => onSeenAll(unseen.map((a) => a.id))}>Marcar todos como vistos</button>}
      </header>
      {several && (
        <fieldset className="pz-seg pz-mem-filter">
          <legend className="pz-sr">Qué avisos ver</legend>
          {([['member', `Solo ${kid}`], ['all', 'Toda la familia']] as const).map(([id, label]) => (
            <label key={id} className={`pz-seg-opt${filter === id ? ' is-on' : ''}`} data-filter={id}>
              <input type="radio" name="pz-alert-filter" value={id} checked={filter === id} onChange={() => setFilter(id)} />
              <b>{label}</b>
            </label>
          ))}
        </fieldset>
      )}
      {hidden.length > 0 && (
        <p className="pz-note pz-mem-hint">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="6.2" r="1.1" fill="currentColor" /></svg>
          {hidden.length === 1 ? 'Hay 1 aviso sin ver' : `Hay ${hidden.length} avisos sin ver`} sobre {hiddenWho.length ? listEs(hiddenWho) : 'otro integrante'}.
          <button type="button" className="pz-link" onClick={() => setFilter('all')}>Ver toda la familia</button>
        </p>
      )}
      {!shown ? <PanelState failed={failed} onRetry={onRetry} /> : shown.length === 0 ? (
        <div className="pz-alerts-empty">
          <p className="pz-muted">{filter === 'all'
            ? 'No hay avisos. Si alguien de tu familia escribe algo que indique una crisis, intenta pasar datos de contacto o insiste con mensajes que el Moderador frena, aparece acá.'
            : `No hay avisos sobre ${kid}. Si ${kid} escribe algo que indique una crisis, intenta pasar datos de contacto o insiste con mensajes que el Moderador frena, aparece acá.`}</p>
        </div>
      ) : (
        <ul className="pz-alerts">
          {shown.map((a) => <AlertRow key={a.id} a={a} who={filter === 'all' ? nameOf(a) : null} busy={busy.includes(a.id)} onSeen={() => onSeen(a.id)} />)}
        </ul>
      )}
      <p className="pz-foot">En un aviso de crisis ves lo que escribió, textual, para que puedas actuar enseguida. Los avisos quedan guardados: un reinicio del servidor no los borra.</p>
    </section>
  );
}
