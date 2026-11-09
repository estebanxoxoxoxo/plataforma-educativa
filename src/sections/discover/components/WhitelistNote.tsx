import { IcShieldOk } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

export const WhitelistNote = () => (
  <div className="wl"><IcShieldOk />{L('Resultados solo de fuentes verificadas para tu edad (lista blanca)', 'Results only from sources verified for your age (allowlist)')}</div>
);
