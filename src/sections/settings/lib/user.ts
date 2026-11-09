import type { User } from '../../../api/types';
import { L } from '../../../shared/lib/lang';

/** «{edad} años» para un chico, «Adulto» para un adulto: el rótulo que tenía el switch de la barra superior (tanda CONFIG,
 *  30-oct: el switch se mudó a Configuración). */
export const ageTag = (u: Pick<User, 'kind' | 'age'>): string => (u.kind === 'child' ? L(`${u.age} años`, `${u.age} years old`) : L('Adulto', 'Adult'));
