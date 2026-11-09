import { IcInfo } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

/** La nota de Buscar → Mentores (mismo lugar y forma que la de Páginas o Personas): qué se contrata y cómo es el flujo
 *  (plan y para quién → pago → los días). Solo la ve el adulto. Pura. */
export const MentorsNote = () => (
  <div className="wl smn-note"><IcInfo />{L('Clases particulares online de una hora, para vos o para alguien de tu familia. Elegís cuántas por semana y, después del pago, los días.', 'One-hour private online classes, for you or someone in your family. You pick how many per week and, after paying, the days.')}</div>
);
