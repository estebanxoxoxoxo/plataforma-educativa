import { useState } from 'react';
import { api, setActingUser } from '../../../api';
import type { User } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcArrowRight, IcCheck } from '../../../shared/components/icons';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { ageTag } from '../lib/user';
import { CfgSection } from './CfgSection';

/** Cambiar de usuario (DEMO, docs/USUARIOS.md §2). Tanda CONFIG, 30-oct: la barra superior que tenía el switch se va (tanda
 *  SHELL-2) y este es su nuevo hogar. Misma lógica que tenía la barra: GET /api/users, el activo con MyAvatar (su look
 *  guardado) y los demás con el look derivado del nick (lookFor); elegir a otro → setActingUser (guarda el id y recarga
 *  desde el Feed SIN resetear la demo de nadie, U4). Carga y error con reintento como el resto del repo. */
export function SwitchUserSection({ user }: { user?: User }) {
  const users = useAsync(() => api.users(), []);
  const [going, setGoing] = useState<string | null>(null);
  const pick = (id: string) => { setGoing(id); setActingUser(id); };

  return (
    <CfgSection title="Cambiar de usuario" lede="Entrá como otra persona de la familia. Lo que estaban haciendo sigue donde estaba.">
      {users.loading && (
        <ul className="cfg-users" aria-busy="true" aria-label="Cargando los usuarios">
          {[0, 1, 2].map((i) => (
            <li key={i} className="cfg-urow cfg-sk" aria-hidden="true"><i className="cfg-sk-av" /><i className="cfg-sk-tx" /></li>
          ))}
        </ul>
      )}
      {!users.loading && users.error && (
        <div className="cfg-fail" role="alert">
          <p>No pude traer los usuarios. Probá de nuevo en un ratito.</p>
          <button type="button" className="cfg-btn cfg-btn--ghost" onClick={users.reload}>Reintentar</button>
        </div>
      )}
      {users.data && (
        <ul className="cfg-users">
          {users.data.users.map((u) => {
            const me = u.id === user?.id;
            const tag = ageTag(u);
            return (
              <li key={u.id}>
                {me ? (
                  <div className="cfg-urow is-on" aria-current="true">
                    <MyAvatar name={u.name} size={40} />
                    <span className="cfg-utx"><b>{u.name}</b><small>{tag} · usuario activo</small></span>
                    <IcCheck className="cfg-ucheck" aria-hidden="true" />
                  </div>
                ) : (
                  <button type="button" className="cfg-urow" disabled={going !== null} aria-busy={going === u.id || undefined}
                    aria-label={`Cambiar a ${u.name}, ${tag}`} onClick={() => pick(u.id)}>
                    <Avatar name={u.name} color="#9AA5C4" look={lookFor(u.nick)} size={40} />
                    <span className="cfg-utx"><b>{u.name}</b><small>{going === u.id ? 'Entrando…' : tag}</small></span>
                    <IcArrowRight className="cfg-ugo" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="cfg-note">Cambiar de usuario (demo)</p>
    </CfgSection>
  );
}
