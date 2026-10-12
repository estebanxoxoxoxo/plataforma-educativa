import { useEffect, useState, type ComponentType } from 'react';
import { ensureAudio } from '../../../learn/audio/service';
import type { ActivityInstance, CommonSnapshot } from '../../../learn/activity';
import { useActivityClock, useActivitySnapshot } from '../../../learn/react/useActivity';
import { IcFlag, IcPause, IcPlay, IcRotateCcw, IcX } from './LearnIcons';

/* El MARCO (chrome) del overlay de una actividad — piezas de ActivityOverlay.tsx del POC con sus MISMOS textos, tiempos y
   reglas: Lobby ("¡Cuando estés, dale!" + "▶ ¡Empezar!", que desbloquea el audio) → cuenta 3-2-1-"¡Ya!" (700 ms por número
   + 450 ms del "¡Ya!", con la animación de escala) → Runner (✕, título, puntaje, Pausar/Reanudar, Rendirse) → Resultado
   ("¡Lo lograste!"/"Terminó", aciertos/errores/mejor racha/duración, "Jugar de nuevo", "Cerrar"). Estética de Innerith.
   Leen la INSTANCIA del motor (su store), no la API. */

type Board = ComponentType<{ engine: unknown }>;

function fmtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v - 1), 700);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div
      key={n}
      ref={(el) => {
        el?.animate(
          [
            { opacity: 0, transform: 'scale(0.4)' },
            { opacity: 1, transform: 'scale(1.15)', offset: 0.35 },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 700, easing: 'ease-out' },
        );
      }}
      className="ln-countdown">
      {n > 0 ? n : '¡Ya!'}
    </div>
  );
}

function Lobby({ title, onStart }: { title: string; onStart: () => void }) {
  const [counting, setCounting] = useState(false);
  return (
    <div className="ln-lobby">
      {counting ? (
        <Countdown onDone={onStart} />
      ) : (
        <>
          <h2 className="ln-lobby-t">{title}</h2>
          <p className="ln-lobby-p">¡Cuando estés, dale!</p>
          <button type="button" className="ln-btn ln-btn-go" onClick={() => { void ensureAudio(); setCounting(true); }}>
            ▶ ¡Empezar!
          </button>
        </>
      )}
    </div>
  );
}

function Result({ instance, awardedEc, onPlayAgain, onClose }: {
  instance: ActivityInstance<CommonSnapshot>;
  /** ⚡ acreditados en ESTA partida (economía Innerith); 0 = nada. */ awardedEc: number;
  onPlayAgain: () => void; onClose: () => void;
}) {
  const r = instance.getResult();
  if (!r) return null;
  return (
    <div className="ln-result">
      <div className="ln-result-emoji" aria-hidden="true">{r.outcome === 'completed' ? '🎉' : '🏁'}</div>
      <h2 className="ln-result-t">{r.outcome === 'completed' ? '¡Lo lograste!' : 'Terminó'}</h2>
      <div className="ln-result-score">
        {r.score}
        <span> / {r.maxScore}</span>
      </div>
      {awardedEc > 0 && <div className="ln-result-ec">+{awardedEc} ⚡</div>}
      <div className="ln-result-stats">
        <span>✅ {r.stats.correct}</span>
        <span>❌ {r.stats.wrong}</span>
        <span>🔥 {r.stats.bestStreak}</span>
        <span>⏱ {fmtTime(r.durationMs)}</span>
      </div>
      <div className="ln-result-acts">
        <button type="button" className="ln-btn ln-btn-go" onClick={onPlayAgain}>
          <IcRotateCcw /> Jugar de nuevo
        </button>
        <button type="button" className="ln-btn ln-btn-quiet" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function Runner({ instance, Board, title, awardedEc, onPlayAgain, onClose }: {
  instance: ActivityInstance<CommonSnapshot>;
  Board: Board;
  title: string;
  awardedEc: number;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  useActivityClock(instance);
  const snap = useActivitySnapshot(instance);
  const playing = snap.status === 'running' || snap.status === 'paused';

  return (
    <div className="ln-run">
      <header className="ln-run-head">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ln-ib">
          <IcX strokeWidth={1.85} />
        </button>
        <h1 className="ln-run-t">{title}</h1>
        {playing && (
          <>
            <span className="ln-run-score">
              <strong>{snap.score}</strong>
              <span> / {snap.maxScore}</span>
            </span>
            {snap.status === 'running' ? (
              <button type="button" onClick={() => instance.pause()} aria-label="Pausar" className="ln-ib">
                <IcPause />
              </button>
            ) : (
              <button type="button" onClick={() => instance.resume()} aria-label="Reanudar" className="ln-ib">
                <IcPlay fill="currentColor" />
              </button>
            )}
            <button type="button" onClick={() => instance.abort()} aria-label="Rendirse" className="ln-ib is-flag">
              <IcFlag />
            </button>
          </>
        )}
      </header>

      <div className="ln-run-body">
        {snap.status === 'idle' && <Lobby title={title} onStart={instance.start} />}
        {playing && (
          <div className="ln-board">
            <Board engine={instance} />
          </div>
        )}
        {snap.status === 'finished' && <Result instance={instance} awardedEc={awardedEc} onPlayAgain={onPlayAgain} onClose={onClose} />}
      </div>
    </div>
  );
}
