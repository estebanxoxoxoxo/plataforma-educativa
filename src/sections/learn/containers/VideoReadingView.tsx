import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ytCommand, ytSubscribe } from '../../../shared/lib/ytBridge';
import { useOverlay } from '../lib/overlayNav';

/* Fase "video" del overlay de actividad (Opción B para módulos de video): reproduce un video de
   YouTube por videoId SIN ingestarlo (no necesita db.ytVideos) como 1ª posta del módulo, con la
   MISMA contención de seguridad que VideoPlayer (youtube-nocookie + sandbox SIN allow-popups /
   allow-top-navigation → no puede abrir popups ni sacar al chico del sitio). Controles nativos de
   YouTube para que el chico mire/pause; botón CTA para pasar a las preguntas. useOverlay da z-index
   + "Volver" por historial. */

/* PORTE INNERITH (W3): port de smarty-poc app/src/zones/child/VideoReadingView.tsx — componente PROPIO de la sección (no
   el VideoPlayer del catálogo: este video NO pasa por la lista aprobada de MyTube, trampa 28 del informe 02, fiel), con el
   puente ytBridge de Innerith (mismas firmas). Tope de volumen: el POC aplica `settings.maxVolVideo` (default 100 = sin
   tope); en Innerith no existe un tope para videos en primer plano (el de Límites es SOLO de la música de fondo, y el
   reproductor del catálogo tampoco lo aplica) → queda en 100, el default del POC. Lo usan la fase video de una posta
   ("Empezar preguntas →") y el guidebook del módulo ("✕ Cerrar"). */
export function VideoReadingView({ videoId, title, onClose, ctaLabel, onCta }: {
  videoId: string;
  title: string;
  onClose: () => void;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const { close, z } = useOverlay(onClose);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const origin = encodeURIComponent(location.origin);
  // controls nativos (a diferencia del embed de audio de fondo, controls=0); rel=0 limita el
  // end-screen a este canal; nocookie + modestbranding. La contención real la da el sandbox.
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${origin}&autoplay=1&rel=0&playsinline=1&iv_load_policy=3&modestbranding=1`;
  const advance = onCta ?? close;

  // Des-mutear el YT-API mute en onReady (por si el autoplay arrancó muteado). Comandar antes de onReady
  // crashea (isExternalMethodAvailable). Filtrar por e.source. El mute a nivel-navegador (por audio de escena
  // compitiendo) NO lo arregla esto → eso lo evita el corte rápido de la escena (sceneDirector). Espejo de VideoPlayer.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!String(e.origin).includes('youtube')) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.event === 'onReady') {
          ytCommand(iframeRef.current, 'unMute');
          ytCommand(iframeRef.current, 'setVolume', [100]); // sin tope de video en Innerith (ver la cabecera)
          ytCommand(iframeRef.current, 'playVideo');
        }
      } catch { /* mensaje ajeno */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return createPortal(
    <div className="ln-ov ln-vid" style={{ zIndex: z }}>
      <header className="ln-vid-head">
        <button type="button" className="ln-vid-cta" onClick={advance}>{ctaLabel ?? '✕ Volver'}</button>
        <p className="ln-vid-t">{title}</p>
      </header>

      <div className="ln-vid-stage">
        <div className="ln-vid-frame">
          <iframe
            ref={iframeRef}
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => ytSubscribe(iframeRef.current)} // suscribirse para recibir onReady (NO comandar aún)
          />
        </div>
      </div>

      <footer className="ln-vid-foot">
        <span>Mirá el video y después seguí con las preguntas</span>
        <button type="button" className="ln-btn ln-btn-go" onClick={advance}>
          {ctaLabel ?? 'Empezar preguntas →'}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
