import { useEffect, useState } from 'react';
import type { Video } from '../../../api/types';
import { IcPCC, IcPFull, IcPGear, IcPNext, IcPPause, IcPPlay, IcPVol } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function VideoPlayer({ v }: { v: Video }) {
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => (x + 1 >= v.durationSec ? (setPlaying(false), v.durationSec) : x + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, v.durationSec]);

  return (
    <div className={`player ${playing ? 'playing' : 'playing paused'}`}>
      <div className="pframe" onClick={() => setPlaying((p) => !p)}><img className="ph-img" src={imgSrc(v.img)} alt="" /></div>
      <div className="pctrl">
        <div className="vbar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setT(Math.round(((e.clientX - r.left) / r.width) * v.durationSec)); }}>
          <span className="buf" /><span className="pl" style={{ width: `${(t / v.durationSec) * 100}%` }} />
        </div>
        <div className="prow">
          <button aria-label={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying((p) => !p)}>{playing ? <IcPPause /> : <IcPPlay />}</button>
          <button aria-label="Siguiente"><IcPNext /></button>
          <button aria-label="Volumen"><IcPVol /></button>
          <span>{mmss(t)} / {mmss(v.durationSec)}</span>
          <IcPCC className="sp" />
          <IcPGear />
          <IcPFull />
        </div>
      </div>
    </div>
  );
}
