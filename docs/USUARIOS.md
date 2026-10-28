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
  - `luna` — Luna, 12, `kind:'child'`, dependiente de `andres` (U3, 27-oct: §9).
  - `andres` — Andrés, 38, `kind:'adult'`, `dependents:['ian','luna']`.

## 2. Usuario activo (demo)

- El cliente guarda el usuario activo en `localStorage['innerith.user']` (default `'ian'`: la app
  arranca como hoy). **TODA llamada a la API** lleva la cabecera **`X-Innerith-User`**
  (src/api/index.ts la pone leyendo localStorage en cada llamada). El server la valida contra el
  seed (`actingUser(req)`; desconocida/ausente → `ian`).
- **Switch**: chip en la TopBar (avatar + nombre del usuario activo + ícono de cambio), a la
  izquierda de la campana. Click → popover (mismo patrón que la campana) con los usuarios de
  `GET /api/users` (avatar `lookFor(nick)` para el que no es el activo), el activo marcado, y la
  nota "Cambiar de usuario (demo)". Elegir otro → setear localStorage + `location.assign('/')`
  (recarga completa SIN resetear la demo de nadie —U4-C, §10: `setActingUser` marca
  `sessionStorage['innerith.keepDemo']` y la carga que sigue la consume—; el F5 resetea SOLO al usuario activo). A futuro
  Esteban lo arma mejor; esto es demo.

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
- **Persistencia**: `server/data/teachers.json` v2 `{ version:2, seq, contracts:[...] }` (`seq`, tanda B1:
  contador de ids que solo crece — un id cancelado no se reusa; archivo sin `seq` arranca en máx+1. Las
  clases se anclan en la ZONA HORARIA DE LA FAMILIA: "miércoles 17:00" es 17:00 de pared en esa zona,
  con `tz` null = la hora del server) con migración
  del v1 (cada hire vieja → contrato `active`, beneficiary `ian`, daysPerWeek 1, su slot con su
  `since`). La seed (Caro, miércoles 17) queda como contrato de Ian. Config del padre: fuera del
  reset del demo. `since` vive POR SLOT (`slots: [{weekday, hour, since}]` en disco; el contrato
  que viaja al cliente lleva los slots sin `since`).

## 4. Gating por usuario (server Y cliente)

