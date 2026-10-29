import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AfterDayTrack } from '../../../api/types';
import { getBgState, pauseMusic, resumeMusic } from '../../../shared/audio/bgAudio';
import { ytCommand, ytSubscribe } from '../../../shared/lib/ytBridge';
import { useReturnFocus } from '../../store/lib/sheet';
import { resumeAfterWatch } from '../lib/trackAudio';

/** "Ver" un track de After Day (extensión Innerith, pedido 14-oct: "pueden ser audios o videos" — el POC
 *  era SOLO audio en todas sus superficies). Overlay contenido con la MISMA jaula que los videos de Learn:
 *  youtube-nocookie + sandbox sin popups/navegación + desmute por jsapi en onReady. Si el fondo estaba
 *  sonando, se PAUSA al abrir. Al cerrar (29-oct, pedido de Esteban: «no lo puedo frenar»): si lo que sonaba era ESTE
 *  mismo track queda en PAUSA (el chico lo pasó a video); si era otro, se reanuda como antes (resumeAfterWatch). Esc o ✕
 *  cierran. Los refs sobreviven el doble efecto de StrictMode: el 2.º montaje vuelve a pausar lo mismo. */
export function AdWatch({ track, onClose }: { track: AfterDayTrack; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bg = getBgState();
  // El fondo al ABRIR: qué track sonaba (null = nada sonando), y si lo pausamos nosotros.
  const openedWith = useRef(bg.playing ? (bg.video?.id ?? null) : null);
  const pausedByUs = useRef(false);

  useEffect(() => {
    if (openedWith.current !== null) { pauseMusic(); pausedByUs.current = true; }
    return () => {
      if (pausedByUs.current && resumeAfterWatch(openedWith.current, track.videoId, getBgState())) resumeMusic();
    };
  }, [track.videoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal sin foco ADENTRO deja al lector de pantalla parado en la página de fondo: al abrir, el foco entra al ✕;
  // al cerrar vuelve a quien abrió — useReturnFocus, el patrón de la casa (con sheetOpener: Safari no enfoca el botón al
  // clickearlo, así que mirar document.activeElement al montar daba <body> y el foco se perdía).
  useReturnFocus();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  // Espejo de VideoReadingView: desmutear recién en onReady (comandar antes crashea el player).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!String(e.origin).includes('youtube')) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.event === 'onReady') {
          ytCommand(iframeRef.current, 'unMute');
          ytCommand(iframeRef.current, 'setVolume', [100]);
          ytCommand(iframeRef.current, 'playVideo');
        }
      } catch { /* mensaje ajeno */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const origin = encodeURIComponent(location.origin);
  const src = `https://www.youtube-nocookie.com/embed/${track.videoId}?enablejsapi=1&origin=${origin}&autoplay=1&rel=0&playsinline=1&iv_load_policy=3&modestbranding=1`;
  return createPortal(
    <div className="adw" role="dialog" aria-modal="true" aria-label={track.title || 'Video'}>
      <header className="adw-head">
        <button type="button" className="adw-x" ref={closeRef} onClick={onClose}>✕ Cerrar</button>
        <p className="adw-t">{track.title || 'Video'}</p>
      </header>
      <div className="adw-stage">
        <div className="adw-frame">
          <iframe
            ref={iframeRef}
            src={src}
            title={track.title || 'Video'}
            allow="autoplay; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => ytSubscribe(iframeRef.current)}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
