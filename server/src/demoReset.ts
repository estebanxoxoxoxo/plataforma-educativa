// Lo que index.ts corre ANTES de rutear y toca la semana de la liga de la FAMILIA (revisión de U5, "el bug del lunes").
// Vive aparte de index.ts —que levanta el server al cargar— para poder probarlo (server/src/__tests__/familyMonday.test.ts).
//   · demoReset(meId, all) — POST /api/demo/reset: vuelve al seed al usuario ACTIVO (o a TODOS con {scope:'all'}) en el orden
//     de siempre —progreso, Tienda, amigos, liga pública, feed, ciclo del día, portón; con 'all' también la semana de la
//     familia— y las medallas AL FINAL (se re-derivan de los hechos ya re-sembrados). Sin 'all', ANTES de re-sembrar al que
//     abre, cierra la semana de la familia si quedó PENDIENTE (el server cruzó el lunes de la familia y nadie la leyó todavía):
//     abrir la app es una carga de página y cada carga resetea PRIMERO al activo (src/hooks/user.tsx); si la foto del cierre
//     se sacara después, tomaría su "semana pasada" del SEED (weekStart = lunes − 7: cae por construcción justo en la semana
//     abierta de la familia) en vez de su semana real —Ian, con 1.240 contra 1.180, entraba con 1.180, sin ↑ y sin el premio—.
//     El reset del activo corre ENTRE la foto y el reparto (familyCloseIfDue con `afterPhoto`): lo que ese cierre le da a él
//     —el canje del premio, la copa— entra DESPUÉS de su re-siembra y no se lo come su propio F5. Lo que sale de SU progreso
//     en RAM ("Superaste tu semana" y "Semana completa" de ese corte) vuelve al seed con él (§5.6: "tu F5 es tu demo nueva").
//   · readsFamilyWeek / closeFamilyWeekIfRead — el cierre real perezoso en los cuatro LECTORES de lo que produce
//     (/api/leagues/*, /api/parent/activity, /api/market/redemptions, /api/medals*), antes de los candados (Ligas apagadas,
//     Ciclo del día): cerrar la semana no le muestra nada a quien la dispara.
// Importa lo mismo que ya importaba index.ts para el reset (nadie importa este módulo salvo index.ts y los tests).
import { resetFeed } from './feedFake'
import { resetFriends } from './friendsFake'
import { familyCloseIfDue, resetFamilyWeeks, resetLeagues } from './leaguesFake'
import { resetMarket } from './market'
import { resetMedals } from './medals'
import { resetUnlockAttempts } from './parent'
import { resetProgress } from './progress'
import { resetCycleDemo } from './schedule'

/** POST /api/demo/reset: `all` = {scope:'all'} (QA: todos los usuarios y la semana de la familia). Devuelve si antes cerró la
 *  semana de la familia que estaba pendiente (para el log). Un error del cierre no frena el reset; uno del reset, sí (500). */
export function demoReset(meId: string, all: boolean): { closedFamilyWeek: boolean } {
  const id = all ? undefined : meId
  const failed: unknown[] = []
  let done = false
  const resetSlices = () => {
    if (done) return
    done = true
    try {
      resetProgress(id) // XP / ⚡ / racha / movimientos
      resetMarket(id) // canjes y guardarropas (la wishlist persiste)
      resetFriends(id) // el grafo social del demo (amigos aceptados, solicitudes, hilos)
      resetLeagues(id) // el ciclo de la liga pública (los cierres del botón de demo)
      resetFeed(id) // las noticias en vivo (cierres, ráfagas de NPCs) y las reacciones
      resetCycleDemo(id) // el "estás en este rango" del Ciclo del día (F1) vuelve al reloj real
      resetUnlockAttempts() // del portón dormido de la FAMILIA: da igual el alcance
      // U5-A: la semana de la FAMILIA (historial, premio, copas) es RAM de la familia, como los avisos al padre: el F5 de UNO
      // no la toca (si no, la recarga de Ian le borraría a Luna el historial y el premio que puso Andrés).
      if (all) resetFamilyWeeks()
      // U5-B: las medallas AL FINAL: se re-siembran EN EL ACTO desde los hechos ya re-sembrados (las de Learn, Mi espacio y
      // el catálogo salen de lo persistido: sobreviven; la copa se re-deriva de las copas de la familia). Todo queda visto.
      resetMedals(id)
    } catch (e) { failed.push(e) }
  }
  let closedFamilyWeek = false
  if (!all) {
    try { closedFamilyWeek = familyCloseIfDue(meId, resetSlices) }
    catch (e) { console.error('[demo] el cierre real de la semana de la familia falló (el reset sigue igual):', e) }
  }
  resetSlices() // si no había cierre pendiente (o falló antes de la foto), el reset de siempre
  if (failed.length) throw failed[0]
  return { closedFamilyWeek }
}

/** ¿Este pedido LEE lo que produce el cierre de la semana de la familia? (spec U5 §2.3 y §6.2: los cuatro lectores) */
export const readsFamilyWeek = (pathname: string): boolean =>
  pathname.startsWith('/api/leagues/') || pathname === '/api/parent/activity'
  || pathname === '/api/market/redemptions' || pathname === '/api/medals' || pathname.startsWith('/api/medals/')

/** El cierre real perezoso antes de rutear un lector (y antes de los candados). Un error acá no tumba el pedido. Devuelve si
 *  cerró. */
export function closeFamilyWeekIfRead(pathname: string, meId: string): boolean {
  if (!readsFamilyWeek(pathname)) return false
  try { return familyCloseIfDue(meId) }
  catch (e) { console.error('[leagues] el cierre real de la semana de la familia falló:', e); return false }
}
