# Usuarios: la plataforma es para grandes y chicos (línea 14-oct-2026)

> Pedido de Esteban (14-oct, verbatim resumido): la plataforma es para grandes y chicos. **No cambia
> nada del orden ni del diseño**, pero un adulto puede usarla para él solo, o para él y sus
> dependientes: punto de menú nuevo ABAJO DE TODO (y se quita la Zona de padres) donde configura lo
> del hijo. Los **mentores** le aparecen al adulto en Buscar como un tipo de recurso más; al
> contratar elige si es para él o para un dependiente; la compra tiene **post-compra** donde se
> eligen el/los día/s (la cantidad depende de cuánto pagó). Usuarios demo: un niño y su padre, con
> un botón en la barra superior para switchear (a efectos de demo).

## 1. Modelo

- **Todo usuario usa las mismas secciones** (Feed, Buscar, Chat, MyTube, Aprender, After Day,
  Tienda, Calendario, Mi espacio). Un **adulto** además tiene dependientes y un punto de menú
  propio al fondo: **Familia** (la ex Zona de padres, sin portón de PIN: es SU menú).
- **Los candados son del dependiente, no del adulto**: apagados de funcionalidades (Tienda/Chat/
  Amigos/Ligas) y horarios por sección rigen SOLO cuando el usuario activo es un chico. El adulto
  nunca queda afuera de su propia plataforma.
- Usuarios seed (server, en código — no es config editable):
  - `ian` — Ian, 9, `kind:'child'`, dependiente de `andres`.
  - `andres` — Andrés, 38, `kind:'adult'`, `dependents:['ian']`.

## 2. Usuario activo (demo)

- El cliente guarda el usuario activo en `localStorage['innerith.user']` (default `'ian'`: la app
  arranca como hoy). **TODA llamada a la API** lleva la cabecera **`X-Innerith-User`**
  (src/api/index.ts la pone leyendo localStorage en cada llamada). El server la valida contra el
  seed (`actingUser(req)`; desconocida/ausente → `ian`).
- **Switch**: chip en la TopBar (avatar + nombre del usuario activo + ícono de cambio), a la
  izquierda de la campana. Click → popover (mismo patrón que la campana) con los usuarios de
  `GET /api/users` (avatar `lookFor(nick)` para el que no es el activo), el activo marcado, y la
  nota "Cambiar de usuario (demo)". Elegir otro → setear localStorage + `location.assign('/')`
  (recarga completa: demo reset + estado fresco). A futuro Esteban lo arma mejor; esto es demo.

## 3. Contratos (congelados en esta línea)

```ts
// src/api/types.ts — User se EXTIENDE (aditivo; name/age/nick no cambian):
export type User = { id: string; name: string; age: number; nick: string; kind: 'adult' | 'child' };
export type UserInfo = User & { dependents?: string[] };

// Mentores (reemplazan el contrato viejo de Profesores):
export type MentorPlan = 1 | 2 | 3;                       // clases por semana; precio semanal = plan × pricePerHour
export type MentorContract = {
  id: number; teacherId: string;
  beneficiary: string;                                    // id de usuario (el adulto o un dependiente suyo)
  daysPerWeek: MentorPlan;
  slots: TeacherSlot[];                                   // los días elegidos ([] si está pendiente de agenda)
  status: 'pending' | 'active';                           // pending = pagado, falta elegir los días (post-compra)
};
export type Mentor = Teacher & { contracts: MentorContract[] };  // Teacher pierde hired/slot (quedan los datos de catálogo)
export type TakenSlot = TeacherSlot & { subject: string; mentorName: string };
export type MentorsResponse = {
  mentors: Mentor[];
  /** horas ya ocupadas POR BENEFICIARIO (para tachar en la agenda) */
  taken: Record<string, TakenSlot[]>;
  /** nombres para pintar ("para Ian"): id → nombre */
  people: Record<string, string>;
};
export type ContractResult = { ok: boolean; error?: string; contract?: MentorContract };
export type ScheduleResult = { ok: boolean; error?: string; contract?: MentorContract; eventsAdded?: number };
```

Endpoints:

