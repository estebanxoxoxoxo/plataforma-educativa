import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AfterDayTrack } from '../../../api/types';
import { pauseMusic, resumeMusic, useBgAudio } from '../../../shared/audio/bgAudio';
import { ytCommand, ytSubscribe } from '../../../shared/lib/ytBridge';

/** "Ver" un track de After Day (extensión Innerith, pedido 14-oct: "pueden ser audios o videos" — el POC
 *  era SOLO audio en todas sus superficies). Overlay contenido con la MISMA jaula que los videos de Learn:
 *  youtube-nocookie + sandbox sin popups/navegación + desmute por jsapi en onReady. Si el fondo estaba
 *  sonando, se PAUSA al abrir y se reanuda al cerrar (solo si lo pausamos nosotros). Esc o ✕ cierran. */
export function AdWatch({ track, onClose }: { track: AfterDayTrack; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bg = useBgAudio();
  const pausedByUs = useRef(false);
  const wasPlaying = useRef(bg.playing);

  useEffect(() => {
    if (wasPlaying.current) { pauseMusic(); pausedByUs.current = true; }
    return () => { if (pausedByUs.current) resumeMusic(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <button type="button" className="adw-x" onClick={onClose}>✕ Cerrar</button>
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
