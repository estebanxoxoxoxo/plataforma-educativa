import { IcShieldOk } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

/** La nota de Buscar → Personas (mismo lugar y estilo que la de lista blanca de Páginas): qué se ve de cada chico y que
 *  para charlar primero tiene que aceptar. */
export const PeopleNote = () => (
  <div className="wl ppl-note"><IcShieldOk />{L('Buscá a otras personas de Smarty por su nombre de usuario. Solo ves su nombre y qué están practicando; para charlar, primero tienen que aceptar.', 'Find other people on Smarty by their username. You only see their name and what they’re practicing; to chat, they have to accept first.')}</div>
);
