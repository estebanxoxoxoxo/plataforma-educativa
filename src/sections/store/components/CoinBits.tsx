import { IcCoin } from '../../../shared/components/icons';
import { fmtEc } from '../lib/format';

/** «Te faltan N …» con la MONEDA dibujada (30-oct, pedido de Esteban: la moneda va en TODOS los lugares del ⚡).
 *  La versión string (lib/format.faltan) queda solo para los tooltips `title`, que no pueden llevar SVG. */
export const Faltan = ({ n }: { n: number }) => (
  <>Te faltan {fmtEc(n)} <IcCoin className="ec-coin" aria-hidden="true" /></>
);
