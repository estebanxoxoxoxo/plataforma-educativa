// Subtítulo del Feed v6 debajo del saludo: "Lunes a la tarde · lo más nuevo primero". Mismos cortes que la edición del
// server (server/src/feedFake.ts: mañana desde las 6, tarde desde las 13, noche desde las 20; la madrugada todavía es la
// noche del día anterior), así el subtítulo y el "Tu tarde de lunes" del resumen dicen lo mismo.
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function daypartLine(d = new Date()): string {
  const h = d.getHours();
  const part = h >= 6 && h < 13 ? 'a la mañana' : h >= 13 && h < 20 ? 'a la tarde' : 'a la noche';
  return `${DAYS[(d.getDay() + (h < 6 ? 6 : 0)) % 7]} ${part}`;
}
