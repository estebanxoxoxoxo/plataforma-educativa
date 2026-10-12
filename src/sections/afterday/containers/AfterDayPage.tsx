import { useEffect, useState } from 'react';
import { api } from '../../../api';
import type { AfterDayTrack } from '../../../api/types';

/** After Day (porte Smarty W6) — ESQUELETO del coordinador: la ruta y el contrato ya están; la tanda W6
 *  la reemplaza por el port exacto de AfterDay.tsx del POC (grilla 2/3/4 del más nuevo al más viejo,
 *  tocar un track = SOLO audio de fondo por el MiniPlayer —nunca video—, el que suena resaltado). */
export function AfterDayPage() {
  const [tracks, setTracks] = useState<AfterDayTrack[] | null>(null);
  useEffect(() => {
    let alive = true;
    api.afterDay().then((r) => { if (alive) setTracks(r.tracks); }, () => { if (alive) setTracks([]); });
    return () => { alive = false; };
  }, []);
  return (
    <section className="view" id="v-afterday">
      <h2 className="h2">After Day</h2>
      <p className="lede">Audio para escuchar de fondo mientras hacés otra cosa. Tocá uno y seguí navegando.</p>
      {tracks !== null && tracks.length === 0 && (
        <p className="ad-empty">Todavía no hay audio acá. Un adulto puede agregarlo desde el panel.</p>
      )}
    </section>
  );
}
