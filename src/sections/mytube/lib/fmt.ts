/* fmt.ts del POC (smarty-poc app/src/lib/fmt.ts), TAL CUAL: duración (segundos → "2:03" / "41:30" / "1:02:03") y fecha
   corta en es-AR ("12 oct 2026"). */
export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function fmtFecha(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}
