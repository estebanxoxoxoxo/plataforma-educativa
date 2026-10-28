// U3 · M2 (docs/USUARIOS.md §9): a qué integrante de la familia se está configurando en Familia. El adulto elige con el
// selector de la cabecera (MemberPicker) y la elección vive en la URL como `?m=<id>` —persistente entre solapas, se puede
// compartir como link (/familia/temas?m=luna)—. Sin `?m=` o con uno que no es de la familia: el PRIMER integrante, y la URL
// se canonicaliza (replace, sin sumar historia). Lo de este archivo que no es un hook es puro (tests en __tests__/member.test.ts).
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import type { FamilyMember, UserInfo } from '../../../api/types';

/** Las solapas que son de TODA la familia: el selector no aplica (se ve deshabilitado, con su nota). */
export const FAMILY_WIDE: ReadonlySet<string> = new Set(['/familia/youtube', '/familia/mentorias']);
/** Nota del selector en cada solapa de familia. */
export const FAMILY_NOTE: Record<string, string> = {
  '/familia/youtube': 'YouTube y la música de After Day valen para toda la familia.',
  '/familia/mentorias': 'Las mentorías son de toda la familia: cada una dice para quién es (también las tuyas).',
};

/** Los integrantes que configura el adulto `me`: sus `dependents`, en su orden (los ids que no están en `users` se saltean). */
export function membersOf(users: UserInfo[], me: string | undefined): FamilyMember[] {
  const deps = users.find((u) => u.id === me)?.dependents ?? [];
  return deps.flatMap((id) => {
    const u = users.find((x) => x.id === id);
    return u ? [{ id: u.id, name: u.name, age: u.age, nick: u.nick }] : [];
  });
}

/** El integrante que pide `raw` (el `?m=`: trim + minúsculas, como el `?member=` del server); ausente, vacío o ajeno → el
 *  primero. `members` no puede estar vacío. */
export function pickMember(members: FamilyMember[], raw: string | null): FamilyMember {
  const want = (raw ?? '').trim().toLowerCase();
  return members.find((m) => m.id === want) ?? members[0];
}

/** Link a una solapa de Familia con el integrante elegido (el resto de la query no viaja: cada solapa arranca limpia). */
export const famTo = (path: string, member: string) => ({ pathname: path, search: `?m=${encodeURIComponent(member)}` });

/** Los integrantes del adulto activo (GET /api/users, una vez por montaje). `members === null` = cargando. */
export function useFamilyMembers(me: string | undefined): { members: FamilyMember[] | null; failed: boolean; retry: () => void } {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!me) return;
    let alive = true;
    setFailed(false);
    api.users().then(
      (r) => { if (alive) setMembers(membersOf(r.users, me)); },
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, [me, round]);
  const retry = useCallback(() => setRound((n) => n + 1), []);
  return { members, failed, retry };
}

/** El integrante elegido (`?m=`) y cómo elegir otro. Elegir empuja una entrada de historia (Atrás vuelve al anterior) y
 *  conserva el resto de la query; un `?m=` ausente o inválido se reemplaza por el del primero. */
export function useSelectedMember(members: FamilyMember[]): [FamilyMember, (id: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('m');
  const member = pickMember(members, raw);
  useEffect(() => {
    if (raw === member.id) return;
    setParams((p) => { const n = new URLSearchParams(p); n.set('m', member.id); return n; }, { replace: true });
  }, [raw, member.id, setParams]);
  const current = member.id;
  const pick = useCallback((id: string) => {
    if (id === current || !members.some((m) => m.id === id)) return;
    setParams((p) => { const n = new URLSearchParams(p); n.set('m', id); return n; });
  }, [current, members, setParams]);
  return [member, pick];
}
