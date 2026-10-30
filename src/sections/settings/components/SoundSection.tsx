import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { AMBIENTS } from '../../../shared/audio/ambientNoise';
import { setAmbientVolume, setMusicVolume, toggleAmbient, useBgAudio } from '../../../shared/audio/bgAudio';
import { refreshLimits, useLimits } from '../../parent/lib/limits';
import { CfgSection } from './CfgSection';

/** Sonido (tanda CONFIG, 30-oct). Son LOS MISMOS controles que el panel del MiniPlayer de la barra, sobre los mismos stores:
 *  bgAudio (lo que suena y lo que eligió el chico, persistido) y los topes de la familia (parent/lib/limits). Acá no hay
 *  ninguna regla propia: los sliders llegan hasta el tope (max = tope), muestran min(elegido, tope) y el "máx. N" sale igual
 *  que en el MiniPlayer (pz-cap). setMusicVolume/setAmbientVolume ya recortan al tope y guardan. La música se puede ajustar
 *  aunque no suene nada (el MiniPlayer solo la muestra con algo cargado): queda guardada para la próxima. */
/** «Ruido blanco» → «Blanco»: el chip ya está bajo «Ruidos para concentrarte» (el MiniPlayer lo deja en minúscula). */
const chipName = (label: string) => { const s = label.replace('Ruido ', ''); return s.charAt(0).toUpperCase() + s.slice(1); };

export function SoundSection({ adult }: { adult: boolean }) {
  const bg = useBgAudio();
  const caps = useLimits();
  const musicId = useId();
  // Como al abrir el MiniPlayer: los topes frescos al entrar (el padre pudo cambiarlos desde otro dispositivo).
  useEffect(() => { void refreshLimits(); }, []);
  const music = Math.min(bg.volume, caps.maxMusic);

  return (
    <CfgSection
      title="Sonido"
      lede={adult
        ? <>Los topes de volumen de cada chico se ponen en <Link to="/familia/limites">Familia → Límites</Link>.</>
        : 'El volumen máximo lo pone tu familia en Familia → Límites.'}
    >
      <div className="cfg-vol">
        <div className="cfg-vol-h">
          <label className="cfg-row-t" htmlFor={musicId}>Música de fondo</label>
          {caps.maxMusic < 100 && <small className="pz-cap" title="Volumen máximo que eligió tu familia">máx. {caps.maxMusic}</small>}
          <span className="cfg-vol-n" aria-hidden="true">{music}</span>
        </div>
        <input id={musicId} className="cfg-range" type="range" min={0} max={caps.maxMusic} value={music}
          onChange={(e) => setMusicVolume(Number(e.target.value))} aria-describedby={`${musicId}-d`} />
        <p className="cfg-help" id={`${musicId}-d`}>La música que ponés para escuchar mientras hacés otra cosa (After Day, «Escuchar de fondo»).</p>
      </div>

      <div className="cfg-vol">
        <div className="cfg-vol-h">
          <span className="cfg-row-t">Ruidos para concentrarte</span>
          {caps.maxNoise < 100 && <small className="pz-cap" title="Volumen máximo que eligió tu familia">máx. {caps.maxNoise}</small>}
        </div>
        {AMBIENTS.map((a) => {
          const st = bg.ambient[a.key];
          const v = Math.min(st.volume, caps.maxNoise);
          return (
            <div key={a.key} className="cfg-amb">
              <button type="button" className="cfg-chip" aria-pressed={st.on} onClick={() => toggleAmbient(a.key)}
                aria-label={`${a.label}: ${st.on ? 'sonando' : 'apagado'}`}>
                <span aria-hidden="true">{a.emoji}</span>{chipName(a.label)}
              </button>
              <input className={`cfg-range${st.on ? '' : ' off'}`} type="range" min={0} max={caps.maxNoise} step={1} value={v}
                onChange={(e) => setAmbientVolume(a.key, Number(e.target.value))} aria-label={`Volumen ${a.label}`} />
              <span className="cfg-vol-n" aria-hidden="true">{v}</span>
            </div>
          );
        })}
        <p className="cfg-help">Tocá uno para prenderlo o apagarlo. Suenan junto con la música.</p>
      </div>
    </CfgSection>
  );
}
