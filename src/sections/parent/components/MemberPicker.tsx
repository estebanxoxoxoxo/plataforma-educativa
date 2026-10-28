import type { FamilyMember } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';

/** El selector de integrante de Familia (U3 · M2): un chip por dependiente —avatar, "Ian · 9" y sus avisos sin ver—. Radios
 *  NATIVOS dentro de un radiogroup (las flechas del teclado mueven la elección solas, como los radios de MentorSheet).
 *  `disabled` = la solapa es de toda la familia: el selector no aplica (se ve atenuado; la nota la pone la cabecera).
 *  Avatar derivado del nick (lookFor), como el switch de la barra superior para quien no es el activo. Pura. */
export function MemberPicker({ members, selected, unseenBy, disabled, onPick }: {
  members: FamilyMember[];
  selected: string;
  unseenBy: Record<string, number>;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className={`pz-mem${disabled ? ' is-family' : ''}`} role="radiogroup" aria-label="Integrante de la familia" aria-disabled={disabled || undefined}>
      {members.map((m) => {
        const on = m.id === selected;
        const n = unseenBy[m.id] ?? 0;
        return (
          <label key={m.id} className={`pz-mem-opt${on ? ' is-on' : ''}`} data-member={m.id}>
            <input type="radio" name="pz-member" value={m.id} checked={on} disabled={disabled} onChange={() => onPick(m.id)} />
            <Avatar name={m.name} color="#9AA5C4" look={lookFor(m.nick)} size={28} />
            <span className="pz-mem-t">{m.name} <span className="pz-mem-age">· {m.age}</span></span>
            {n > 0 && <span className="pz-mem-n" aria-label={`, ${n} ${n === 1 ? 'aviso sin ver' : 'avisos sin ver'}`}>{n}</span>}
          </label>
        );
      })}
    </div>
  );
}
