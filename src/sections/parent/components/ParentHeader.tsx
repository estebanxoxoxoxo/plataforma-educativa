import { NavLink } from 'react-router-dom';
import type { FamilyMember } from '../../../api/types';
import { listEs } from '../lib/format';
import { famTo } from '../lib/member';
import { MemberPicker } from './MemberPicker';

/** Secciones de Familia (la ex Zona de padres; rutas, no solapas de estado: cada una tiene su URL). Primero lo que se
 *  configura, después lo que se mira. Cada link lleva el integrante elegido (`?m=`): la elección sobrevive al cambiar de
 *  solapa. NavLink compara solo el pathname, así que la solapa activa se marca igual. */
const TABS = [
  { to: '/familia', label: 'Funcionalidades', end: true },
  { to: '/familia/temas', label: 'Temas y palabras', end: false },
  // MyTube (F2, 28-oct; ex «YouTube», /familia/youtube redirige): la MISMA grilla de canales que ve el chico + el agregar por
  // URL (porte W5: videos, playlists y canales de YouTube que se suman al catálogo). De toda la familia.
  { to: '/familia/mytube', label: 'MyTube', end: false },
  // After Day con solapa propia (F2; antes vivía al pie de YouTube): la misma grilla del chico + agregar/quitar.
  { to: '/familia/afterday', label: 'After Day', end: false },
  // Límites = topes de volumen + la zona horaria de la familia.
  { to: '/familia/limites', label: 'Límites', end: false },
  // Ciclo del día (F2, docs/USUARIOS.md §11): rangos horarios y qué secciones hay en cada uno, por integrante.
  { to: '/familia/ciclo', label: 'Ciclo del día', end: false },
  { to: '/familia/avisos', label: 'Avisos', end: false },
  { to: '/familia/premios', label: 'Premios', end: false },
  // Mentorías (tanda U2): lo contratado en Buscar → Mentores, para el adulto y sus dependientes (antes, "Profesores").
  { to: '/familia/mentorias', label: 'Mentorías', end: false },
  { to: '/familia/actividad', label: 'Actividad', end: false },
  { to: '/familia/protecciones', label: 'Protecciones', end: false },
];

/** Cabecera de Familia (U3 · M2): a quién se configura —"Cuenta de {integrante}", o "Toda la familia" en las solapas que son
 *  de la familia (`note` dice por qué)—, el selector de integrante y las secciones. Sin "salir": desde el 14-oct es el menú
 *  propio del adulto, sin portón (docs/USUARIOS.md §5).
 *  Contadores: `pending` = canjes del integrante elegido que esperan que se los den; `unseenBy` = avisos sin ver POR
 *  integrante (en cada chip) y el de la solapa Avisos es el de TODA la familia —un aviso de Luna no se pierde mientras se
 *  mira a Ian— (`crisis` = entre ellos hay uno de crisis: se marca distinto). Pura. */
export function ParentHeader({ member, members, note, onPick, unseenBy, pending, alerts, crisis }: {
  member: FamilyMember;
  members: FamilyMember[];
  /** solapa de toda la familia: la nota que va bajo el título (null = la solapa es del integrante elegido) */
  note: string | null;
  onPick: (id: string) => void;
  unseenBy: Record<string, number>;
  pending: number;
  alerts: number;
  crisis: boolean;
}) {
  const family = note !== null;
  const who = members.filter((m) => (unseenBy[m.id] ?? 0) > 0).map((m) => `${unseenBy[m.id]} sobre ${m.name}`);
  return (
    <header className="pz-head">
      <div className="pz-head-top">
        <div className="pz-head-id">
          <p className="pz-kicker">Familia</p>
          <h2 className="pz-title">{family ? 'Toda la familia' : `Cuenta de ${member.name}`}</h2>
          {family && <p className="pz-mem-note">{note}</p>}
        </div>
        {members.length > 0 && <MemberPicker members={members} selected={member.id} unseenBy={unseenBy} disabled={family} onPick={onPick} />}
      </div>
      <nav className="pz-tabs" aria-label="Secciones de Familia">
        {TABS.map((t) => (
          <NavLink key={t.to} to={famTo(t.to, member.id)} end={t.end} className={({ isActive }) => `pz-tab${isActive ? ' is-on' : ''}`}>
            {t.label}
            {t.to === '/familia/premios' && pending > 0 && (
              <span className="pz-count" aria-label={`, ${pending} ${pending === 1 ? 'canje pendiente' : 'canjes pendientes'} de ${member.name}`}>{pending}</span>
            )}
            {t.to === '/familia/avisos' && alerts > 0 && (
              <span className={`pz-count${crisis ? ' is-alert' : ''}`}
                aria-label={`, ${alerts} ${alerts === 1 ? 'aviso sin ver' : 'avisos sin ver'}${who.length ? ` (${listEs(who)})` : ''}${crisis ? ', hay uno de crisis' : ''}`}>{alerts}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
