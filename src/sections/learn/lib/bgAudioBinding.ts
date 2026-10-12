import { bindBgAudio } from '../../../learn/audio/bgAudioPort';
import { duckForForeground, getBgState, playTrack, setMusicVolumeTransient, unduck } from '../../../shared/audio/bgAudio';

/* Enchufa el SceneDirector de Learn (src/learn/audio/sceneDirector.ts, portado FIEL por W2 y montado acá en W3) a la
   música de fondo REAL del chico: el MiniPlayer de Innerith (shared/audio/bgAudio). Mismas firmas que el
   lib/backgroundAudio del POC (ver bgAudioPort.ts): el director baja el fondo con fade en lectura/actividad/ganó/perdió,
   lo pausa en video y en la escena 'ruta' (fade a 0 + pausa), y lo restaura (des-pausa + sube suave) al vaciarse su pila
   — al salir de la ruta/del overlay o de Learn. `playMusic` solo lo usa el helper de debug del director. */

let bound = false;

export function bindLearnBgAudio(): void {
  if (bound) return;
  bound = true;
  bindBgAudio({
    getBgState: () => {
      const s = getBgState();
      return { playing: s.playing, volume: s.volume, ducked: s.ducked };
    },
    setMusicVolumeTransient,
    duckForForeground,
    unduck,
    playMusic: (video, fromSeconds = 0) => playTrack({ id: video.videoId, title: video.videoId }, fromSeconds),
  });
}
