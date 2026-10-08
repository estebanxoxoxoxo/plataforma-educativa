import { useEffect, useRef, useState } from 'react';
import type { Video } from '../../../api/types';
import { IcPCC, IcPFull, IcPGear, IcPNext, IcPPause, IcPPlay, IcPVol, IcPlayDark } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';
import { parseYtMessage, ytCommand, ytEmbedUrl, ytSubscribe, type YtState } from '../../../shared/lib/ytBridge';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* Reproductor limpio: YouTube nocookie contenido (sandbox, sin clics directos) con controles propios.
   En pausa o al terminar, una cortina tapa el player (en YouTube ahí aparecen sugerencias de otros videos). */
export function VideoPlayer({ v, onEnded, onTime }: { v: Video; onEnded?: () => void; onTime?: (t: number) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<YtState>('buffering');
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(v.durationSec || 0);
  const [muted, setMuted] = useState(false);
  // Aviso de fin (para el auto-avance de una cola): una sola vez por video, sin closures viejos.
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;
  const firedEnd = useRef(false);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = parseYtMessage(e);
      if (!m) return;
      if (m.state) {
        setState(m.state);
        if (m.state === 'ended' && !firedEnd.current) { firedEnd.current = true; endedRef.current?.(); }
        if (m.state === 'playing') firedEnd.current = false;
      }
      if (m.currentTime != null) { setT(m.currentTime); onTimeRef.current?.(m.currentTime); }
      if (m.duration) setDur(m.duration);
      if (m.muted != null) setMuted(m.muted);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  const playing = state === 'playing' || state === 'buffering';
  const toggle = () => {
    if (state === 'ended') { ytCommand(frame.current, 'seekTo', [0, true]); ytCommand(frame.current, 'playVideo'); return; }
    ytCommand(frame.current, playing ? 'pauseVideo' : 'playVideo');
  };
  const seek = (sec: number) => { ytCommand(frame.current, 'seekTo', [sec, true]); setT(sec); };
  const covered = state === 'paused' || state === 'ended';

  return (
    <div className="player" ref={box}>
      <div className="pframe">
        <iframe
          ref={frame}
          src={ytEmbedUrl(v.id)}
          title={v.title}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => ytSubscribe(frame.current)}
        />
      </div>
      {covered
        ? <div className="pcover" style={{ backgroundImage: `url(${imgSrc(v.img)})` }} onClick={toggle}><span className="big"><IcPlayDark /></span></div>
        : <div className="pclick" onClick={toggle} />}
      <div className="pctrl">
        <div className="vbar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(Math.round(((e.clientX - r.left) / r.width) * dur)); }}>
          <span className="buf" /><span className="pl" style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%` }} />
        </div>
        <div className="prow">
          <button aria-label={playing ? 'Pausar' : 'Reproducir'} onClick={toggle}>{playing ? <IcPPause /> : <IcPPlay />}</button>
          <button aria-label="Adelantar 10 segundos" onClick={() => seek(Math.min(dur, t + 10))}><IcPNext /></button>
          <button aria-label={muted ? 'Activar sonido' : 'Silenciar'} onClick={() => { ytCommand(frame.current, muted ? 'unMute' : 'mute'); setMuted(!muted); }} style={{ opacity: muted ? 0.5 : 1 }}><IcPVol /></button>
          <span>{mmss(t)} / {mmss(dur)}</span>
          <IcPCC className="sp" />
          <IcPGear />
          <button aria-label="Pantalla completa" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())}><IcPFull /></button>
        </div>
      </div>
    </div>
  );
}
