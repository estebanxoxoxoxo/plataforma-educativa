import { IcCoin } from '../../../shared/components/icons';
import { fmtEc } from '../lib/format';
import { L } from '../../../shared/lib/lang';

/** «Te faltan N …» con la MONEDA dibujada (30-oct, pedido de Esteban: la moneda va en TODOS los lugares del ⚡).
 *  La versión string (lib/format.faltan) queda solo para los tooltips `title`, que no pueden llevar SVG. */
export const Faltan = ({ n }: { n: number }) => (
  <>{L('Te faltan', 'You need')} {fmtEc(n)} {L('', 'more ')}<IcCoin className="ec-coin" aria-hidden="true" /></>
);
