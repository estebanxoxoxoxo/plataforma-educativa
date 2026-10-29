import type { FamilyLeagueRow, FamilyWeekPrize } from '../../../api/types';
import { AVATAR_COLORS, Avatar, avatarHash } from '../../../shared/components/Avatar';
import { beatLastWeek, upPrizeEmoji } from '../lib/familyWeek';
import { MEDAL, fmt } from '../lib/format';
import { DaysDots } from './DaysDots';

/** U4 · D2 + U5 (§4.5): la tabla de la SEMANA de la familia (solapa Familia de /ligas). Todos los integrantes —grandes y
 *  chicos— por su XP de la semana (el orden de U4: XP → racha → seed, lo arma el server), con el avatar que ELIGIÓ cada uno.
 *  Cada fila, de izquierda a derecha: puesto con su circulito · avatar · nombre (+ 🏆 chiquita si ganó la semana pasada,
 *  + "Vos") y, debajo, el reto de constancia (siete puntitos "5 de 7 días", D2) y el ↑ "superó su semana" SOLO cuando se
 *  logró (mientras no, no hay nada: ni "te faltan", ni flecha gris) · XP. Con premio "supera su semana", el ↑ de un chico
 *  lleva el emoji del premio. La racha de U4 ya no va acá (sigue en el Feed): al lado de la del hermano, la rotura sería
 *  comparación (§4.2). `coins` = la Tienda está prendida para quien mira (apagada, la moneda no se nombra). Puro. */
export function FamilyRanking({ rows, prize, coins }: { rows: FamilyLeagueRow[]; prize: FamilyWeekPrize | null; coins: boolean }) {
  return (
    <>
      <h4 className="lgf-t">Esta semana: ¿quién aprende más días?</h4>
      <div className="rank full lgf">
        {rows.map((r) => {
          const up = beatLastWeek(r);
          const pe = upPrizeEmoji(r, prize);
          return (
            <div className={`rk lgf-rk${r.me ? ' me' : ''}`} key={r.id} data-me={r.me || undefined} data-member={r.id}>
              <span className="pos">{r.pos <= 3 ? <span className="md" style={{ background: MEDAL[r.pos - 1] }}>{r.pos}</span> : fmt(r.pos)}</span>
              <Avatar name={r.name} color={AVATAR_COLORS[avatarHash(r.nick) % AVATAR_COLORS.length]} look={r.look} />
              <span className="lgf-who">
                <span className="nm">
                  <span className="lgf-name">{r.name}</span>
                  {r.wonLastWeek && <span className="lgf-cup" role="img" aria-label="Ganó la semana pasada" title="Ganó la semana pasada">🏆</span>}
                  {r.me && <span className="you">Vos</span>}
                </span>
                {(typeof r.days === 'number' || up) && (
                  <span className="lgf-meta">
                    {typeof r.days === 'number' && <DaysDots days={r.days} />}
                    {up && (
                      <span className="lgf-up" data-up title={`${r.name} ya sumó más XP que su semana anterior`}>
                        <span aria-hidden="true">↑</span> superó su semana
                        {pe && <span className="lgf-up-prize" role="img" aria-label={`y se gana el premio de la semana`}>{pe}</span>}
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span className="xp">{fmt(r.xp)} XP</span>
            </div>
          );
        })}
      </div>
      <p className="lgf-foot">Un día cuenta cuando aprendés algo nuevo. Si un día no se pudo, no se pierde nada: la semana sigue.</p>
      <p className="lgf-foot lgf-foot--xp">
        {coins
          ? <>Cuenta la XP que cada uno suma aprendiendo lo suyo esta semana (los <span role="img" aria-label="Energy Coins">⚡</span>{' '}que gana). Vuelve a cero el lunes.</>
          : 'Cuenta la XP que cada uno suma aprendiendo lo suyo esta semana. Vuelve a cero el lunes.'}
      </p>
    </>
  );
}
