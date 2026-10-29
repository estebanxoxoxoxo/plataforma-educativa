/** Qué secciones van en la barra inferior del teléfono (RESPONSIVE.md §2.2, decisiones D1/D2 del 28-oct). Pura: la
 *  usa BottomNav con los ítems que el menú YA filtró (candados del chico, ciclo del día, solo-adulto: useNavItems en
 *  Sidebar.tsx), así las reglas no se duplican.
 *  · `visible`: los ítems del menú que el usuario ve, en el orden del menú.
 *  · `prefs`: la lista de preferencia (p. ej. Feed · Buscar · MyTube · Aprender).
 *  · `menuOrder`: el orden completo del menú (regla 8), para saber cuál es "la siguiente".
 *  Si una preferida no está (un candado o el ciclo la apagaron), su lugar lo toma la SIGUIENTE visible en el orden del
 *  menú que no esté ya en la barra (si no hay ninguna después, la primera libre). Con menos visibles que lugares, van las
 *  que haya. El resultado respeta el orden relativo del menú. */
export function pickBar<T extends { sec: string }>(
  visible: readonly T[], prefs: readonly string[], menuOrder: readonly string[], slots = 4,
): T[] {
  const has = (sec: string) => visible.some((v) => v.sec === sec);
  const at = (sec: string) => menuOrder.indexOf(sec);
  const chosen = new Set(prefs.filter(has).slice(0, slots));
  for (const p of prefs) {
    if (chosen.size >= slots) break;
    if (has(p)) continue;
    const free = visible.filter((v) => !chosen.has(v.sec)).sort((a, b) => at(a.sec) - at(b.sec));
    const next = free.find((v) => at(v.sec) > at(p)) ?? free[0];
    if (next) chosen.add(next.sec);
  }
  return visible.filter((v) => chosen.has(v.sec)).sort((a, b) => at(a.sec) - at(b.sec));
}
