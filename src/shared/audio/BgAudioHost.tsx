import { useEffect, useRef } from 'react';
import { bgHandleMessage, bgOnIframeLoad, bgStartAt, setBgIframe, useBgAudio } from './bgAudio';
import { ytEmbedUrl } from '../lib/ytBridge';

/* Host del reproductor de fondo: monta el iframe OCULTO de YouTube con la MISMA contención que el
   player (sandbox restringido + pointer-events:none), fuera de pantalla pero NO display:none (algunos
   browsers pausan los iframes con display:none). Vive en el Layout → la música sobrevive el cambio de
   sección. Sin UI propia (eso es el MiniPlayer); acá va solo el iframe + el listener de la cola. */
export function BgAudioHost() {
  const { video } = useBgAudio();
  const ref = useRef<HTMLIFrameElement>(null);

  // Registrar/desregistrar el iframe en el singleton (re-registra al remontar por cambio de video).
  useEffect(() => { setBgIframe(ref.current); return () => setBgIframe(null); }, [video?.id]);

  useEffect(() => {
    const on = (e: MessageEvent) => bgHandleMessage(e);
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  if (!video) return null;
  return (
    <iframe
      ref={ref}
      key={video.id}
      src={ytEmbedUrl(video.id, bgStartAt())}
      title="Música de fondo"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={bgOnIframeLoad}
      aria-hidden
      // Fuera de pantalla (no display:none) → suena pero no se ve ni es interactivo.
      style={{ position: 'fixed', left: -10000, top: 0, width: 320, height: 180, pointerEvents: 'none', border: 0 }}
    />
  );
}
