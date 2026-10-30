import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cycleRepeat, nextTrack, pauseMusic, prevTrack, restartMusic, resumeMusic,
  seekMusic, setAmbientVolume, setMusicVolume, stopMusic, toggleAmbient, useBgAudio,
} from '../audio/bgAudio';
import { AMBIENTS } from '../audio/ambientNoise';
import { refreshLimits, useLimits } from '../../sections/parent/lib/limits';
import { IcBgHeadphones, IcClose, IcPause, IcPlay, IcRepeat, IcSkipNext, IcSkipPrev } from './icons';

const fmtT = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };

/** Mini-control de SONIDO DE FONDO (port del MiniPlayer de Smarty). Desde SHELL-2 (pedido 30-oct) el disparador es el 🎧
 *  de la tarjeta de perfil (ProfileCard lo embebe entre el nombre y la liga): ícono SIN texto visible («sin indicar con
 *  palabras qué es»), con el nombre accesible de siempre. Tres estados visuales (data-state, shell.css): «on» coloreado con
 *  el puntito que late (algo suena: música o un ruido), «paused» con una marca de pausa (hay música cargada en pausa) e
 *  «idle» neutro (nada cargado). El panel se abre ENCIMA de la tarjeta (.profile es su ancla: .mp no se posiciona) y su
 *  lógica no cambió: música (cola) y ruidos de ambiente, cada uno con su volumen. Lee/controla el singleton bgAudio. */
export function MiniPlayer() {
  const bg = useBgAudio();
  const caps = useLimits(); // topes de volumen de la familia (Familia → Límites): los sliders no pasan de ahí
  const go = useNavigate();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) void refreshLimits(); }, [open]);

  // Cerrar al clickear fuera (incluye tocar una sección del menú).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Interpolar la posición entre reportes de YouTube para que la barra avance suave.
  const [scrub, setScrub] = useState<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open || !bg.playing || !bg.video) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 500);
    return () => clearInterval(id);
  }, [open, bg.playing, bg.video]);
  const shown = bg.playing && scrub == null && bg.at > 0
    ? Math.min(bg.duration || Infinity, bg.currentTime + (Date.now() - bg.at) / 1000)
    : bg.currentTime;

  const anyAmbient = AMBIENTS.some((a) => bg.ambient[a.key].on);
  const activo = bg.playing || anyAmbient;

  return (
    <div className="mp" ref={panel}>
      <button type="button" className="mp-hp" data-state={activo ? 'on' : bg.video ? 'paused' : 'idle'} aria-expanded={open}
        aria-label={bg.video ? `Sonido de fondo: ${bg.playing ? 'sonando' : 'en pausa'}` : 'Sonido de fondo'} onClick={() => setOpen((o) => !o)}>
        <IcBgHeadphones />
        {/* Con el play/pausa en la tarjeta de After Day (29-oct) el fondo puede quedar EN PAUSA un rato largo: la marca de
            pausa lo distingue de «sonando» (puntito que late) y de «nada» (neutro). */}
        {activo && <i className="mp-dot" />}
        {!activo && bg.video && <i className="mp-pz" />}
      </button>

      {open && (
        <div className="mp-panel">
          {bg.video && (
            <div className="mp-music">
              <p className="mp-title">🎵 {bg.video.title}</p>
              {bg.queue.length > 1 && <p className="mp-queue">Pista {bg.index + 1} de {bg.queue.length}</p>}
              <div className="mp-row">
                {bg.queue.length > 1
                  ? <button className="mp-b" aria-label="Anterior" onClick={prevTrack}><IcSkipPrev /></button>
                  : <button className="mp-b" aria-label="Reiniciar" onClick={restartMusic}><IcSkipPrev /></button>}
                <button className="mp-b main" aria-label={bg.playing ? 'Pausar' : 'Reproducir'} onClick={() => (bg.playing ? pauseMusic() : resumeMusic())}>
                  {bg.playing ? <IcPause /> : <IcPlay />}
                </button>
                {bg.queue.length > 1 && <button className="mp-b" aria-label="Siguiente" onClick={nextTrack}><IcSkipNext /></button>}
                <button className={`mp-b${bg.repeat !== 'off' ? ' mpa' : ''}`} onClick={cycleRepeat}
                  aria-label={`Repetir: ${bg.repeat === 'off' ? 'no' : bg.repeat === 'one' ? 'una' : 'todas'}`}>
                  <IcRepeat />{bg.repeat === 'one' && <b className="mp-one">1</b>}
                </button>
                {/* After Day (audioOnly, como el MiniPlayer del POC): solo audio de fondo, nunca a pantalla completa. */}
                {!bg.audioOnly && (
                  <button className="mp-b" aria-label="Abrir el video" onClick={() => { go(`/buscar/video/${bg.video!.id}`); setOpen(false); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" /></svg>
                  </button>
                )}
                <button className="mp-b stop" aria-label="Parar el audio" onClick={stopMusic}><IcClose /></button>
              </div>
              {bg.duration > 0 && (
                <div className="mp-seek">
                  <input type="range" min={0} max={Math.floor(bg.duration)} value={Math.floor(Math.min(scrub ?? shown, bg.duration))}
                    onChange={(e) => setScrub(Number(e.target.value))}
                    onPointerUp={() => { if (scrub != null) { seekMusic(scrub); setScrub(null); } }}
                    onPointerCancel={() => setScrub(null)} aria-label="Posición del audio" />
                  <div className="mp-times"><span>{fmtT(scrub ?? shown)}</span><span>{fmtT(bg.duration)}</span></div>
                </div>
              )}
              <div className="mp-vol">
                <span className="mp-vlbl">Vol</span>
                <input type="range" min={0} max={caps.maxMusic} value={Math.min(bg.volume, caps.maxMusic)} onChange={(e) => setMusicVolume(Number(e.target.value))} aria-label="Volumen de la música" />
                {caps.maxMusic < 100 && <small className="pz-cap" title="Volumen máximo que eligió tu familia">máx. {caps.maxMusic}</small>}
              </div>
            </div>
          )}

          <div className={`mp-amb${bg.video ? ' sep' : ''}`}>
            <p className="mp-sub">Ruidos para concentrarte{caps.maxNoise < 100 && <span className="pz-cap" title="Volumen máximo que eligió tu familia"> · máx. {caps.maxNoise}</span>}</p>
            {AMBIENTS.map((a) => {
              const st = bg.ambient[a.key];
              return (
                <div key={a.key} className="mp-arow">
                  <button className={`mp-achip${st.on ? ' on' : ''}`} aria-pressed={st.on} onClick={() => toggleAmbient(a.key)}>
                    <span>{a.emoji}</span>{a.label.replace('Ruido ', '')}
                  </button>
                  <input type="range" min={0} max={caps.maxNoise} step={1} value={Math.min(st.volume, caps.maxNoise)} onChange={(e) => setAmbientVolume(a.key, Number(e.target.value))}
                    className={st.on ? '' : 'off'} aria-label={`Volumen ${a.label}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
