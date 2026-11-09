import { useId } from 'react';
import type { User } from '../../../api/types';
import { MyAvatar, openAvatarPicker, useMyIdentity } from '../../../shared/components/ProfileCard';
import { useFeatures } from '../../parent/lib/features';
import { ageTag } from '../lib/user';
import { CfgSection } from './CfgSection';
import { L } from '../../../shared/lib/lang';

/** Perfil → «Tu avatar» (tanda CONFIG, 30-oct; pedido de Esteban: «agregale toda la parte que tenemos de edición del avatar
 *  como un punto más de configuración»). El avatar grande con la ropa puesta (MyAvatar lee el store de identidad: al guardar
 *  en la hoja se actualiza solo) y el nombre, de SOLO LECTURA (los nombres viven en el server). El botón NO monta otra hoja:
 *  pide la de siempre con openAvatarPicker(), que vive en la tarjeta de perfil de la barra (una sola hoja en toda la app; al
 *  cerrarla, el foco vuelve a este botón: useReturnFocus de la hoja). */
export function ProfileSection({ user }: { user?: User }) {
  const { id } = useMyIdentity();
  // Sin Tienda (la apagó la familia) no se nombra la Tienda: misma regla que la barra con la moneda.
  const tienda = useFeatures()?.tienda === true;
  const helpId = useId();
  const name = user?.name ?? id?.nick ?? '';
  return (
    <CfgSection title={L('Perfil', 'Profile')}>
      <div className="cfg-me">
        <span className="cfg-me-av"><MyAvatar name={name} size={80} /></span>
        <div className="cfg-me-tx">
          <b className="cfg-me-n">{name || '…'}</b>
          {user && <small>{ageTag(user)}</small>}
        </div>
      </div>
      <div className="cfg-row">
        <div className="cfg-row-tx">
          <span className="cfg-row-t">{L('Tu avatar', 'Your avatar')}</span>
          <p className="cfg-help" id={helpId}>
            {tienda
              ? L('Tu personaje, su color y la ropa que conseguiste en la Tienda. Así te ven los demás en Smarty.', 'Your character, its color and the clothes you got in the Store. This is how others see you on Smarty.')
              : L('Tu personaje y su color. Así te ven los demás en Smarty.', 'Your character and its color. This is how others see you on Smarty.')}
          </p>
        </div>
        {/* Con la prenda PUESTA como preset: openAvatarPicker() a secas manda `null` = «Nada» y la hoja abría sin la ropa
            que tiene (y con Guardar ya habilitado: guardar le sacaba la prenda). Así abre igual que desde la tarjeta. */}
        <button type="button" className="cfg-btn" aria-haspopup="dialog" aria-describedby={helpId}
          onClick={() => openAvatarPicker(id?.look?.accessory ?? null)}>
          {L('Cambiar', 'Change')}<span className="cfg-sr">{L(' tu avatar', ' your avatar')}</span>
        </button>
      </div>
    </CfgSection>
  );
}
