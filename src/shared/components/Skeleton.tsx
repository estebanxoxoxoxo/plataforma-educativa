import { L } from '../lib/lang';
import { IcShieldX } from './icons';

/** Esqueleto de carga con sello "Filtrado". */
export const Skeleton = () => (
  <><div className="ph-a" /><div className="ph-b"><i /><i /><i /></div><span className="flag"><IcShieldX />{L('Filtrado', 'Filtered')}</span></>
);