```
GET  /api/me                        → User (el usuario ACTIVO)                                  (público)
GET  /api/users                     → { users: UserInfo[] }                                     (público)
GET  /api/identity · POST           → por usuario activo (identity.json v2: { users: { id: {look,updatedAt} } }, migra el viejo = ian)
GET  /api/calendar                  → las clases del usuario ACTIVO (beneficiary = acting user)  (público)

GET  /api/mentors                   → MentorsResponse                                            (solo adulto: isAdultReq; chico → 401)
POST /api/mentors/contract {teacherId, daysPerWeek, beneficiary} → ContractResult                (solo adulto; negocio: 200+ok:false)
POST /api/mentors/schedule {contractId, slots: TeacherSlot[]}    → ScheduleResult                (solo adulto)
POST /api/mentors/cancel   {contractId}                          → { ok, error? }                (solo adulto)

RETIRADOS: GET /api/teachers · POST /api/teachers/hire · POST /api/teachers/cancel (y api.teachers/
hireTeacher/cancelTeacher + HireResult del cliente). CalendarEvent y TeacherSlot NO cambian.
```

Reglas de negocio de mentores (server, teachersFake.ts — el archivo conserva el nombre):
- `beneficiary` ∈ {el adulto, sus dependientes}; `daysPerWeek` ∈ 1..3.
- Un contrato por (mentor, beneficiario). El MISMO mentor puede estar contratado para Ian Y para
  Andrés (dos contratos).
- `schedule`: solo contratos `pending`; `slots.length === daysPerWeek`; días de semana DISTINTOS;
  horas en punto 9–19; sin choque con otra clase del MISMO beneficiario (otro beneficiario puede
  tener la misma hora: son personas distintas). Al agendar: `status:'active'`, cada slot ancla su
  serie semanal (desde la próxima ocurrencia estrictamente futura), 4 clases derivadas por slot,
  como hoy.
- `cancel`: saca el contrato (y sus clases derivadas) esté pending o active.
- **Persistencia**: `server/data/teachers.json` v2 `{ version:2, contracts:[...] }` con migración
  del v1 (cada hire vieja → contrato `active`, beneficiary `ian`, daysPerWeek 1, su slot con su
  `since`). La seed (Caro, miércoles 17) queda como contrato de Ian. Config del padre: fuera del
  reset del demo. `since` vive POR SLOT (`slots: [{weekday, hour, since}]` en disco; el contrato
  que viaja al cliente lleva los slots sin `since`).

## 4. Gating por usuario (server Y cliente)