- Server (todo por `actingUser(req)`):
  - Horarios (`closedSectionFor`, index.ts) y 403 de feature-off (chat en index.ts; market.ts;
    leaguesFake.ts; friendsFake.ts —router Y gift—) **solo si el activo es chico**, y desde U3 con LA CONFIG
    DE ESE CHICO (`featureOn(key, me.id)`, `closedSectionFor(path, me.id)`: §9).
  - `hasParentSession(req)` (parent.ts) → `true` si el activo es ADULTO (sesión implícita: el
    portón queda dormido, el PIN no se toca ni se imprime); chico → como hoy (401 sin token).
    Cubre /api/parent/* y /api/mytube/admin/*. Los /api/mentors* son directamente SOLO-adulto
    (`isAdultReq`: el token dormido no los abre — un chico no ve precios ni contrata).
- Cliente: `FeatureGate` y `ScheduleGate` devuelven `children` directo si `useUser().kind==='adult'`;
  `Sidebar` solo filtra secciones para el chico; `TopBar` trata ligas/tienda/amigos como prendidos
  para el adulto. (Desde U3 el feedFake arma el contenido con la config del CHICO ACTIVO —y con un
  adulto, solo con la protección de fábrica y todo prendido—: §9.)

## 5. Familia (la ex Zona de padres)

- Ruta **`/familia/*`** = los MISMOS paneles, SIN portón (ni AdultGate ni "Cerrar zona de padres").
  Solo adulto: con usuario chico la ruta navega a `/` (y el server responde 401 igual).
  `/padres/*` redirige a `/familia/*` preservando la subruta.
- Menú del adulto: punto **"Familia"** al fondo (debajo de Mi espacio), ícono nuevo `IcNavFamily`
  (estilo filled de icons.tsx). El link discreto `pz-access` del Sidebar se elimina para todos.
- Header: kicker "Familia", título "Cuenta de {dependiente}" — desde U3 · M2 el dependiente es el que el adulto
  ELIGE en el selector de integrante (`?m=<id>`; sin él, el PRIMERO de `GET /api/users`): ver §9. Tabs → `/familia/...`;
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

## 7. Qué queda de la familia y qué es global (desde U4)

Hasta U3 casi todo lo que no era config era LO MISMO para todos los usuarios del demo (XP/⚡/racha/ligas, guardarropas,
amigos, Drive, MyTube, Learn, lo social del Feed). **Desde U4 cada integrante tiene lo suyo (§10).** Lo que queda UNA vez:
- **De la FAMILIA** (lo cura el adulto): el catálogo de rutas de Learn (`/crear`), el YouTube aprobado (`mytube.json`: los
  videos que sumó la familia, sus canales y playlists de canal), After Day (`music.json`), la config de cada integrante y la
  de la familia (U3: `parent.json` v3 —tz y PIN dormido—, `schedules.json` v2), las mentorías (`teachers.json` v2: cada
  contrato dice para quién es), los avisos al padre (RAM, etiquetados por chico) y la tabla de la semana de la familia
  (U4-B).
- **GLOBAL** (el mundo del demo, igual para todos): el catálogo aprobado de videos, la lista blanca de sitios, la caché de
  artículos y sus veredictos (por huella de temas: U3), el mundo NPC (sus personas y noticias) y las anclas de zona y país.
- **Del DISPOSITIVO** (`localStorage`, no del usuario): volumen del MiniPlayer, repetir, ruidos, URL de route-lab.
- El historial del chat vive en la RAM del cliente: cada carga empieza vacía (ya era "de cada uno").

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

Bordes conocidos del demo (anotados por los implementadores): no se pueden cambiar los días sin
cancelar y recontratar; el adulto no ve el calendario
del dependiente desde la UI (en Mentorías ve los días, no las fechas); en el popover del switch los
otros usuarios salen con el avatar derivado del nick, no el elegido. SALDADOS con U3/M1 (28-oct): la
respuesta en vuelo de un NPC ya conoce al usuario que escribió (contexto por pedido), así que al
adulto le contestan siempre; los 401 de Familia a un chico dicen "Solo para un adulto de la familia."
(ya no nombran el PIN).

## 9. U3 — Familia con varios integrantes (27/28-oct)

> Pedido de Esteban (27-oct): el padre tiene que poder tener varios en la familia y configurar
> puntualmente a cada uno. El switch de la TopBar queda SOLO para la demo. Tanda en tres partes: **M1
> server** (hecha, 28-oct: contratos, migraciones, gating por chico) → **M2 cliente** (hecha, 28-oct: el selector
> de integrante en Familia, `?m=<id>`; detalle al final de esta sección) → M3 QA.

**Modelo.** Seed: `ian` (9), `luna` (12), `andres` (adulto, `dependents: ['ian','luna']`). Todo lo que
era "del chico" es POR INTEGRANTE; lo de la familia queda una sola vez:

| Por integrante (`members[id]`) | De la familia | Compartido en el demo (D2: U3 separa SOLO la config) |
|---|---|---|
| on-off (Tienda/Ligas/Amigos/Chat), premios de la Tienda, temas blancos/negros, palabras, topes de volumen, preset aplicado, dial del Feed, horarios por sección, avisos | zona horaria, PIN dormido, YouTube aprobado/ingesta, música de After Day, catálogo; mentorías (cada contrato dice para quién es) | XP/⚡/racha/ligas, guardarropas, Learn y su progreso, Mi espacio (Drive, listas, canales seguidos), amigos NPC y sus hilos (los NPC le dicen "Ian" también a Luna), historial del chat, lista de deseos (un archivo: cada chico ve los deseos de SUS premios) |

**Persistencia (server/data, fuera del reset).**
- `parent.json` **v3**: `{version: 3, seq, tz, pinHash, members: {[id]: {features, items, topics, extraWords, volume, preset, feedMotion}}}`.
  `seq` (próximo id de premio) es de la FAMILIA: los ids son únicos entre integrantes (canjes, stock y deseos no
  saben de integrantes). Un v1/v2 migra solo: lo de antes pasa ENTERO a `ian` y el original queda UNA vez en
  `parent.json.pre-v3` (un checkout viejo leería el v3 como "todo apagado" y lo reescribiría). Un dependiente sin
  entrada nace con la config de FÁBRICA (todo prendido, sin temas ni palabras, topes 100, sin preset, dial normal) +
  una copia de los 8 premios demo con ids nuevos (Luna: 9–16). Ilegible → `.roto-*` y todos cerrados (fail-closed).
- `schedules.json` **v2**: `{version: 2, members: {[id]: secciones}}` (sin entrada = sin horarios); el v1 migra a
  `ian` y queda una vez en `schedules.json.pre-v2`.
- Las migraciones son funciones PURAS en `server/src/familyMigrate.ts`, con tests (`server/src/__tests__/familyMigrate.test.ts`).

**`?member=<id>`** (una sola regla, `users.ts:memberFor`): adulto → un id de sus `dependents` (trim + minúsculas);
ausente o vacío → el PRIMERO (la UI de Familia de hoy, sin selector, sigue andando sobre Ian); otro →
`400 {error: 'Ese integrante no es de tu familia.'}`; sin dependientes → `400 {error: 'No tenés integrantes en tu
familia para configurar.'}`. Un chico con el token dormido del portón configura a todos los dependientes del seed.
Con un CHICO activo, los GET públicos ignoran `member` (cada chico ve lo suyo, nunca lo de un hermano).

```
Por integrante (?member):  POST features · GET activity (+member) · POST items · items/update · items/archive · deliver
                           (premio/canje de otro integrante → 200 {ok:false}) · GET config (+member, +features) · POST topics ·
                           words (el 400 nombra al integrante) · volume · feed-motion · GET presets · POST presets/apply ·
                           POST schedules (→ {schedules, serverNow, tz, member})
Avisos:                    GET alerts[?member] (con member: los de ese integrante; SIN member: TODOS) · POST alerts/seen[?member]
                           (aviso de otro integrante → {ok:false}). Cada aviso: childId + childName del chico activo que lo disparó.
De la familia (sin member): POST tz · GET music · POST music/add · music/remove · unlock · lock · /api/mytube/admin/* · /api/mentors*
Públicos:                  GET /api/parent/features → chico: los suyos · adulto: los del integrante (sin member, el primero)
                           GET /api/parent/limits   → chico: sus topes · adulto: {maxMusic:100, maxNoise:100}
                           GET /api/schedules       → chico: los suyos · adulto: los del integrante; sin integrantes, {schedules:{}}
Contratos (src/api/types.ts, aditivos): FamilyMember · SchedulesResponse.member? · ParentActivity.member? ·
                           ParentAlert.childId?/childName? · ParentConfig.member?/features?
```

**Qué rige en cada pedido (server).** Cada pedido corre con su usuario activo como contexto
(`server/src/requestContext.ts`, AsyncLocalStorage; propaga por `await`/`.then`/timers: la respuesta en vuelo de un NPC
conoce al chico que escribió). Las funciones de "política vigente" de `parent.ts` (familyBlockedTerms, familyTopics,
blackTopicsAll, whiteTopicsAll, feedMotion, featureOnNow, policyItems…) mantienen sus firmas y leen ese contexto:

| Usuario del pedido | on-off | temas/palabras (filtros, jueces, feed, chat) | topes | dial del Feed | premios en la Tienda | horarios | avisos |
|---|---|---|---|---|---|---|---|
| chico X | los de X | los de X + fábrica | los de X | el de X | los de X | los de X | sobre X |
| adulto (D1) | todo prendido | solo fábrica | sin topes | normal | ninguno: solo la ropa | ninguno | no genera |
| sin pedido (arranque) | prendida solo si TODOS la tienen | la unión de todos | — | normal | — | — | sin etiqueta |

El gating con `req` usa accesos explícitos: `featureOn(key, childId)` (index.ts: chat y "gana el apagado" del horario;
market.ts; leaguesFake.ts; friendsFake.ts —router y regalo—) y `closedSectionFor(path, childId)`. Adentro de
`/api/parent/*` el usuario del pedido es el ADULTO: ahí se usan SIEMPRE los accesos explícitos sobre el integrante M.
El comportamiento del adulto vive en UNA función (`adultPolicy` de parent.ts): si Esteban pide "el adulto con la suma
de los filtros de sus hijos", pasa a devolver la política de unión. Cachés por política: pools del Feed (hasta 4) y
veredictos de artículos por huella de temas negros (hasta 4; `articleTextForChat` exige el veredicto de la huella
vigente). El chat le habla al chico activo por su nombre (la "ficha" de Smarty es la de Ian: solo va para él) y su
redirección propone SOLO sugerencias de la familia de ese chico (nunca un tema blanco de fábrica).

**Decisiones del coordinador (28-oct).** D1: al adulto no lo alcanzan los filtros ni candados de sus hijos (arriba).
D2: U3 separa SOLO la config por integrante (lo compartido sigue compartido; "U4 cada uno lo suyo" queda para después).
D3: no hay "aplicar a toda la familia" (cada preset, tema o palabra se aplica a UN integrante).

**Para M2 (cliente).** Contratos congelados arriba; los paneles de Familia pueden leer TODO lo del integrante de
`GET /api/parent/config?member` (trae `features`); la UI actual sin `member` opera sobre el primer integrante y cuenta
los avisos de TODA la familia (`GET alerts` sin member). Los stores públicos del cliente (features/limits/schedules)
quedan para el chico activo: el server ya responde por el usuario activo.

**M2 — cliente: el selector de integrante en Familia (HECHA, 28-oct; sin commitear).** El adulto configura puntual a CADA
integrante desde Familia.
- **Selector** (`components/MemberPicker.tsx`, puro; CSS `pz-mem-*`): a la derecha del título, un chip por dependiente
  del adulto activo (`GET /api/users`, en el orden de `dependents`): avatar derivado del nick (`lookFor`, como el switch),
  "Ian · 9" / "Luna · 12" y sus avisos sin ver. Radios NATIVOS en un `radiogroup` (las flechas cambian de integrante, como
  los radios de MentorSheet). El elegido vive en la URL como **`?m=<id>`** (`lib/member.ts`: `useFamilyMembers`,
  `useSelectedMember`, `famTo`, `FAMILY_WIDE`; lo puro con tests en `lib/__tests__/member.test.ts`): persiste entre
  solapas (cada tab y cada link interno lleva `?m=`), sirve de deep-link (`/familia/temas?m=luna`; `/padres/...?m=` también),
  trim + minúsculas como el `?member=` del server, y ausente o ajeno → el PRIMER integrante con la URL corregida (replace).
  Elegir otro suma una entrada de historia (Atrás vuelve al anterior). Los `<Navigate>` internos (`/familia/presets`,
  `/familia/profesores`, `*`) conservan `?m=`. Sin integrantes: "Todavía no hay integrantes en tu familia para configurar.";
  lectura fallida: reintento.
- **Título** "Cuenta de {integrante}"; en las solapas de TODA la familia, "Toda la familia" + el selector atenuado
  (radios deshabilitados) + su nota.
- **`<Routes key={member.id}>`** (ParentPage): cambiar de integrante REMONTA los paneles. Obligatorio: `LimitsPanel`
  guarda al desmontar los topes que quedaron a medio guardar con el integrante de ESE montaje (verificado en el E2E:
  tope de Luna movido y cambio a Ian a los ~30 ms → el único POST fue `volume?member=luna`; y al revés); los borradores
  de Horarios y Premios y el filtro de Avisos arrancan de cero.
- **Por integrante** (cada panel recibe `member` y `kid` = su nombre; todos los pedidos llevan `?member=`): Funcionalidades,
  Presets (lista de `GET presets?member`; lo vigente de la config del integrante: un switch de abajo la relee y la tarjeta
  pasa sola a "configuración propia"), Temas y palabras, Límites (topes + horarios por sección), Premios (con su "La Tienda
  está apagada" leyendo la config del integrante), Actividad (con la nota "En esta demo el progreso (XP, ⚡ y racha), lo que
  está practicando y lo guardado en Mi espacio son compartidos entre los integrantes." — U4-C la reemplazó: §10), Protecciones (+ el dial del Feed).
  La config del integrante la comparte un store por integrante (`lib/memberConfig.ts`: `useMemberConfig`,
  `refreshMemberConfig` —una lectura en vuelo por integrante—, `patchMemberConfig` —solo respuestas del server, nada
  optimista—, `savedTouchingPreset` —patch + relectura tras un cambio que deja el preset sin aplicar—, `patchFamilyTz`).
  Los paneles ya NO usan `useFeaturesStatus` ni los GET públicos.
- **De toda la familia**: YouTube + Música de After Day (dejan de recibir `kid`; copy "tu familia" / "cada integrante" y
  etiqueta "Vale para toda la familia"; nota del selector: "YouTube y la música de After Day valen para toda la familia.");
  la **zona horaria** (vive en Límites, arriba de los horarios del integrante: etiqueta "Toda la familia" y "Vale para toda
  la familia, no solo para el integrante elegido…"; al guardar se parchea en la config de todos y se adopta con
  `adoptFamilyTz`, también en la pestaña del adulto —el reloj de su barra superior—).
- **Mentorías** (decisión M2): no se tocó el panel; su solapa es de TODA la familia porque la lista mezcla contratos de
  cada chico y "para vos" del adulto: el título dice "Toda la familia" (nunca "Cuenta de Ian" arriba de una mentoría del
  adulto) y la nota del selector "Las mentorías son de toda la familia: cada una dice para quién es (también las tuyas).".
- **Avisos**: UNA lectura de toda la familia (`GET alerts` sin member) de la que salen el panel, los contadores y la barra.
  Contador de la solapa Avisos = de TODA la familia (su aria-label nombra a cada chico: "1 sobre Luna"); cada chip lleva
  los suyos; la barra de crisis es de toda la familia aunque mires a otro ("Hay un aviso de crisis sin ver sobre Luna." →
  `/familia/avisos?m=luna`). En el panel, filtro "Solo {integrante}" / "Toda la familia" (arranca en el integrante; en
  "toda la familia" cada fila dice "Sobre {nombre}"); si el filtro esconde avisos sin ver de otro integrante, lo dice con
  "Ver toda la familia". "Marcar todos como vistos" marca los del filtro. El contador de Premios (canjes por entregar) es
  del integrante elegido.
- **Stores del chico etiquetados** (`lib/features.ts`, `lib/limits.ts`, `lib/schedules.ts`): `saveFeature(key, on,
  member)`, `adoptFeatures(f, member)`, `publishLimits(v, member)`, `adoptSchedules(r)` (usa `r.member`) solo adoptan en
  esta pestaña si ese integrante es el usuario activo (con el adulto en Familia, nunca: antes Familia le ponía los topes del
  chico al MiniPlayer del propio adulto) y su BroadcastChannel viaja con el integrante (las otras pestañas aplican la misma
  regla). `adoptFamilyTz(tz)` la adoptan todas.
- **Cliente de la API** (`src/api/index.ts`): `member?` como ÚLTIMO parámetro opcional (helper `withMember`) en los
  métodos por integrante; `features()`/`limits()` (los públicos del chico), `parentTz`, `parentMusic*`, `mt*` y `mentors*`
  sin cambios. `types.ts` no se tocó.
- **No tocado (fuera del terreno de M2)**: `StorePage.tsx` (la copy del adulto sin premios de la spec, ítem 8), `FeatureGate`,
  `ScheduleGate`, `Sidebar`, `TopBar` (el switch de demo), el server. Bordes: el link "Familia" del menú no lleva `?m=`
  (vuelve al primer integrante); el multi-pestaña con usuarios distintos sigue sin soportarse (`innerith.user` es uno por
  navegador: el BroadcastChannel etiquetado es para no CRUZAR configs, no para habilitarlo).

## 10. U4 — Cada uno lo suyo (28-oct)

> Visión (audios 1006-1011): "podemos estar los tres, cada uno aprendiendo lo que le toca aprender, pero podemos tener una
> liga donde competimos". Nada de eso existe sin XP, racha y progreso POR PERSONA: U4 separa por usuario todo lo que el demo
> compartía. Tanda en partes: **U4-A server — datos y economía** (hecha, 28-oct: esta parte), **U4-B server — ligas, amigos,
> feed y nombres de los NPCs** (suma su parte acá; con la mini-tanda **U4-B2**: los tops de grandes del adulto), **U4-C cliente**
> (hecha, 28-oct: la UI, al final de esta sección), U4-D QA. Decisiones del dueño: D1 (el
> reset del demo es POR USUARIO), D3 (Luna con su propia historia), D2 y D4 (U4-B).

**Qué es de cada uno (U4-A).** XP semanal y total, ⚡ (billetera), racha y movimientos · canjes y guardarropas · lista de
deseos · resultados de Learn (progreso, estrellas, urgencia del recall, el "primera vez paga") y con ellos el "seguí con…" y
el hero del Feed · Mi espacio (Drive, papelera, Mis listas, canales seguidos: MyTube y el «Seguir» del reproductor) · la
Actividad de cada integrante en Familia. Ninguna forma HTTP cambió: todo viaja por la misma cabecera `X-Innerith-User`
(contratos aditivos en `src/api/types.ts`: `DemoResetResult`, `FamilyLeague`/`FamilyLeagueRow`, los comentarios de
`ParentActivity.member` y `MtAdminChannel.followed`).

**El mecanismo.** `server/src/perUser.ts`: `perUser(seedFor)` guarda un slice por id; `now()` = el del usuario del pedido
(el contexto de U3, `requestContext.ts`), `of(id)` = uno puntual, `reset(id?)` (sin id: todos), `ids()`. Las funciones de
los módulos conservan su firma y operan sobre `now()` (`addXp`, `spendEc`, `summary`, `weekXp`, `startNewWeek`, `redeem`,
`driveView`, `toggleFollow`…). Fuera de un pedido rige ian. **Dentro de `/api/parent/*` y `/api/mytube/admin/*` el usuario
del pedido es el ADULTO**: lo del integrante se lee SIEMPRE con accesos explícitos — `summaryOf(id)`, `weekXpOf(id)`,
`resultRowsOf(id)`, `allSavedForParent(id)`, `listRedemptions(id)`, `deliverRedemption(canje, id)` — y lo que toca a todos
los espacios los recorre (`unfollowEverywhere`, `followedByAnyone`). `requestContext.ts` suma `runAsUser(id, fn)` (correr
algo como otro usuario del seed: tests y, en U5, el cierre de toda la familia) y `users.ts` suma `familyOf(id)` (adulto → él
+ sus dependents; chico → sus guardianes + los dependents de ellos; orden del seed). Lo persistido no usa `perUser`: su
mapa por usuario es el archivo en RAM y se escribe entero.

**El reset del demo (D1).** `POST /api/demo/reset` (sin cuerpo) vuelve al seed SOLO al usuario activo: su XP/⚡/racha/
movimientos, canjes y guardarropas (y, con U4-B, su grafo social, su ciclo de liga y su feed en vivo). `{scope:'all'}` →
todos (QA). Responde `DemoResetResult {ok, scope: 'user'|'all', user?}`. Cada carga de página lo dispara con la cabecera del
activo (`src/hooks/user.tsx`), así que **la recarga de Luna no toca a Ian**. Que el SWITCH de usuario no resetee es del
cliente (U4-C, hecho: `sessionStorage['innerith.keepDemo']`, ver "La UI (U4-C)" abajo). No entra en el reset lo persistido (Mi espacio, wishlist, Learn, identity, config del padre, mentorías,
catálogos) ni los avisos al padre (RAM de la familia). Reiniciar el server = todos al seed (RAM), como siempre.

**Seeds (lo que ve cada uno al arrancar).**

| | Ian (9) | Luna (12) | Andrés (adulto) |
|---|---|---|---|
| XP semana / total · ⚡ · racha | 1.240 / 8.460 · 1.240 · 5 (el de siempre) | 1.290 / 10.980 · 1.290 · 9 | 450 / 2.310 · 450 · 2 |
| Movimientos | los 3 de siempre | 470 «Práctica: Inglés inicial», 400 «Práctica: El cuerpo humano», 420 «Práctica: Fracciones» | 240 y 210 «Aprender» |
| Mi espacio | el de siempre (`users.ian`), intacto | vacío (nace "General" al primer guardado) | vacío |
| Canales seguidos | los 16 de demo | 8 de los 16 (Veritasium, Mark Rober, BBC Earth, La Hiperactina, Khan Academy, Un Mundo Inmenso, Shackleton Kids, Educatutos) | 2 (Veritasium, Khan Academy) |
| Learn | sus filas | ninguna (su hero: "Empezá <ruta>") | ninguna |
| Wishlist · Tienda | `[2,4]` · sus premios 1-8 | `[]` · sus premios 9-16 | `[]` · solo la ropa |
| Guardarropas / canjes | vacíos (RAM) | vacíos | vacíos |

Luna arranca con 50 XP más que Ian a propósito: con dos postas él la pasa (la tabla de la familia arranca peleada). Un
usuario del seed sin entrada en las tablas de seed arranca "nuevo": todo en cero / vacío.

**Persistencia y migraciones (todo lo existente pasó a `ian`).**
- `learn-results.json` **v2** `{version: 2, users: {[id]: filas}}`; ids de fila ÚNICOS en la familia (1 + el máximo de
  todos). El "primera vez que se completa un target" se mira sobre las filas DE ESE USUARIO.
- `wishlist.json` **v2** `{version: 2, users: {[id]: ids}}` (tope 20 por usuario; guarda ids archivados y filtra al leer).
- `space.json` **v2** `{version: 2, seq, users: {[id]: {folders, items, playlists, follows}}}`; `seq` de la FAMILIA (un id
  de carpeta, archivo o lista nunca significa dos cosas: la "última carpeta" de otro integrante simplemente no existe en tu
  espacio). El espacio de un usuario NACE al usarse con sus canales de arranque (antes se re-sembraban los 16 de demo en
  CADA arranque con la lista vacía; un v1 con `follows: []` migra con los 16, UNA vez). Un usuario en el archivo que ya no
  está en el seed se conserva en disco y no se sirve.
- Las tres migraciones v1 → v2 son PURAS (`server/src/userDataMigrate.ts`, tests en
  `server/src/__tests__/userDataMigrate.test.ts`; el mecanismo común en `__tests__/perUser.test.ts`). Al migrar, el texto
  original queda UNA vez en `<archivo>.pre-v2` (si ya existe, no se pisa: es el de la primera migración); un archivo
  ilegible queda como `<archivo>.roto-<ms>` y el módulo arranca vacío (antes `space.json` y `learn-results.json` se pisaban
  en silencio con el próximo guardado).
- ⚠ Un checkout viejo (pre-U4) con el server corriendo leería los v2 mal: `space.ts` viejo arrancaría vacío y REESCRIBIRÍA
  (Ian perdería su Drive → recuperarlo del `.pre-v2`), `learnResults.ts` viejo revienta al cargar, `market.ts` viejo vería la
  wishlist vacía. No hacer checkout de un commit pre-U4 con el server corriendo.

**Calendario de la XP (remate de U4-A).** El corte de semana de la XP (lunes 00:00) y el "día" de la racha corren en la
ZONA HORARIA DE LA FAMILIA (`parent.json` `tz`; null = la del server), la misma del ciclo de liga, la franja del Feed y los
horarios (antes, la hora local del server: con una zona corrida, la XP volvía a 0 unas horas antes o después del cierre de
la liga). `parent.ts` se la presta a `progress.ts` con `setProgressTzSource` (como a `schedule.ts`); tests en
`server/src/__tests__/progressWeek.test.ts`.

**Familia.** `GET /api/parent/activity?member=<id>` (misma forma): xp/⚡/racha/"está practicando"/lo guardado son DEL
INTEGRANTE (antes, compartidos), además de sus premios, canjes y protecciones. `POST /api/parent/deliver?member` busca el
canje en el slice de ese integrante (los ids de canje son por usuario: un canje de Ian con el mismo número no se toca).
Familia → YouTube: `followed` de cada canal = lo sigue ALGÚN integrante; borrar una entrada deja de seguir sus canales en
TODOS los espacios. El chat de un ADULTO le habla por SU nombre y sin la ficha de Smarty de Ian (A7).

**Bordes (U4-A).** "F5 a medias": quien recarga vuelve a su seed y los demás siguen con lo que hicieron (es lo que
significa "tu F5 es tu demo nueva"). Dos pestañas con usuarios distintos siguen sin soportarse (`innerith.user` es uno).
Dos QA con el MISMO usuario contra el mismo server se pisan (cada carga resetea a ese usuario). El guardarropas es RAM por
usuario y el look puesto persiste (identity.json): tras recargar, alguien puede tener la gorra puesta y el guardarropas
vacío (el borde de U1, ahora por usuario). Los guardados de Mi espacio y la wishlist conservan el debounce de 250 ms: un
reinicio de `tsx watch` dentro de esa ventana pierde la última escritura (pasaba igual antes de U4).

<!-- U4-B (+ U4-B2): ligas por usuario (pools disjuntos), grafo social por usuario sobre un mundo NPC único, nombres de los
     NPCs y la tabla de la semana de la familia van acá abajo. U4-C (la UI) va al final de la sección. -->

**Ligas públicas por usuario (U4-B).** Cada integrante tiene SU liga (`leaguesFake.ts`): su ciclo, su tabla de 12, sus
medallas y su "Simular cierre de semana", que cierra SOLO la suya (A6; el cierre de toda la familia con premio es U5). Los
NPCs de cada tabla salen de un pool PROPIO y DISJUNTO (`server/src/leaguePools.ts`, puro, con test
`__tests__/leaguePools.test.ts`: sin repetidos, disjuntos entre sí, con zona/país, con los 14 NPCs amigos y con los nicks del
seed) — regla 7: un NPC tiene UN puntaje y está en UNA tabla (si Luna e Ian compartieran nicks, "Simular NPCs" de uno le
cambiaría el puntaje al NPC en la tabla del otro). Ian conserva su pool EN EL MISMO ORDEN (sus semanas simuladas salen
idénticas). `LEAGUE_SEEDS[id]` = liga, ancla de XP de su tabla, "la semana pasada" y pool; un usuario del seed sin su
`LeagueSeed` hace FALLAR el arranque (un pool inventado al vuelo rompería la regla 7: sumar un usuario = sumar su pool).
Zona y país: la MISMA fórmula y las MISMAS anclas para todos (son de la zona, no del chico): con 1.290 XP Luna queda mejor
que Ian con 1.240, y dos hermanos con la misma XP quedan en el mismo puesto. **Los TOPS sí dependen de quién mira
(mini-tanda U4-B2):** un chico ve los de chicos (los de siempre) y el ADULTO, los de OTROS GRANDES (`ADULT_GEO_NICKS` /
`ADULT_GEO_NICKS_PAIS` vía `GEO_POOLS`), con la misma fórmula y anclas; la UI lo dice en el caption ("Grandes de Palermo"). "Vos" lleva el nick del activo. El calendario
del ciclo (días al cierre, "anoche"/"el domingo", "hace 3 días", el 25/50/75 % de los NPCs según el día) se lee en la ZONA
HORARIA DE LA FAMILIA (`zonedClock`, como la franja del Feed; sin zona, la del server).

**Grafo social por usuario sobre un mundo NPC único (U4-B, A4).** Los 14 NPCs (persona, noticias, perfil) son los mismos
para todos; amigos, solicitudes entrantes (con su nota) y salientes, hilos, "escribiendo…", el tope de 20 respuestas con
modelo por carga, el epoch y los REGALOS que vos hiciste (la prenda que el NPC tiene puesta en TU vista) son del grafo de
cada uno (`friendsFake.ts`, `GRAPH_SEEDS`). Ser "del pool" de Buscar → Personas ya no es un atributo del NPC: es no ser amigo,
ni solicitud, ni saliente EN TU grafo. Una respuesta en vuelo guarda al arrancar su grafo, su epoch y su chico. El ADULTO no
tiene amigos chicos (D4): su grafo nace vacío, `GET /api/friends/search` le responde `people: []` y `POST
/api/friends/requests/send` → `200 {ok:false, relation:'none', error:'Los chicos de Innerith se conectan entre chicos. Como
adulto, acompañás a los tuyos desde Familia.'}`. Ian y Luna NO se hacen amigos ni se escriben (mensajería entre usuarios
reales = otra superficie de moderación).

**Los NPCs nombran a quien juega.** Plantillas con `{kid}` ("¡Gracias, {kid}!", "¡Hola, {kid}!", el "¡gracias!" por un
regalo, los saludos al aceptar) y prompts con el nombre y la edad del activo (persona: "…con Luna (12 años), que es de tus
amigos en Innerith"; juez de mensajes: "ÚLTIMO MENSAJE DE LUNA PARA …"; transcripción). `UserInfo` no tiene género: todo
texto que lo nombra es NEUTRO ("si se siente mal o tiene una preocupación…"). Lo que el NPC "sabe que viste de él" son sus
noticias que TU familia te deja ver (temas negros, palabras y, con Ligas apagadas, sin las de ligas). La frase plantillada
"Te espero en Practicar" (Practicar no existe desde W3) pasó a "Te espero en Aprender".

**Feed por usuario (U4-B).** Lo SOCIAL sale del grafo del activo: el pool por política (U3) guarda TODAS las noticias de los
NPCs y se filtran al servir con `isVisibleNpc` (tus amigos y quien te pidió contacto), así dos hermanos con la misma config
comparten pool; "Simular NPCs" solo usa noticias y "compartió una ruta" de quien ves (más la carrera de TU liga). Lo VIVO —lo
que entró en vivo (ráfagas, cierres de liga), reacciones, "ver menos", el contador de ráfagas— es un slice por usuario: nada
cruza entre hermanos. Ids de noticias `ff-*` por lugar y lo nuevo SIEMPRE al final (`NEWS` +2, `NPC_NEWS` +4, `SHARERS` +2):
las ráfagas y los ids de Ian salen idénticos. Al adulto la tarjeta de su liga le dice "otros 11 grandes de tu nivel", y su
medalla de un cierre no dice "la ven tus amigos" (no tiene).
**Actualización «Feed diverso» (28-oct, pedido del dueño: «5 por vez y de diversos tipos… que haya cards de muchos tipos»).**
La ráfaga cambió A PROPÓSITO (ya no sale idéntica a la de U4): EXACTAMENTE 5 por toque, una de cada tipo —racha, insignia,
unidad completada, ruta compartida del catálogo de Learn y la carrera de TU liga con XP real—, nunca dos del mismo tipo,
protagonistas distintos dentro de la ráfaga (y otros que los de la anterior cuando se puede), sin repetir una noticia hasta
agotar su tipo (Ian: 13 por tipo social) y al reciclar nunca lo de la ráfaga anterior. Sigue siendo POR USUARIO y de quien
ves (Luna: sus 4 amigas + FedeAjedrez). El pool (`NPC_NEWS`, re-tipado por tipo; sin los "va 2º en su liga", que no son
ninguno de los 5) y `SHARERS` (cualquier NPC visible) viven en `server/src/feedMix.ts`, puro y con tests. Con Amigos apagado
del chico, `POST /api/feed/simulate-npcs` → 403 (antes 200 `{added: 0}`); con Ligas apagado salen 4; el adulto (sin amigos
chicos) recibe 1, la carrera de su liga. El seed suma 14 noticias AL FINAL de `NEWS` (los `ff-*` de Ian no se corren) y la
unidad completada pasa a tener ícono propio (`unit`, aditivo en `types.ts`: la card dice "Unidad", no "Insignia").

**Tabla de la semana de la familia (D2; audios 1008-1011).** `GET /api/leagues/family` → `FamilyLeague` = todos los
integrantes de la familia de quien mira (`familyOf`: grandes y chicos) por su XP de la semana —los ⚡ que ganó aprendiendo:
el MISMO número de su liga, zona y país— con su racha y el avatar que ELIGIÓ (`identity.lookOf`); orden XP → racha → seed,
`me` en el que mira, `closesInDays` al domingo del calendario de la familia. Un chico con Ligas apagadas no aparece en la de
nadie y, si es él quien la pide, 403 (los adultos siempre aparecen). No es una liga de la escalera: sin NPCs, sin cierre
(vuelve a cero el lunes con la XP). Premio de la semana, retos 1 a 1 y cierre con medalla de la familia: U5.

**Seeds sociales (D3/D4).**

| | Ian (9) | Luna (12) | Andrés (adulto) |
|---|---|---|---|
| Liga pública | Cometa · la semana pasada 2.º 🥈 (lo de siempre) | Estrella · la semana pasada 5.ª, sin medalla · NPCs de 11-13 (FlorAstrolabio, JeroCodigo…) | Chispa · la semana pasada 9.º · NPCs GRANDES (MarceloViajero, GabiPilates…) |
| Amigos | TomiCohete, LuliVolcan, MateoDino, CataEstrella, JuanchiRayo, MartuLuna | CataEstrella, MartuLuna (también de Ian), LeaTelescopio, TriniPiano | ninguno |
| Solicitud entrante | NicoRobot | FedeAjedrez ("Me encantan los acertijos de matemática y el ajedrez…") | ninguna |
| Hilos sembrados | MateoDino, TomiCohete, LuliVolcan (los de siempre) | MartuLuna: "¿Viste la Luna llena de anoche? 🌙 Me acordé de vos" · LeaTelescopio: "¡Anoche vi los anillos de Saturno con el telescopio!" | — |

Con la XP del día, el puesto en la tabla pública cambia según el día de la semana (los NPCs juntan 25/50/75/100 % de lunes a
jueves): de jueves a domingo los tres quedan 7.º; un miércoles, Ian y Luna 1.º y Andrés 4.º.

**Bordes (U4-B).** La gorra que Ian le regaló a TomiCohete no la ve Luna (es de TU grafo). ~~Zona y país usan los mismos tops
(nicks de chicos) también para el adulto~~ — SALDADO por la mini-tanda U4-B2: el adulto ve tops de GRANDES en zona y país
(misma fórmula y anclas compartidas: con 450 XP Andrés queda #106 de Palermo y #57.806 de 61.250 en el país; la UI no
promete otra cosa: "Grandes de Argentina" y su puesto). La semana del calendario de la
XP (`progress.ts`) también corre en la ZONA DE LA FAMILIA desde el remate de U4-A (ver "Calendario de la XP" más arriba):
liga y XP cortan juntas. Los
datos de perfil de los NPCs (estado, XP, "cursos que hacen los dos") son del mundo NPC: los mismos para Ian y para Luna.
Los INTERESES del armado del Feed (`feedFake.ts: INTERESTS` — "te gustan los dinosaurios", "te copan los volcanes") son
los del CHICO DEMO, globales: Luna y el adulto reciben los mismos "por qué" de interés (la spec U4 §3.6 los dejó sin
cambio a propósito; los intereses reales por usuario llegan con el algoritmo de recomendación).

**La UI (U4-C, 28-oct; sin commitear).** Lo que ve cada uno en pantalla con el server de U4-A/B.
- **El switch no resetea (D1).** `src/api/index.ts` es dueño de las dos claves: `setActingUser(id)` guarda
  `localStorage['innerith.user']`, marca `sessionStorage['innerith.keepDemo'] = '1'` y hace `location.assign('/')`;
  `consumeKeepDemo()` lee y BORRA la marca (vale una sola carga; sin almacenamiento → false = se resetea, como antes).
  `src/hooks/user.tsx` decide el reset de la carga UNA vez por módulo (`resetForThisLoad`: StrictMode monta el efecto dos
  veces en dev y la segunda vería la marca ya consumida; de paso, ya no salen dos POST por carga) y solo sin marca hace
  `POST /api/demo/reset` (sin cuerpo = el activo). Resultado, verificado en el navegador: Ian compra la vincha (⚡ 1.150) →
  switch a Luna (ninguna carga manda reset; Luna con SU ⚡ 1.290 y sin la vincha) → Luna cierra SU semana → switch a Ian (⚡
  1.150 y la vincha siguen; en la tabla de la familia Luna está en 0) → F5 (UN reset, con Ian: ⚡ 1.240, sin la vincha; Luna
  sigue en 0). La marca vive en sessionStorage: una pestaña nueva o un F5 sin switch resetean al activo, como siempre.
- **Lo social es de los chicos (D4).** Una sola regla, `src/sections/friends/lib/social.ts`: `socialOn(amigos, kind)` (puro,
  con tests) / `useSocial()` → `true` con un chico y Amigos prendido, `false` con Amigos apagado O con un ADULTO activo
  (aunque `useFeatures()` le dé todo prendido), `undefined` mientras no se sabe (fail-closed). La usan: el dock de Mensajes
  (`ChatDock`: con un adulto no se monta, y con él su "Buscar personas"), Buscar → Personas (`SearchPage`: con un adulto la
  solapa no existe y `?tab=people` cae en Páginas, como Mentores con un chico), la campana de la TopBar (es solo social:
  solicitudes + no leídos del dock; con un adulto no se piden ni cuentan y no hay campana), la zona pinneada del Feed (las
  solicitudes no se piden) y "Regalar" en la ropa de la Tienda (la hoja le diría "cuando aceptes una solicitud…", algo
  que el adulto nunca puede hacer). Queda para el adulto el chip de demo "Simular NPCs" del Feed (le trae la carrera de SU
  liga de grandes).
- **Solapa Familia en `/ligas` (D2).** `?tab=familia`; `api.familyLeague()` va en la MISMA carga que liga/zona/país pero
  no la tumba (si falla —o un chico con Ligas apagadas: 403—, la solapa no aparece y las otras siguen). Existe solo con
  ≥ 2 filas (`lib/tabs.ts`: `familyTabOn`, `resolveTab`; con tests). `components/FamilyRanking.tsx` (puro): el patrón de
  `FullRanking` (puesto con medallita 1-3, "Vos" resaltado) con el avatar ELEGIDO de cada uno (`row.look`), la racha
  "✨ 9 días" (la chispa sin presión del Feed) y la XP; caption "Tu familia · esta semana"; pie "Cuenta la XP que cada uno
  suma aprendiendo lo suyo esta semana (los ⚡ que gana). Vuelve a cero el lunes." (sin la moneda si la Tienda está apagada
  para el que mira). CSS `lgf-` en `leagues.css`. "Simular cierre de semana" relee también esta tabla (tu XP vuelve a 0 y
  bajás). No es una liga: sin NPCs, sin cierre propio, sin premio (U5).
- **El adulto en Ligas (D4 + U4-B2).** `lib/tabs.ts`: `leagueCaption` ("Liga Chispa · 12 grandes"; a un chico, "· 12
  chicos") y `geoCaption` ("Grandes de Palermo" / "Grandes de Argentina"; a un chico, el lugar a secas). Ningún texto de
  `/ligas` dice "chicos" con el adulto.
- **Familia.** Actividad: se fue la nota de U3 ("…son compartidos entre los integrantes"); la nueva dice "Todo lo de acá
  es de {integrante}: su XP, sus ⚡ y su racha, lo que está practicando y lo que guardó en su Mi espacio. Lo que sigue
  siendo de toda la familia es el catálogo: las rutas de Aprender y el YouTube que aprobás." YouTube: "…y cada integrante
  los puede seguir en su MyTube." (cada uno sigue lo suyo).
- **Mi espacio.** `FolderSheet`: la "última carpeta usada" es por usuario (`innerith.lastFolder:<id>`; la clave vieja sin
  usuario se ignora).
- **Bordes (U4-C).** La campana desaparece para el adulto (hoy su único contenido es social: si un día tiene avisos propios,
  vuelve con ellos). `?tab=people` con un adulto deja la URL como está y muestra Páginas (igual que `?tab=mentors` con un
  chico). El aviso "Resultados solo de fuentes verificadas para chicos" de Buscar también lo ve el adulto: es cierto (lo
  protege la lista de fábrica). La app no tiene diseño de teléfono (la barra lateral fija aprieta todo a 375 px): no es
  de esta tanda.

## 11. Ciclo del día (F1, 28-oct)

> Pedido del dueño (28-oct): una pestaña nueva de Familia, "Ciclo del día", donde el padre indica RANGOS HORARIOS y QUÉ
> PUNTOS DE MENÚ están disponibles en cada rango; y, para la demo, un selector para elegir en qué rango está el usuario.
> REEMPLAZA a los "Horarios por sección" (porte W7: por sección, una franja por día de la semana). Tanda en partes: **F1
> server + contratos** (hecha, 28-oct) → **F2 cliente** (hecha, 28-oct: la pestaña, el selector de demo, las reglas
> compartidas y la reestructura de Familia —MyTube y After Day con la grilla del chico—; detalle al final de esta sección).

**Modelo.** Por integrante, hasta 8 rangos `CycleRange {id, name, from, to, sections}` (`src/api/types.ts`): `from`/`to`
"HH:MM" canónicas, el rango cubre [from, to), `to < from` cruza la medianoche, `from == to` = las 24 h; SIN día de la
semana (los rangos rigen todos los días); `sections` ⊆ las mismas 8 de antes (`chat`, `buscar`, `mytube`, `aprender`,
`tienda`, `calendario`, `espacio`, `afterday`), sin repetir y en el orden del menú (puede ser vacía). El Feed nunca se gatea.

**Regla de disponibilidad** (solo con un CHICO activo — al adulto no lo gatea nada, como antes; `src/shared/lib/cycleRules.ts`
—mudado de `server/src/` en F2: el mismo código en server y cliente—, puro y con tests en `server/src/__tests__/cycleRules.test.ts`):
- una sección que NO figura en ningún rango → siempre disponible;
- una que figura en ≥ 1 rango → disponible SOLO cuando el reloj del server, leído en la ZONA HORARIA DE LA FAMILIA
  (`parent.json` `tz`; null = la del server), cae dentro de alguno de SUS rangos (los solapados suman);
- datos inválidos → disponible (fail-open, la regla de la casa): un rango con horas que no son HH:MM abre sus secciones
  las 24 h; cualquier excepción al evaluar → disponible;
- `opensAt` (el "se abre de nuevo a las…" del 403) = el próximo minuto de HOY en que abre, "HH:MM", o null (hoy ya no abre;
  no se promete mañana, mismo espíritu que W7).

**Override de DEMO** ("estás en este rango"). `POST /api/demo/cycle {rangeId}`: el integrante se evalúa COMO SI el reloj
estuviera dentro de ese rango — sus secciones disponibles, las que figuran en OTROS rangos y no en ése cerradas, las que no
figuran en ninguno disponibles. Los rangos se toman como momentos exclusivos: un solapamiento con otro rango NO abre nada.
Con override no hay `opensAt` (no sigue al reloj). `null` = reloj real. RAM y POR USUARIO (`perUser`): lo limpia `POST
/api/demo/reset` de ESE usuario (`{scope:'all'}`: todos) y también guardar un ciclo que ya no trae ese rango; un id que ya no
existe = reloj real. Chico activo → SU override (`member` se ignora: nunca toca a un hermano). **Aditivo de F1** (decisión del
implementador, para que F2 pueda poner el selector también en Familia): con un ADULTO activo, `?member=<id>` elige el del
integrante (misma regla `memberFor`; ajeno → 400; sin integrantes → 400). El override es del integrante: si lo elige el
adulto, lo limpia el F5 del CHICO (no el del adulto).

**Persistencia.** `server/data/schedules.json` **v3** `{version: 3, members: {[id]: {ranges: CycleRange[]}}}` (config del
padre: fuera del reset; escritura atómica; sin entrada = sin rangos = todo disponible). Migración (`familyMigrate.ts:
upgradeCycleRaw`, pura, con tests): un v1/v2 **NO se convierte** — una semana por sección no es "en este rango del día, estas
secciones", y adivinar podría encerrar al chico —; el original queda UNA vez en `schedules.json.pre-v3` y cada integrante
arranca con `ranges: []` (en este repo: el v2 era `{ian: {}, luna: {}}`, sin horarios cargados; no se perdió nada). Al leer,
lo raro de un archivo editado a mano se sanea hacia ABIERTO (`sanitizeStoredRanges`: horas inválidas → 24 h, secciones
desconocidas afuera, ids/nombres nuevos) con aviso en el log; ilegible → `.roto-<ms>` y todo disponible. ⚠ Un checkout
pre-F1 con el server corriendo leería el v3 como un v1 y lo reescribiría como v2 (los rangos quedarían adentro de
`members.ian`, recuperables a mano): no hacerlo.

**Contratos (congelados; `src/api/types.ts`, aditivos).**

```
CycleRange       {id, name, from, to, sections: SectionKey[]}
CycleConfig      {ranges: CycleRange[]}
CycleResponse    {cycle, member, serverNow, tz, demoRange}
CycleSaveRequest {ranges: (CycleRange con id opcional)[]}
DemoCycleRequest {rangeId: string | null}
SchedulesResponse {serverNow, tz, member, cycle, demoRange}   (sin `schedules`: la compat de F1 se retiró, ver abajo)

GET  /api/parent/cycle?member           (sesión del adulto)  → CycleResponse
POST /api/parent/cycle?member {ranges}  (sesión)  → CycleResponse · la lista COMPLETA reemplaza a la anterior · 400 con motivo:
       no es lista · más de 8 · id repetido o inválido ([A-Za-z0-9_-]{1,40}; los que faltan los pone el server: r1, r2…) ·
       nombre fuera de 1-30 o sin letras/números · horas que no son HH:MM · sección desconocida o secciones que no son lista
       (los textos nombran al rango: «Tarde»: …; y al integrante: "El ciclo de Ian admite hasta 8 rangos")
GET  /api/schedules[?member]            (público) → SchedulesResponse {serverNow, tz, member, cycle, demoRange}
       chico → lo suyo (member ignorado) · adulto → el de ?member (ausente = el primero; ajeno → 400) · adulto sin
       integrantes → {serverNow, tz, cycle: {ranges: []}, demoRange: null} sin member
POST /api/demo/cycle[?member] {rangeId} → SchedulesResponse (la misma que daría GET /api/schedules) · rangeId ajeno, ausente
       o que no es string/null → 400 · GET → 405 · nunca se gatea
POST /api/parent/schedules              → 410 {error: 'Los horarios por sección fueron reemplazados por el Ciclo del día.'}
       (con cualquier método y sin mirar integrante; un chico recibe antes el 401 de la sesión)
403 de una sección no disponible        → {error: 'horario', section, opensAt}   (la MISMA forma de W7)
```

**Enforcement.** `closedSectionFor(path, childId)` evalúa el ciclo (+ el override) con el MISMO `sectionForApi` de W7 y las
mismas exclusiones (Feed, lector, reproductor, `/api/parent/*`, demo —también `/api/demo/cycle`, para poder salir de un
rango—, amigos, progreso, ligas, Mentores, Mis listas/Seguir, el selector de carpetas…). Capas como antes: con Chat/Tienda
APAGADOS gana el apagado (su propio 403).

**Compat con el cliente de antes de F2 — RETIRADA (28-oct).** F1 había dejado en `GET /api/schedules` un campo `schedules`
con el ciclo "congelado" en la forma vieja de W7 (`legacySnapshot`), para que el cliente de antes de F2 siguiera andando sin
tocar `src/`. Desde F2 nadie lo lee y se retiró entero: el campo de la respuesta (`schedule.ts`), `legacySnapshot`/`LegacyDay`/
`LegacySchedule` de `src/shared/lib/cycleRules.ts`, el bloque «compat» de `server/src/__tests__/cycleRules.test.ts`, lo que
quedaba de `src/sections/parent/lib/scheduleRules.ts` y `schedules` + `DaySchedule`/`FeatureSchedule` de `src/api/types.ts`.
Hoy la respuesta es SOLO `{serverNow, tz, member, cycle, demoRange}`. `POST /api/parent/schedules` sigue en 410.

**Verificado (28-oct, dev del usuario).** tsc ambos + build + `npm test` (27 archivos, 283 tests: +29 de reglas del ciclo, +5
de migración). Humo por API, 60/60: CRUD por integrante (ian y luna independientes; ajeno 400; chico 401), 400s de
validación, 403 real fuera de rango con `opensAt` (adulto y Luna pasan; Feed nunca), la compat de entonces (ya retirada)
leída por el proxy de Vite y evaluada con las reglas del cliente (abierta/cerrada y "se abre a las" = server), override (secciones correctas, `opensAt`
null, null → reloj real, reset de Ian no toca a Luna, guardar sin el rango lo apaga, el adulto por `?member`), tz de la
familia corrida a Pacific/Pago_Pago (la misma sección pasa de 403 a disponible), 410. En el navegador (5173, como Ian): el
menú sin "Aprender" fuera de rango, `/aprender` con "Esta parte está descansando ahora… Se abre de nuevo a las 15:09." y, al
elegir el override, Aprender vuelve y MyTube sale sin recargar. Estado restaurado (ciclos vacíos, overrides null, tz null).

**Para F2 (cliente) — CUMPLIDO** (en F2 y en la retirada de la compat; queda como registro de lo que se pidió).
- Leer `cycle` + `demoRange` + `serverNow` + `tz` de `GET /api/schedules` (el store del chico) y espejar las reglas de
  `server/src/cycleRules.ts` (`sectionAvailableAt`, `opensAtToday`, `rangeCovers`, `parseHHMM`; el archivo solo importa
  `zonedClock.ts`: se puede mudar a `src/shared/lib/` y usar el MISMO código en los dos lados, como `zonedClock`). Lo que hoy
  hace `scheduleRules.ts` (`isOpenAt`, `nextOpenLabelAt`, `SCHEDULABLE`, `sectionForPath`) pasa a evaluar el ciclo; el delta
  con `serverNow`, el tick de 30 s, el foco, el BroadcastChannel y el FAIL-OPEN se conservan.
- La pestaña de Familia: `GET /api/parent/cycle?member` y `POST /api/parent/cycle?member {ranges}` (manda la lista entera;
  los rangos nuevos pueden ir sin id; mostrar el `error` del 400 tal cual: `rejectedReason`). La tz de la familia sigue
  siendo `POST /api/parent/tz`.
- El selector de demo: `POST /api/demo/cycle {rangeId | null}` con el chico activo (o desde Familia con `?member=`); la
  respuesta es una `SchedulesResponse` lista para adoptar. Es chip de demo (regla 9 de AGENTS: solo dispara el endpoint y
  refetchea). Cada F5 del chico lo limpia (reset por usuario).
- Retirar `SchedulesPanel` (Horarios por sección), `api.parentSchedules` y `normalizeSchedule`/`defaultSchedule` (hecho en
  F2); y, cuando nadie leyera `SchedulesResponse.schedules`, sacarlo del server con el bloque "compat" de `cycleRules.test.ts`
  (hecho: ver «Compat… — RETIRADA» más arriba).
- Los docs desfasados que F1 dejó anotados (el párrafo "Horarios por sección" del README, la línea de AGENTS sobre los
  horarios y la tabla visión↔código de VISION) se pusieron al día en F2.

**Bordes (F1).** Sin día de la semana (un fin de semana distinto no se puede expresar: pedido explícito del diseño v1).
`opensAt` no mira mañana. El override toma los rangos como exclusivos aunque se solapen. El cliente puede quedar hasta 30 s
atrasado DESPUÉS de un borde (su tick; el server no: enforcea al minuto). Un rango sin secciones es válido (sirve
de "momento" en el selector de la demo: con él elegido, todo lo que figura en otros rangos se cierra).

**F2 — cliente (HECHA, 28-oct; sin commitear).** Pedido del dueño (28-oct): After Day en una pestaña propia; la pestaña YouTube
se llama MyTube; "el listado está súper mal: tiene que ser el MISMO tipo de grilla que ve el chico, con una forma de agregar";
una pestaña nueva "Ciclo del día"; y, para la demo, un selector en la barra de menú para elegir en qué rango está el usuario.
- **Solapas de Familia** (`components/ParentHeader.tsx`), en este orden: Funcionalidades · Temas y palabras · **MyTube**
  (`/familia/mytube`; `/familia/youtube[/*]` redirige conservando `?m=`) · **After Day** (`/familia/afterday`) · Límites (SOLO
  topes de volumen + la zona horaria de la familia, ahora en su propio panel) · **Ciclo del día** (`/familia/ciclo`, POR
  INTEGRANTE) · Avisos · Premios · Mentorías · Actividad · Protecciones. Todas conservan `?m=` (también la vista de un canal y
  su «‹ MyTube»). Con 11 solapas la fila no entra en la columna de 1040: van SIEMPRE como fichas que bajan de línea (el modo que
  ya existía para pantallas angostas; umbral del container query subido a 1240 px). De TODA la familia (`lib/member.ts`:
  `FAMILY_WIDE` + `familyNoteFor`, que también cubre las subrutas): MyTube, After Day y Mentorías.
- **MyTube del padre** (`containers/FamilyMyTubePanel.tsx`): arriba el AGREGAR por URL (el lote con progreso de siempre); abajo
  "Canales (N)" con «Buscar un canal» (título o @handle, sin tildes) y la MISMA tarjeta del chico (`sections/mytube/cards/
  ChannelCard.tsx`, que suma el prop opcional `counting` → "… videos"; el MyTube del chico no lo pasa) en dos grupos: «Sumados
  por tu familia» (canales con alguna entrada, del más reciente; con un ⋮ que abre `components/MtEntriesSheet.tsx`: las entradas
  de ese canal con Reingestar y Eliminar → `ConfirmSheet` con el texto de la cascada) y «Del catálogo de Innerith» (en el orden
  del server, como el chico). Las entradas sin canal conocido van como tarjeta suelta en el primer grupo. "N videos": el admin
  no trae conteos (contrato congelado) y `GET /api/mytube/channel` dispara el enriquecimiento con YouTube + IA, así que sale del
  `total` de `GET /api/mytube/channel/videos?limit=1` (= el "Videos (N)" que ve el chico adentro del canal; puede diferir en
  poco del número de su tarjeta, que no descuenta palabras bloqueadas: quirk del POC) y se pide A DEMANDA, cuando la tarjeta
  entra en pantalla, de a 3 (`lib/mtCounts.ts`; ~200 ms de server por canal: los 151 de golpe serían ~5 s); se olvidan tras
  agregar/eliminar/reingestar/completar/quitar duplicados. Tocar una tarjeta → `/familia/mytube/canal/:id`
  (`containers/FamilyChannelPanel.tsx`): la cabecera del chico (`ChannelHeader`, ahora con `onFollow` opcional: sin él no hay
  «Seguir») + "Cómo lo ve tu familia" (la descripción editable; sigue a la del server mientras no se toque) + las entradas de
  ese canal con su mantenimiento + "Videos (N)" con la `VideoList` del chico (40 + «Ver más»; tocar uno abre el reproductor y
  «‹ Canal» vuelve). Abrir un canal por primera vez dispara su enriquecimiento on-demand en el server, igual que cuando lo abre
  el chico. Completar canales, Quitar duplicados y el tope por entrada: plegados al pie en «Mantenimiento». Retirados
  `YouTubePanel.tsx`, `YtChannelRow.tsx` (y su tabla/lista de 151 textareas) y sus estilos.
- **After Day del padre** (`containers/FamilyAfterDayPanel.tsx`): el agregar (link + nombre opcional) y la MISMA grilla del
  chico (`.ad-grid` + `sections/afterday/cards/TrackCard.tsx`, que suma el prop opcional `corner` → «Quitar» arriba a la derecha;
  tocar = escuchar de fondo y «Ver» = el video contenido, también para el adulto). Retirado `AfterDayMusicPanel.tsx`.
- **Ciclo del día** (`containers/CyclePanel.tsx` + `components/CycleRangeCard.tsx`; lo puro en `lib/cycleDraft.ts` con tests):
  `GET /api/parent/cycle?member` → borrador; por rango: nombre, desde/hasta (`<input type="time">`), "Rige de 14:00 a 18:00,
  todos los días" (o "cruza la medianoche" / "todo el día" / "Revisá las horas"), las 8 secciones como fichas (`aria-pressed`) y
  «Borrar»; «+ Agregar rango» (máx. 8; arranca donde termina el último, 3 h); «Guardar ciclo» (solo con cambios) manda la lista
  ENTERA (`api.parentCycleSave`, los nuevos sin id) y un 400 se muestra con el `error` del server tal cual (`rejectedReason`;
  el cliente NO pre-valida: una hora vacía viaja vacía); «Descartar cambios». Arriba, la regla ("Una sección que no está en
  ningún rango queda siempre disponible. El Feed nunca se cierra.") y la hora de la familia con el link a Límites; abajo, qué
  queda siempre disponible para ese integrante. Badges "Ahora" (el reloj de la familia cae en el rango) y "En la demo, {kid}
  está acá" (el override vigente). Lo guardado se adopta (`adoptCycle`): rige ya donde ese chico es el usuario activo (esta
  pestaña y las otras) y el selector de demo toma los rangos nuevos.
- **Store del chico** (`lib/cycle.ts`, reemplaza a `lib/schedules.ts`): `GET /api/schedules` → `cycle` + `demoRange` +
  `serverNow` + `tz` (el campo `schedules` YA NO se lee), delta con el server, tick de 30 s, foco, BroadcastChannel
  `innerith:cycle` (mensajes `cycle` por integrante y `tz`), FAIL-OPEN; evalúa con `sectionAvailableAt`/`opensAtToday` de las
  reglas COMPARTIDAS (`src/shared/lib/cycleRules.ts`, importado también por `server/src/schedule.ts` y su test; sin duplicar).
  API: `useCycle`, `serverDate`, `refreshCycle`, `isSectionOpen`, `cycleAllows` (Sidebar), `useCycleGate` (ScheduleGate, misma
  UX "descansando… se abre a las HH:MM"; con override, sin "se abre"), `adoptCycle`, `adoptFamilyTz`, `onMemberCycle` (oyentes
  por integrante) y `useMemberCycle` (el ciclo de un integrante visto por el adulto). El mapa ruta → sección y la ruta de cada
  sección: `lib/cycleSections.ts` (tests). TopBar, Feed, Calendario, Mentores y ProfileCard pasaron a `useCycle` (solo usan
  tz/delta y, ProfileCard, `isSectionOpen('tienda')`).
- **Retirado**: `SchedulesPanel.tsx`, `lib/schedules.ts`, `api.parentSchedules`, `normalizeSchedule`/`defaultSchedule`/
  `DEFAULT_DAY`/`SCHEDULABLE`, su test y los estilos `pz-sch-*`. Después, con la retirada de la compat, también
  `lib/scheduleRules.ts` entero (`isOpenAt`/`nextOpenLabelAt`, que solo los usaba el bloque «compat» del test, retirado junto).
- **Selector de demo** «Ciclo (demo)» (`containers/CycleDemoControl.tsx` + `components/CycleDemoPicker.tsx`, CSS `cyd-` en
  shell.css): abajo del menú, arriba del MiniPlayer, un `<select>` con borde punteado (lenguaje de los chips de demo): "Reloj
  real" + "Tarde · 14:00–18:00"… Elegir → `api.demoCycle(rangeId[, member])` y `adoptCycle` de la respuesta (menú y ruta cambian
  al instante, sin recargar). **Decisión F2 (con el adulto)**: el selector aparece SOLO dentro de Familia y opera sobre el
  integrante del `?m=` ("Ciclo de Luna (demo)", con `?member=`; misma regla de Familia: ausente o ajeno = el primero, así nunca
  sale un pedido inválido); fuera de Familia el adulto no lo ve (al adulto no lo gatea nada y no hay integrante a la vista: un
  "Reloj real" suelto no diría nada). Flujo de demo: el adulto arma el ciclo, elige "Tarde" para Luna y al cambiar a Luna con el
  switch (que no resetea) la encuentra en ese rango; su F5 vuelve al reloj real. Con un chico, aparece solo si tiene rangos.
- **API** (`src/api/index.ts`, aditivos): `parentCycle(member?)`, `parentCycleSave(ranges, member?)`, `demoCycle(rangeId,
  member?)`. En `types.ts`, la retirada de la compat sacó `schedules` + `DaySchedule`/`FeatureSchedule`, y el comentario del
  Ciclo ya apunta a las reglas compartidas (`src/shared/lib/cycleRules.ts`).

**Compat de F1 en el server — RETIRADA.** Lo que esta sección le pedía al server (sacar `SchedulesResponse.schedules` de
`schedule.ts` con `legacySnapshot`/`LegacyDay`/`LegacySchedule`, el bloque «compat» del test y su import de `scheduleRules`,
`scheduleRules.ts` del cliente y, en `types.ts`, `schedules` + `DaySchedule`/`FeatureSchedule`) está hecho: ver «Compat con el
cliente de antes de F2 — RETIRADA» más arriba. `POST /api/parent/schedules` → 410 se dejó (nadie lo llama; no molesta).

**Verificado (F2, 28-oct, dev del usuario 5173/8787).** `npx tsc -b --force` + `tsc -p tsconfig.server.json` + `npm run build`
+ `npm test` (30 archivos, 299 tests: +4 archivos —`cycle`, `cycleDraft`, `cycleSections`, `mytubeAdmin`—, −`schedules.test.ts`;
tras retirar la compat, 30 archivos y 292 tests; con la tanda «Feed diverso» del 28-oct —`feedMix.test.ts` y `feedFake.test.ts`—,
32 archivos y 316 tests).
E2E con Chrome headless (49 chequeos): solapas en el orden nuevo y redirección de YouTube; grilla de canales del padre con la
MISMA tarjeta del chico (estructura idéntica), agregar un video de prueba → aparece en «Sumados» → ⋮ → Eliminar con confirmación
→ 0 entradas; vista de canal (videos + descripción, sin «Seguir»); After Day: agregar → la MISMA tarjeta y el mismo orden en
Familia y en el `/afterday` del chico → Quitar; Ciclo: "Tarde" con MyTube y After Day para Luna → como Luna el menú las esconde,
`/mytube` descansa con "Se abre de nuevo a las HH:MM." y el 403 del server coincide (sección y `opensAt`), Calendario sigue en 200;
400 con el motivo exacto («Tarde»: las horas tienen que ser HH:MM…) al mandar una hora vacía; borrar → todo vuelve; selector
como Ian (el menú cambia sin recargar —marca en `window` intacta—, `/aprender` descansa sin "se abre", el server tiene el
override; "Reloj real" lo vuelve); el adulto elige la demo de Ian desde Familia (badge "En la demo" sin recargar) y fuera de
Familia no ve el selector; `?m=` persiste en las 11 solapas; la barra entra a 1280×720 con el selector; con TODO cerrado salvo
el Feed, Feed/Ligas/reproductor no piden APIs gateadas (0 respuestas 403). Consola limpia (el único error es el 400 provocado a
propósito; en el reproductor, Chrome headless avisa "Failed to create WebGPU Context Provider", ajeno). Estado restaurado: ciclos
vacíos, overrides null, After Day y entradas de MyTube vacíos; `schedules.json`, `music.json`, `parent.json`, `space.json` y
`mytube.json` IDÉNTICOS byte a byte al respaldo previo (agregar un video refresca `entrySeq` y los sellos `metaAt` del canal en
`mytube.json`: se restauró del respaldo y se reinició el API para que lo releyera).

**Bordes (F2).** El "N videos" de una tarjeta del catálogo del padre es el de adentro del canal (aprobados visibles), no el de
la tarjeta del chico (que no descuenta palabras bloqueadas): pueden diferir en pocos. ~~Un canal del catálogo sin avatar en caché
se ve con el círculo vacío hasta que alguien lo abre~~ — SALDADO (remate del QA F3, 28-oct): `GET /api/mytube/admin/channels`
completa la metadata que falte por lote (`ensureMeta` → `channels.list`, 1 unidad cada 50 canales, SIN modelo: la descripción
curada sigue on-demand al abrir el canal), cacheada en `mytube.json`; espera como mucho 4 s y si YouTube falla responde igual
(sin avatar, como antes; el lote fallido se reintenta a los 30 min, sin escribir nada). Poblado una vez en el caché real: 133
canales, 3 unidades, 151/151 con avatar. Los cambios sin
guardar del Ciclo se pierden al cambiar de integrante o de solapa (el panel remonta; dice "Hay cambios sin guardar."). El
multi-pestaña con usuarios distintos sigue sin soportarse (el BroadcastChannel solo evita cruzar ciclos de integrantes).
