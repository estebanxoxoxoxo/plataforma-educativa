import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../../api';
import type { CycleRange, User } from '../../../api/types';
import { CycleDemoPicker } from '../components/CycleDemoPicker';
import { adoptCycle, refreshCycle, useCycle, useMemberCycle } from '../lib/cycle';
import { pickMember, useFamilyMembers } from '../lib/member';

/** El selector "Ciclo (demo)" de la página de Configuración (antes vivía en el Sidebar; pedido de Esteban, 30-oct:
 *  «pasá lo de ciclo demo al perfil del usuario»). Tanda F2, docs/USUARIOS.md §11: para la demo, en qué rango del día está el
 *  usuario. Solo dispara POST /api/demo/cycle {rangeId} y ADOPTA la respuesta del server (adoptCycle: el menú y la ruta
 *  cambian al instante, sin recargar); nada de lógica simulada en el cliente (regla 9). RAM del server: cada F5 del chico
 *  vuelve al reloj real.
 *  CUÁNDO APARECE (decisión F2):
 *  · CHICO activo → con SU ciclo (el store del usuario activo), si tiene al menos un rango (sin rangos no hay nada que
 *    simular: todo está disponible siempre).
 *  · ADULTO activo → con el ciclo del integrante de `?m=` si la URL lo trae (viniendo de Familia) o, si no, el PRIMERO,
 *    y con su nombre ("Ciclo de Luna (demo)"); manda `?member=`. Así el adulto arma el ciclo en Familia → Ciclo del
 *    día, elige "Tarde" para Luna y, al cambiar a Luna con el switch (que no resetea la demo), la encuentra en ese
 *    rango. (El portón por ruta /familia* murió con la mudanza a Configuración: acá siempre hay lugar para decirlo.) */
export function CycleDemoControl({ user }: { user?: User }) {
  if (!user) return null;
  if (user.kind === 'adult') return <AdultCycleDemo adultId={user.id} />;
  return <KidCycleDemo />;
}

/** Elegir un rango: el POST de demo y la adopción de su respuesta (con el adulto, del integrante `member`). */
function useChoose(member?: string) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const choose = async (rangeId: string | null) => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      adoptCycle(await api.demoCycle(rangeId, member));
    } catch {
      setFailed(true);
      if (!member) void refreshCycle(); // p. ej. el padre borró ese rango recién: se relee lo vigente
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, choose };
}

function KidCycleDemo() {
  const s = useCycle();
  const { busy, failed, choose } = useChoose();
  if (!s.ranges?.length) return null;
  return <CycleDemoPicker caption="Ciclo (demo)" ranges={s.ranges} value={s.demoRange} busy={busy} failed={failed} onChoose={(id) => void choose(id)} />;
}

function AdultCycleDemo({ adultId }: { adultId: string }) {
  const { search } = useLocation();
  const { members } = useFamilyMembers(adultId);
  const member = members?.length ? pickMember(members, new URLSearchParams(search).get('m')) : null;
  const { cycle } = useMemberCycle(member?.id ?? null);
  const { busy, failed, choose } = useChoose(member?.id);
  const ranges: CycleRange[] = cycle?.ranges ?? [];
  if (!member || !ranges.length) return null;
  return <CycleDemoPicker caption={`Ciclo de ${member.name} (demo)`} ranges={ranges} value={cycle?.demoRange ?? null}
    busy={busy} failed={failed} onChoose={(id) => void choose(id)} />;
}
