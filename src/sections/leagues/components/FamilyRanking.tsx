import type { FamilyLeagueRow } from '../../../api/types';
import { AVATAR_COLORS, Avatar, avatarHash } from '../../../shared/components/Avatar';
import { IcSpark } from '../../../shared/components/icons';
import { MEDAL, fmt } from '../lib/format';

const days = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** U4 · D2 (audios 1008-1011): la tabla de la SEMANA de la familia (solapa Familia de /ligas). Todos los integrantes
 *  —grandes y chicos— por su XP de la semana (los ⚡ que ganó cada uno aprendiendo; el MISMO número de su liga), con la
 *  racha al lado ("✨ 9 días", la racha sin presión del Feed) y el avatar que ELIGIÓ cada uno (`row.look`, de identity:
 *  no el derivado del nick). El patrón de FullRanking (puesto con medallita 1-3, "Vos" resaltado); no es una liga de la
 *  escalera (sin NPCs ni cierre: vuelve a cero el lunes con la XP). `coins` = la Tienda está prendida para quien mira
 *  (apagada, la moneda no se nombra en el pie). Puro: todo llega por props. */
export function FamilyRanking({ rows, coins }: { rows: FamilyLeagueRow[]; coins: boolean }) {
  return (
    <>
      <div className="rank full lgf">
        {rows.map((r) => (
          <div className={`rk lgf-rk${r.me ? ' me' : ''}`} key={r.id} data-me={r.me || undefined}>
            <span className="pos">{r.pos <= 3 ? <span className="md" style={{ background: MEDAL[r.pos - 1] }}>{r.pos}</span> : fmt(r.pos)}</span>
            <Avatar name={r.name} color={AVATAR_COLORS[avatarHash(r.nick) % AVATAR_COLORS.length]} look={r.look} />
            <span className="nm">{r.name}{r.me && <span className="you">Vos</span>}</span>
            <span className="lgf-streak" title={`Racha de ${r.name}: ${days(r.streakDays)} seguidos`}>
              <IcSpark aria-hidden="true" />{days(r.streakDays)}
            </span>
            <span className="xp">{fmt(r.xp)} XP</span>
          </div>
        ))}
      </div>
      <p className="lgf-foot">
        {coins
          ? <>Cuenta la XP que cada uno suma aprendiendo lo suyo esta semana (los <span role="img" aria-label="Energy Coins">⚡</span>{' '}que gana). Vuelve a cero el lunes.</>
          : 'Cuenta la XP que cada uno suma aprendiendo lo suyo esta semana. Vuelve a cero el lunes.'}
      </p>
    </>
  );
}
