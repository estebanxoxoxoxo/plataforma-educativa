/* Puente con el iframe de YouTube por postMessage (sin window.YT). Port de smarty-poc/app/src/lib/ytBridge.ts.
   SEGURIDAD: el iframe va con sandbox SIN allow-popups/allow-top-navigation + pointer-events:none;
   todos los controles son propios (la app nunca deja tocar la UI de YouTube). */

/** URL del embed con los mismos flags de contención que Smarty (nocookie, sin controles, sin relacionados). */
export function ytEmbedUrl(videoId: string, startAt?: number): string {
  const origin = encodeURIComponent(location.origin);
  const start = startAt && startAt > 1 ? `&start=${Math.floor(startAt)}` : '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${origin}&autoplay=1&controls=0&rel=0&playsinline=1&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1${start}`;
}

export function ytCommand(iframe: HTMLIFrameElement | null | undefined, func: string, args: unknown[] = []): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: 'innerith' }), '*');
}

/** Hay que suscribirse (en el onLoad del iframe) para recibir onStateChange/infoDelivery. */
export function ytSubscribe(iframe: HTMLIFrameElement | null | undefined): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'innerith', channel: 'widget' }), '*');
}

export type YtState = 'playing' | 'paused' | 'ended' | 'buffering' | 'cued';
export type YtMessage = { state?: YtState; currentTime?: number; duration?: number; muted?: boolean };

/** Parsea un mensaje del iframe de YouTube. null si no es del player. */
export function parseYtMessage(e: MessageEvent): YtMessage | null {
  if (!String(e.origin).includes('youtube')) return null;
  try {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (data?.event !== 'onStateChange' && data?.event !== 'infoDelivery') return null;
    const out: YtMessage = {};
    const s = data.event === 'onStateChange' ? data.info : data.info?.playerState;
    if (s === 1) out.state = 'playing';
    else if (s === 2) out.state = 'paused';
    else if (s === 0) out.state = 'ended';
    else if (s === 3) out.state = 'buffering';
    else if (s === 5) out.state = 'cued';
    if (data.event === 'infoDelivery' && data.info) {
      if (typeof data.info.currentTime === 'number') out.currentTime = data.info.currentTime;
      if (typeof data.info.duration === 'number') out.duration = data.info.duration;
      if (typeof data.info.muted === 'boolean') out.muted = data.info.muted;
    }
    return out;
  } catch {
    return null;
  }
}
