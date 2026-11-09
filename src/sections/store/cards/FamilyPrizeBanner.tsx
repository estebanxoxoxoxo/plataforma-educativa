import type { FamilyWeekPrize } from '../../../api/types';
import { IcArrowRight } from '../../../shared/components/icons';
import { conditionText, prizeByText } from '../../leagues/lib/familyWeek';
import { L } from '../../../shared/lib/lang';

/** U5 (§3.3): en la Tienda de un chico que juega la liga de la familia, el premio de la semana que puso el adulto, en una
 *  tarjeta destacada ARRIBA de la grilla (no adentro: que nadie crea que se compra con ⚡). Sin precio, sin "Canjear", sin
 *  corazón de deseos: "No se canjea: se gana en la liga de la familia →" lleva a /ligas?tab=familia. Pura. */
export function FamilyPrizeBanner({ prize, onGo }: { prize: FamilyWeekPrize; onGo: () => void }) {
  return (
    <aside className="stfp" aria-label={L('Premio de la semana de tu familia', 'Your family’s prize of the week')}>
      <span className="stfp-emo" aria-hidden="true">{prize.emoji}</span>
      <div className="stfp-main">
        <p className="stfp-k">{L('Premio de la semana de tu familia', 'Your family’s prize of the week')}</p>
        <p className="stfp-t">{prize.title}</p>
        <p className="stfp-c">{conditionText(prize.condition, 'child')} · {prizeByText(prize, 'child')}</p>
        <a className="stfp-go" href="/ligas?tab=familia" onClick={(e) => { e.preventDefault(); onGo(); }}>
          {L('No se canjea: se gana en la liga de la familia', 'Not redeemable: you win it in the family league')}<IcArrowRight aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