- Server (todo por `actingUser(req)`):
  - Horarios (`closedSectionFor`, index.ts) y 403 de feature-off (chat en index.ts; market.ts;
    leaguesFake.ts; friendsFake.ts —router Y gift—) **solo si el activo es chico**.
  - `hasParentSession(req)` (parent.ts) → `true` si el activo es ADULTO (sesión implícita: el
    portón queda dormido, el PIN no se toca ni se imprime); chico → como hoy (401 sin token).
    Cubre /api/parent/* y /api/mytube/admin/*. Los /api/mentors* son directamente SOLO-adulto
    (`isAdultReq`: el token dormido no los abre — un chico no ve precios ni contrata).
- Cliente: `FeatureGate` y `ScheduleGate` devuelven `children` directo si `useUser().kind==='adult'`;
  `Sidebar` solo filtra secciones para el chico; `TopBar` trata ligas/tienda/amigos como prendidos
  para el adulto. (El feedFake sigue mezclando el contenido con los apagados del padre: el feed del
  demo es compartido — ver §7.)

## 5. Familia (la ex Zona de padres)

- Ruta **`/familia/*`** = los MISMOS paneles, SIN portón (ni AdultGate ni "Cerrar zona de padres").
  Solo adulto: con usuario chico la ruta navega a `/` (y el server responde 401 igual).
  `/padres/*` redirige a `/familia/*` preservando la subruta.
- Menú del adulto: punto **"Familia"** al fondo (debajo de Mi espacio), ícono nuevo `IcNavFamily`
  (estilo filled de icons.tsx). El link discreto `pz-access` del Sidebar se elimina para todos.
- Header: kicker "Familia", título "Cuenta de {dependiente}" — `kid` sale del PRIMER dependiente
  del adulto (`GET /api/users`), ya no de `useUser().name`. Tabs → `/familia/...`;
  "Profesores" pasa a **"Mentorías"** (`/familia/mentorias`; `/familia/profesores` redirige).
- **Mentorías** (refit de TeachersPanel): ya NO es el marketplace — lista las contrataciones de
  TODOS los beneficiarios (mentor, materia, "para Ian"/"para vos", plan, días u "falta elegir los
  días" con botón que abre la agenda, precio semanal), cancelar con confirmación, total semanal, y
  CTA "Buscar mentores" → `/buscar?tab=mentors`.

## 6. Mentores en Buscar (solo adulto)

- Solapa **"Mentores"** en /buscar (patrón de la solapa Personas; con usuario chico no existe y
  `?tab=mentors` cae en Páginas). Query vacía → el catálogo entero (8); con query → filtro por
  nombre/materia/bio (sin red extra: filtra `GET /api/mentors`).
- Card: emoji+color, nombre, materia, bio, rating, "USD X la hora", y el estado por beneficiario
  ("Da clases a Ian · los miércoles 17:00", "Pagado para vos · falta elegir los días → Completar").
- **Hoja de contratación** (nueva, en discover, chasis .shov/.shcard, prefijo CSS propio tras
  grepear):
  1. fase **plan**: elegir 1/2/3 clases por semana (cada opción muestra su precio semanal
     = n × pricePerHour, "clases de 1 h") **+ beneficiario** ("Para mí" / "Para {dependiente}") →
     "Contratar · USD N por semana" → `POST /api/mentors/contract`.
  2. fase **agenda (post-compra)**: "¡Listo! Elegí los N días de {materia} para {beneficiario}" —
     N pares día+hora (días distintos; horas ocupadas del beneficiario tachadas, de
     `MentorsResponse.taken`) → `POST /api/mentors/schedule`.
  3. fase **listo**: "Las clases ya están en el calendario de {beneficiario}" + la primera clase +
     "Ver calendario" (solo si el beneficiario es el usuario activo).
  - Cerrar en fase agenda deja el contrato `pending`: la card del mentor y Familia → Mentorías
    ofrecen "Elegir los días" (reabre la fase agenda). Demo: el pago es instantáneo y no se cobra
    (dejarlo dicho en la hoja, como la vieja).
- El calendario de cada usuario muestra SOLO sus clases (`GET /api/calendar` por usuario activo).

## 7. Compartido a propósito (demo, para no explotar el alcance)

XP/⚡/racha/ligas, Tienda y guardarropas, amigos + dock + campana, chat, Drive, MyTube, After Day,
Learn y su progreso, y el contenido del Feed (salvo el saludo, que sale de /api/me) son LOS MISMOS
para los dos usuarios. El switch recarga la página. Cuando Esteban arme los usuarios en serio, esto
se separa por usuario.

## 8. Tandas — HECHAS Y COMMITEADAS (14-oct)

- **U1 — usuarios, switch y Familia** (commit `b7d2faf`): seed + cabecera + /api/users + /api/me
  por usuario + identity por usuario (identity.json v2) + gating por usuario (server y cliente;
  el bypass del adulto quedó CENTRALIZADO en `useFeatures()`, decisión del implementador) + chip
  de la TopBar + menú Familia + /familia sin portón + redirecciones. Se retiraron AdultGate, el
  token X-Parent-Token del cliente y el link "Zona de padres" del Sidebar.
- **U2 — mentores** (commiteada a continuación): modelo v2 (`teachers.json` migra de v1; `since`
  por slot) + /api/mentors* + calendario por usuario + solapa Mentores (helpers compartidos en
  `src/shared/lib/mentors.ts`) + hoja plan/beneficiario → post-compra de días → listo (MentorSheet;
  un pendiente se retoma desde la card o desde Familia → Mentorías vía `/buscar?tab=mentors&agendar=<id>`)
  + panel Mentorías (administración; el marketplace salió de Familia) + retiro de /api/teachers*.

Bordes conocidos del demo (anotados por los implementadores): los ids de contrato se reusan
(máx+1); no se pueden cambiar los días sin cancelar y recontratar; el adulto no ve el calendario
del dependiente desde la UI (en Mentorías ve los días, no las fechas); con Amigos apagado el
adulto puede escribirle a los NPC pero no contestan (la respuesta en vuelo no conoce el usuario);
en el popover del switch los otros usuarios salen con el avatar derivado del nick, no el elegido;
los 401 del server a un chico siguen diciendo "Volvé a entrar con el PIN".
