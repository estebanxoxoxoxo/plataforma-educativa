# Usuarios: la plataforma es para grandes y chicos (línea 14-oct-2026)

> Pedido de Esteban (14-oct, verbatim resumido): la plataforma es para grandes y chicos. **No cambia
> nada del orden ni del diseño**, pero un adulto puede usarla para él solo, o para él y sus
> dependientes: punto de menú nuevo ABAJO DE TODO (y se quita la Zona de padres) donde configura lo
> del hijo. Los **mentores** le aparecen al adulto en Buscar como un tipo de recurso más; al
> contratar elige si es para él o para un dependiente; la compra tiene **post-compra** donde se
> eligen el/los día/s (la cantidad depende de cuánto pagó). Usuarios demo: un niño y su padre, con
> un botón en la barra superior para switchear (a efectos de demo).

> **Shell nuevo (SHELL-2, 30-oct).** Este documento es también el REGISTRO de cada tanda, y las secciones 8 a 12 nombran
> el shell de SU momento: la barra superior (`TopBar`) con el reloj, la campana y el chip del switch; «MyTube» como nombre
> visible; la solapa «Páginas» de Buscar; el selector «Ciclo (demo)» abajo del menú; el chip «🏅 N» y la medallita de la
> semana sobre el avatar. Todo eso es HISTÓRICO: la barra superior ya no existe y el switch vive en Configuración. Lo
> VIGENTE de cómo se ve y se navega, usuario por usuario, está en §1, §2 y §13.

## 1. Modelo

- **Todo usuario usa las mismas secciones** (en el orden del menú desde el 30-oct: Feed, Buscar, Chat, Mis videos —la
  sección MyTube, ruta `/mytube`—, Mi espacio, Calendario, Aprender, Tienda, After Day). Un **adulto** además tiene
  dependientes y un punto de menú propio al fondo: **Familia** (la ex Zona de padres, sin portón de PIN: es SU menú).
- **Los candados son del dependiente, no del adulto**: apagados de funcionalidades (Tienda/Chat/
  Amigos/Ligas) y el Ciclo del día (§11; antes, los horarios por sección) rigen SOLO cuando el usuario activo es un chico.
  El adulto nunca queda afuera de su propia plataforma.
- Usuarios seed (server, en código — no es config editable):
  - `ian` — Ian, 9, `kind:'child'`, dependiente de `andres`.
  - `luna` — Luna, 12, `kind:'child'`, dependiente de `andres` (U3, 27-oct: §9).
  - `andres` — Andrés, 38, `kind:'adult'`, `dependents:['ian','luna']`.

## 2. Usuario activo (demo)

- El cliente guarda el usuario activo en `localStorage['innerith.user']` (default `'ian'`: la app
  arranca como hoy). **TODA llamada a la API** lleva la cabecera **`X-Innerith-User`**
  (src/api/index.ts lee localStorage UNA vez, al cargar la página —`PAGE_USER`—, y la pone en cada llamada: cada pestaña
  conserva su usuario hasta su próxima recarga). El server la valida contra el
  seed (`actingUser(req)`; desconocida/ausente → `ian`).
- **Switch** (desde SHELL-2, 30-oct): **Configuración → Cambiar de usuario** (`/configuracion`, adonde lleva el avatar de la
  tarjeta de perfil del pie de la barra lateral; `src/sections/settings/components/SwitchUserSection.tsx`). Hasta el 30-oct
  era un chip en la TopBar, a la izquierda de la campana, con un popover: la barra superior ya no existe. La lista es la de
  `GET /api/users`: el activo con su avatar elegido, «N años» o «Adulto» y "· usuario activo"; los demás con el avatar
  `lookFor(nick)`; abajo, la nota "Cambiar de usuario (demo)". Elegir otro → setear localStorage + `location.assign('/')`
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
  `Sidebar` solo filtra secciones para el chico; lo que mostraba la `TopBar` (que ya no existe desde SHELL-2) —los ⚡,
  ahora junto a «Tienda» en el menú, y la posición de liga, ahora en la tarjeta de perfil— lee `useFeatures()`, que con el
  adulto da todo prendido. (Desde U3 el feedFake arma el contenido con la config del CHICO ACTIVO —y con un
  adulto, solo con la protección de fábrica y todo prendido—: §9.)

## 5. Familia (la ex Zona de padres)

- Ruta **`/familia/*`** = los MISMOS paneles, SIN portón (ni AdultGate ni "Cerrar zona de padres").
  Solo adulto: con usuario chico la ruta navega a `/` (y el server responde 401 igual).
  `/padres/*` redirige a `/familia/*` preservando la subruta.
- Menú del adulto: punto **"Familia"** al fondo (debajo de Mi espacio en el menú del 14-oct; desde el 30-oct, debajo de
  After Day), ícono nuevo `IcNavFamily`
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
  `?tab=mentors` cae en Todo —hasta el 30-oct caía en «Páginas»—). En la home de Buscar, sin solapas desde el 30-oct, el
  adulto ve el link «Ver los mentores». Query vacía → el catálogo entero (8); con query → filtro por
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
  contrato dice para quién es), los avisos al padre (etiquetados por chico; PERSISTIDOS desde FS-BASE-A en `alerts.json`,
  fuera del reset: un reinicio ya no borra una crisis sin ver) y la tabla de la semana de la familia
  (U4-B).
- **GLOBAL** (el mundo del demo, igual para todos): el catálogo aprobado de videos, la lista blanca de sitios, la caché de
  artículos y sus veredictos (por huella de temas: U3), el mundo NPC (sus personas y noticias) y las anclas de zona y país.
- **Del DISPOSITIVO** (`localStorage`, no del usuario): volumen del MiniPlayer, repetir, ruidos, URL de route-lab.
- **Los chats del Chat** (desde el 30-oct, tanda BUSCARCHAT): de CADA USUARIO pero en el NAVEGADOR —`localStorage`
  `innerith.chat.v1.<uid>`, hasta 30 conversaciones × 60 mensajes; sin almacenamiento, RAM—. El server sigue sin estado y
  el padre NO los ve (antes vivían en la RAM del cliente y cada carga empezaba vacía).

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
otros usuarios salen con el avatar derivado del nick, no el elegido (sigue igual en Configuración → Cambiar de usuario,
su lugar desde el 30-oct). SALDADOS con U3/M1 (28-oct): la
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
  saben de integrantes). Un v1/v2 migra solo: lo de antes pasa ENTERO a `ian` y el original queda en
  `parent.json.pre-v3` (un checkout viejo leería el v3 como "todo apagado" y lo reescribiría; FS-BASE-B: si ya había un
  `.pre-v3` con OTRO contenido, el de ahora va a `.pre-v3-<ms>`, nunca se saltea). Una `version` desconocida (un "3" de
  texto, un 4) es un archivo ilegible: queda entero en `.roto-<ms>` y arranca CERRADO. Un dependiente sin
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
  `adoptFamilyTz`, también en la pestaña del adulto —el reloj de su barra superior; desde SHELL-2, 30-oct, sin barra ni
  reloj, la usan el almanaque del punto Calendario, el Calendario, Mentores y las fechas de Familia—).
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
  (vuelve al primer integrante); multi-pestaña con usuarios distintos: hoy cada pestaña conserva el usuario con que cargó
  hasta su próxima recarga (`src/api/index.ts` lee `innerith.user` UNA vez por carga —`PAGE_USER`—; la clave sigue siendo
  una por navegador, así que al recargar toma el último elegido en cualquier pestaña) y el BroadcastChannel etiquetado no
  CRUZA configs entre ellas.

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
catálogos) ni los avisos al padre (de la familia; persistidos en `alerts.json` desde FS-BASE-A, así que tampoco se van al
reiniciar). Reiniciar el server = todos al seed (RAM), como siempre.

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
  original queda en `<archivo>.pre-v2` (si ya existe, no se pisa: es el de la primera migración; FS-BASE-B: si tenía OTRO
  contenido, el de ahora va a `<archivo>.pre-v2-<ms>`); un archivo ilegible —o, en `space.json`, con una `version`
  desconocida— queda como `<archivo>.roto-<ms>` y el módulo arranca vacío (antes `space.json` y `learn-results.json` se
  pisaban en silencio con el próximo guardado).
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
canje en el slice de ese integrante (un canje de otro integrante no se toca). FS-BASE-B: los ids de canje son un contador
del PROCESO que solo crece (arranca en los segundos del reloj), así el F5 de un chico ya no los vuelve a 1 y el «Ya se lo
di» de una lista vieja no entrega OTRO canje (responde «ese canje ya no existe»).
Familia → YouTube: `followed` de cada canal = lo sigue ALGÚN integrante; borrar una entrada deja de seguir sus canales en
TODOS los espacios. El chat de un ADULTO le habla por SU nombre y sin la ficha de Smarty de Ian (A7).

**Bordes (U4-A).** "F5 a medias": quien recarga vuelve a su seed y los demás siguen con lo que hicieron (es lo que
significa "tu F5 es tu demo nueva"). Dos pestañas con usuarios distintos: cada una conserva el usuario con que cargó hasta
su próxima recarga (`PAGE_USER` de `src/api/index.ts`, leído una vez por carga; `innerith.user` sigue siendo uno por navegador).
Dos QA con el MISMO usuario contra el mismo server se pisan (cada carga resetea a ese usuario). El guardarropas es RAM por
usuario y el look puesto persiste (identity.json): tras recargar, alguien puede tener la gorra puesta y el guardarropas
vacío (el borde de U1, ahora por usuario). Los guardados de Mi espacio y la wishlist se escriben ANTES de responder
(FS-BASE-B: antes, con un debounce de 250 ms, un reinicio de `tsx watch` en esa ventana perdía la última escritura); si el
disco falla, el cambio no rige y la ruta responde 500.

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
agotar su tipo (Ian: 13 por tipo social) y al reciclar nunca lo de la ráfaga anterior. FS-BASE-B: si esas reglas trababan
una ráfaga (la 7.ª de Luna repetía a CataEstrella), ganan los protagonistas distintos: un tipo trabado recicla antes de
agotarse lo mínimo indispensable (nunca lo de la anterior). Sigue siendo POR USUARIO y de quien
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
  solapa no existe y `?tab=people` cae en Páginas —desde el 30-oct, en Todo—, como Mentores con un chico), la campana de la
  TopBar (es solo social: solicitudes + no leídos del dock; con un adulto no se piden ni cuentan y no hay campana —HISTÓRICO:
  la campana se fue con SHELL-2 para todos, §13—), la zona pinneada del Feed (las solicitudes no se piden; hoy la zona
  Destacado, que al adulto le muestra solo el hero; tampoco las cuenta el circulito del Feed) y "Regalar" en la ropa de la Tienda (la hoja le diría "cuando aceptes una solicitud…", algo
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
  los puede seguir en su MyTube." (cada uno sigue lo suyo; desde el 30-oct el panel dice «Mis videos»).
- **Mi espacio.** `FolderSheet`: la "última carpeta usada" es por usuario (`innerith.lastFolder:<id>`; la clave vieja sin
  usuario se ignora).
- **Bordes (U4-C).** La campana desaparece para el adulto (hoy su único contenido es social: si un día tiene avisos propios,
  vuelve con ellos; HISTÓRICO: desde SHELL-2 no hay campana para nadie). `?tab=people` con un adulto deja la URL como está y
  muestra Páginas (igual que `?tab=mentors` con un chico; desde el 30-oct, Todo). El aviso "Resultados solo de fuentes verificadas para chicos" de Buscar también lo ve el adulto: es cierto (lo
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

**Regla de disponibilidad — los rangos son MOMENTOS EXCLUSIVOS** (desde el 29-oct; detalle y verificación en «Rangos
exclusivos (29-oct)» al final de esta sección). Solo con un CHICO activo — al adulto no lo gatea nada, como antes;
`src/shared/lib/cycleRules.ts` —mudado de `server/src/` en F2: el mismo código en server y cliente—, puro y con tests en
`server/src/__tests__/cycleRules.test.ts` y, por el 403 real, `server/src/__tests__/cycleGate.test.ts`. El reloj es el del
server leído en la ZONA HORARIA DE LA FAMILIA (`parent.json` `tz`; null = la del server):
- **¿algún rango vivo está EN CURSO** (el reloj cae en su [from, to))? → disponible = la sección figura en la UNIÓN de las
  `sections` de los rangos en curso (los solapados suman). Nada más: lo que no lista ninguno de ellos, cerrado — también
  lo que no figura en ningún rango. Una lista VACÍA en curso cierra todo (es explícita);
- **¿ninguno en curso?** → una sección que figura en ≥ 1 rango, cerrada (solo abre en sus rangos); la que no figura en
  ninguno, disponible. Sin rangos, todo disponible siempre;
- **fail-open intacto** (la regla de la casa): un rango VIVO es un objeto con horas HH:MM válidas y `sections` lista; uno
  roto no cierra nada (nunca está en curso ni hace "figurar" a una sección) y, como antes, si sus horas son inválidas ABRE
  las 24 h las secciones que lista; una lista de rangos que no es lista o cualquier excepción al evaluar → disponible;
- el Feed nunca se cierra;
- `opensAt` (el "se abre de nuevo a las…" del 403) = el próximo minuto de HOY en que pasa a disponible, "HH:MM" (p. ej.
  Chat, cerrado por un After Day de 21 a 22, abre a las 22:00), o null (disponible, hoy ya no abre —no se promete mañana,
  mismo espíritu que W7— o con override). Se calcula genérico: barriendo los cortes from/to de los rangos vivos del día.

**Override de DEMO** ("estás en este rango"). `POST /api/demo/cycle {rangeId}`: el integrante se evalúa COMO SI el reloj
estuviera dentro de ese rango, en serio exclusivo — disponible = EXACTAMENTE sus secciones (desde el 29-oct también se cierran
las que no figuran en ningún rango; antes quedaban abiertas); un solapamiento con otro rango NO abre nada. Un rango roto no
sirve de override (rige el reloj real). Con override no hay `opensAt` (no sigue al reloj). `null` = reloj real. RAM y POR USUARIO (`perUser`): lo limpia `POST
/api/demo/reset` de ESE usuario (`{scope:'all'}`: todos) y también guardar un ciclo que ya no trae ese rango; un id que ya no
existe = reloj real. Chico activo → SU override (`member` se ignora: nunca toca a un hermano). **Aditivo de F1** (decisión del
implementador, para que F2 pueda poner el selector también en Familia): con un ADULTO activo, `?member=<id>` elige el del
integrante (misma regla `memberFor`; ajeno → 400; sin integrantes → 400). El override es del integrante: si lo elige el
adulto, lo limpia el F5 del CHICO (no el del adulto).

**Persistencia.** `server/data/schedules.json` **v3** `{version: 3, members: {[id]: {ranges: CycleRange[]}}}` (config del
padre: fuera del reset; escritura atómica; sin entrada = sin rangos = todo disponible). Migración (`familyMigrate.ts:
upgradeCycleRaw`, pura, con tests): un v1/v2 **NO se convierte** — una semana por sección no es "en este rango del día, estas
secciones", y adivinar podría encerrar al chico —; el original queda en `schedules.json.pre-v3` (FS-BASE-B: o en
`.pre-v3-<ms>` si ya había otro; sin respaldo escrito no se reescribe nada; una `version` desconocida va entera a
`.roto-<ms>`) y cada integrante
arranca con `ranges: []` (en este repo: el v2 era `{ian: {}, luna: {}}`, sin horarios cargados; no se perdió nada). Al leer,
lo raro de un archivo editado a mano se sanea SIN cambiar la disponibilidad (`sanitizeStoredRanges`, 29-oct: horas
inválidas → vacías —el rango sigue roto: no cierra nada, abre lo suyo las 24 h y el editor lo marca «Revisá las horas»—, un
rango cuyas secciones no son lista sale, secciones desconocidas afuera, ids/nombres nuevos) con aviso en el log; ilegible →
`.roto-<ms>` y todo disponible. ⚠ Un checkout
pre-F1 con el server corriendo leería el v3 como un v1 y lo reescribiría como v2 (los rangos quedarían adentro de
`members.ian`, recuperables a mano): no hacerlo.

**Contratos (congelados; `src/api/types.ts`, aditivos).**

```
CycleRange       {id, name, from, to, sections: SectionKey[]}
CycleConfig      {ranges: CycleRange[]}
CycleResponse    {cycle, member, serverNow, tz, serverTz, demoRange}   (serverTz: ADITIVO de FS-BASE-B, ver abajo)
CycleSaveRequest {ranges: (CycleRange con id opcional)[]}
DemoCycleRequest {rangeId: string | null}
SchedulesResponse {serverNow, tz, serverTz, member, cycle, demoRange}   (sin `schedules`: la compat de F1 se retiró, ver abajo)

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
Hoy la respuesta es SOLO `{serverNow, tz, serverTz, member, cycle, demoRange}`. `serverTz` (FS-BASE-B, aditivo) = la zona
IANA del server, la que rige con `tz` null ("Automática"): el cliente evalúa el menú, "descansando", el Calendario y Mentores
con `tz ?? serverTz` (antes, con tz null, usaba la del NAVEGADOR y no coincidía con el 403 si estaban en zonas distintas).
`POST /api/parent/schedules` sigue en 410.

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
atrasado DESPUÉS de un borde (su tick; el server no: enforcea al minuto). Un rango sin secciones es válido (desde el 29-oct:
en curso —o elegido en el selector de la demo— cierra TODO salvo el Feed).

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
  tocar = play/pausa del audio de fondo (29-oct: el disco lleva la nota musical, en color sonando y en blanco y negro en
  pausa) y «Ver» = el video contenido, también para el adulto). Retirado `AfterDayMusicPanel.tsx`.
- **Ciclo del día** (`containers/CyclePanel.tsx` + `components/CycleRangeCard.tsx`; lo puro en `lib/cycleDraft.ts` con tests):
  `GET /api/parent/cycle?member` → borrador; por rango: nombre, desde/hasta (`<input type="time">`), "Rige de 14:00 a 18:00,
  todos los días" (o "cruza la medianoche" / "todo el día" / "Revisá las horas"), las 8 secciones como fichas (`aria-pressed`) y
  «Borrar»; «+ Agregar rango» (máx. 8; arranca donde termina el último, 3 h); «Guardar ciclo» (solo con cambios) manda la lista
  ENTERA (`api.parentCycleSave`, los nuevos sin id) y un 400 se muestra con el `error` del server tal cual (`rejectedReason`;
  el cliente NO pre-valida: una hora vacía viaja vacía); «Descartar cambios». Arriba, la regla (desde el 29-oct: "Durante un
  rango, {kid} solo tiene lo que marcaste en ese rango (si dos rangos se pisan, suma lo de los dos); fuera de todo rango,
  tiene lo que no está en ninguno. El Feed nunca se cierra.") y la hora de la familia con el link a Límites (la leyenda de
  abajo, "siempre disponibles para {kid}…", se SACÓ el 29-oct: pedido de Esteban). Badges "Ahora" (el reloj de la familia cae en el rango) y "En la demo, {kid}
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
  tz/delta y, ProfileCard, `isSectionOpen('tienda')`). (La TopBar ya no existe desde SHELL-2; el almanaque del punto
  Calendario del Sidebar también lee la `tz` de `useCycle`.)
- **Retirado**: `SchedulesPanel.tsx`, `lib/schedules.ts`, `api.parentSchedules`, `normalizeSchedule`/`defaultSchedule`/
  `DEFAULT_DAY`/`SCHEDULABLE`, su test y los estilos `pz-sch-*`. Después, con la retirada de la compat, también
  `lib/scheduleRules.ts` entero (`isOpenAt`/`nextOpenLabelAt`, que solo los usaba el bloque «compat» del test, retirado junto).
- **Selector de demo** «Ciclo (demo)» (`containers/CycleDemoControl.tsx` + `components/CycleDemoPicker.tsx`, CSS `cyd-` en
  shell.css). HISTÓRICO lo de dónde vive: desde el 30-oct está en **Configuración** (`/configuracion`) y, con el adulto,
  aparece siempre ahí (sobre el integrante del `?m=` o, sin él, el primero; solo si tiene rangos) — ver §13. En F2 vivía
  abajo del menú, arriba del MiniPlayer: un `<select>` con borde punteado (lenguaje de los chips de demo): "Reloj
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

**Rangos exclusivos (29-oct, pedido de Esteban; sin commitear).** Pedido: «Chat, Buscar, MyTube, Aprender, Tienda,
Calendario y Mi espacio no tienen que estar en los rangos after day. Todos tienen que por default no tienen que aparecer, solo
los que específicamente se indiquen tiene que aparecer.» Con la regla de F1 («lo que no figura en ningún rango, siempre
disponible»), durante el After Day de Ian (21–22, `sections: [afterday]`) el menú le seguía mostrando TODO. Ahora un rango es
un momento exclusivo: mientras está en curso, solo lo que lista (la regla completa, arriba en «Regla de disponibilidad»).
- **Código.** `src/shared/lib/cycleRules.ts` (cabecera reescrita con la regla punto por punto): el evaluador junta los rangos
  VIVOS en curso y responde con su unión; sin ninguno en curso, lo de antes. `rangeCovers` con horas inválidas pasó a `false`
  (un rango roto nunca está "en curso": estar en curso ahora CIERRA); `findRange` solo devuelve rangos vivos (un override
  sobre un rango roto = reloj real); `opensAtToday` barre los cortes from/to del día en vez de minuto a minuto (mismo
  resultado: test contra fuerza bruta). `sanitizeStoredRanges` cambió para no encerrar con la regla nueva (horas inválidas →
  vacías en vez de 24 h; secciones que no son lista → el rango sale en vez de quedar vacío). Server (`schedule.ts`, el 403) y
  cliente (`lib/cycle.ts`: menú, "descansando", selector de demo) usan ese mismo código: no se tocaron. Contratos: sin cambios.
- **Editor.** Un rango nuevo ya arrancaba sin secciones (`cycleDraft.newRange`, test existente). Cambiaron los textos de
  la regla del panel («Durante un rango, {kid} solo tiene lo que marcaste en ese rango…; fuera de todo rango, tiene lo que no
  está en ninguno») y del aviso de un rango sin secciones («mientras dure este rango, {kid} solo tiene el Feed…»). La leyenda
  del pie («Fuera de los rangos, Ian tiene Chat, Buscar… y el Feed»; antes «Siempre disponibles para…») se ELIMINÓ por pedido
  de Esteban («No es necesario toda esta aclaración»): sin párrafo, sin `freeSections` (cycleDraft.ts y su test) y sin el CSS
  `.pz-cy-free`.
- **Tests.** `cycleRules.test.ts` 22 → 42 (los que fijaban «no figura → disponible DURANTE un rango ajeno», el override
  que dejaba abierto lo de ningún rango y el saneo a 24 h se ajustaron con el porqué en la línea; casos nuevos: el ciclo real
  de Ian a las 21:30/15:00 y sus bordes, Luna sin rangos, solapados, lista vacía en curso, rango roto, override exclusivo,
  medianoche, opensAt = fuerza bruta en 40 ciclos, saneo = crudo minuto a minuto); `cycleGate.test.ts` nuevo (6: el 403 real
  por `index.ts` con un schedules.json PROPIO en una carpeta temporal —Ian 21:30/15:00, override, Luna, y un adulto con un
  ciclo que lo cerraría todo y no lo alcanza—); `cycle.test.ts` del cliente +1 (el menú de Ian) y el override ajustado.
  Mutaciones en un espejo (13 a `cycleRules.ts` + quitar el "solo chico" de `index.ts`): todas mueren.
- **Verificado (29-oct).** `npx tsc -b` y `tsc -p tsconfig.server.json` en 0; `npm test` verde (69 archivos, 738 tests en
  ese momento, con trabajo en paralelo de otras tandas). E2E con Chrome headless contra un ESPEJO (copia de server/ y
  server/data en el scratchpad, API 8796 + web 5198; los puertos del usuario y su `schedules.json` intactos), con la zona de la
  familia del espejo corrida para estar a las 21:xx y a las 15:xx: Ian a las 21:37 ve Feed + After Day (nada más), `/calendario`
  descansa con «Se abre de nuevo a las 22:00.» y la API de las otras 7 secciones da 403 `opensAt: "22:00"`; a las 15:37 ve todo
  menos After Day, `/afterday` descansa con «…a las 21:00.» (403 `opensAt: "21:00"`); el selector de demo en «Rango 1» deja
  solo After Day sin recargar (Calendario 403 sin `opensAt`) y «Reloj real» lo vuelve; Luna y el adulto ven todo; en Familia →
  Ciclo del día la regla nueva y un rango nuevo con las 8 fichas apagadas (no se guardó). 32/32, consola limpia.
- **Bordes.** Una lista vacía en curso cierra todo (explícita). Los solapados suman, también con un rango de 24 h (es un
  momento permanente: "fuera de todo rango" no pasa nunca). Medianoche: `opensAt` sigue sin mirar mañana (a las 23:00 dentro
  de un 21–07, null). Una entrada desconocida DENTRO de una lista (`"feed"`, la sección de un checkout futuro) no abre nada:
  la lista sigue siendo explícita. Un rango con horas vacías (saneado) aparece en el selector de la demo pero no se puede
  elegir (`POST /api/demo/cycle` → 400 «Ese rango no está en el ciclo…»): un rango roto no sirve de override.

## 12. U5 — La liga de la familia completa y las medallas (28-oct)

> Spec del arquitecto: `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` (manda sobre esta sección; acá queda lo HECHO). Decisiones del
> dueño (las 4 recomendaciones de su §10): **D1** el premio arranca preseleccionado "para todos los que superen su semana"
> ("el que gane la semana" a un toque) · **D2** el reto cuenta "N de 7 días", no días seguidos (el server igual manda
> `bestRun`) · **D3** medallas en RAM sembradas desde los hechos, sin `medals.json` · **D4** solo el ADULTO cierra la semana de
> la familia y pone el premio. Tandas: **U5-A server de la liga + TODOS los contratos** (hecha, 28-oct: esta parte) → U5-B
> server de medallas ∥ U5-C cliente de la liga → U5-D cliente de medallas → U5-E QA.

<!-- U5-A abre la sección (modelo, contratos, seeds). U5-B, U5-C y U5-D suman su subsección AL FINAL, con anclas propias. -->

**Modelo (U5-A).** La tabla de la familia de U4 (`GET /api/leagues/family`: adultos + chicos con Ligas prendidas, XP → racha →
seed) pasa a tener **semana con estado de la FAMILIA**: una vez por familia, clave `users.familyKeyOf(id)` (el primer adulto
guardián en el orden del seed; en el seed, `andres` para los tres), en RAM de `leaguesFake.ts` (regla 7: el ciclo semanal tiene
UNA fuente) con `{weekStart, week, closedAt, prize, history (≤ 8, la más nueva primero), crowns}`. La lógica PURA del cierre
vive aparte, en `server/src/familyWeek.ts` (con tests). La semana es la MISMA de la XP y del ciclo público: lunes 00:00 →
domingo 23:59 en la zona de la familia (`parent.json` `tz`).
- **Cierre** (`familyWeek.closeFamilyWeek`): orden de la tabla en vivo; marcas **solo positivas** — 🏆 `gano` (SOLO el 1.º,
  con XP > 0 y ≥ 2 filas; empate en la punta: desempata racha → seed), ↑ `supero` (`prevXp !== null && xp > prevXp`, contra SU
  semana anterior registrada; alcanzable por todos, adulto incluido) y ✨ `siete` (aprendió algo nuevo los 7 días) —; `total`
  (la línea cooperativa "Entre todos sumaron N XP"); el resumen NO tiene puestos ni "último".
- **Premio del adulto** (un TEXTO fijo: sin ⚡, sin sorteo, sin magnitud variable): copiado de un premio NO archivado de la
  Tienda de un chico (lo prometido no cambia si después lo edita o archiva; no toca su stock) o "Uno nuevo" con la MISMA
  validación de un premio de la Tienda (`parent.checkPrizeFields`, mismos textos). Condición `supera-su-semana` (cada chico con
  ↑) o `gana-la-semana` (el o los chicos con la mayor XP entre los CHICOS; empate = los dos; 0 = nadie). **Solo los chicos
  cobran**: si gana la tabla el adulto, el premio va al chico mejor ubicado. Con ganadores el premio se consume; **sin
  ganadores sigue en juego** la semana siguiente. A cada ganador, un canje PENDIENTE en SU slice de la Tienda
  (`market.grantFamilyPrize`: `itemId 0`, `price 0`, `origin: 'liga-familia'`, `closedAt`): aparece en `GET
  /api/market/redemptions` del chico y en Familia (`activity.redemptions`), y lo entrega el MISMO `POST /api/parent/deliver`.
  Ni al ponerlo, ni al ganarlo, ni al entregarlo se mueve un ⚡.
- **Reto de constancia** ("¿quién aprende más días esta semana?"): `progress.ts` lleva `weekDays` (los días de la semana
  abierta con aprendizaje NUEVO — el mismo evento que mueve la racha, `addXp` con monto > 0, marcado FUERA de `touchStreak`
  para que tras un cierre simulado el mismo día la próxima posta cuente) → `days` (0-7) y `bestRun` en cada fila. Solo sube
  dentro de la semana, arranca de cero en cada corte, nunca "se rompe" y no tiene premio propio.
- **Todo corte de semana guarda la semana** (`progress.ts`): el lunes real (`rollWeek`, perezoso) y el cierre simulado
  (`startNewWeek`) guardan `lastWeek = {weekStart, xp, days, prevXp}` antes de poner la XP en 0, y mueven los hechos de las
  medallas (`pbWeeks` si superó su semana, `fullWeeks` con los 7 días; además `addXp` lleva `bestStreak` y `comebacks` —volver
  tras ≥ 3 días de calendario—). Así el cierre de la familia, el de "Mi liga" y el lunes real dicen lo mismo.
- **Cierre SIMULADO** (`POST /api/leagues/family/close-week`, solo adulto): foto de la tabla → premio → copa (`crowns[id]++`,
  contador monotónico) → historial (`week++`, `closedAt`) → las ligas PÚBLICAS de TODOS los integrantes (`runAsUser(id,
  closeWeek)` en el orden del seed, también los chicos con Ligas apagadas: cada uno su medalla de podio, su noticia en SU feed y
  su `startNewWeek`) → (U5-B: medallas; está el comentario en el punto exacto) → `{closed, mine}`. Después la familia sigue el
  calendario corrido del demo (`closesInDays` = 7 − días reales desde el cierre) y el cierre real perezoso queda apagado para
  esa familia hasta `{scope:'all'}`.
- **Cierre REAL, perezoso** (`leaguesFake.familyCloseIfDue`): lo dispara `index.ts` ANTES de rutear (y antes de los candados)
  `/api/leagues/*`, `/api/parent/activity`, `/api/market/redemptions` y `/api/medals*` y —revisión de U5— el reset del activo
  (`POST /api/demo/reset` sin `{scope:'all'}`; `server/src/demoReset.ts`): abrir la app resetea PRIMERO al que abre, así que la
  foto se saca ANTES de re-sembrarlo (si no, tomaba su «semana pasada» del seed, que cae justo en la semana abierta) y lo que ese
  cierre le da a él —el canje del premio, la copa (como Nueva)— entra DESPUÉS de su re-siembra; su «Superaste tu semana» de ese
  corte, no (sale de su progreso en RAM, que su F5 re-siembra). Si no hubo cierre simulado y el lunes de
  la familia ya pasó, cierra la semana que estaba abierta con el `lastWeek` de cada uno (si su `weekStart` coincide; si no,
  entra con 0), reparte copa y premio y deja abierta la de hoy; `closedAt` = el lunes 00:00 de la familia que la cerró. Varias
  semanas sin uso → se cierra UNA. Las ligas PÚBLICAS no cierran solas (backend futuro).
- **Reset**: la semana de la familia es RAM de la FAMILIA (los avisos, que antes también lo eran, persisten desde FS-BASE-A): el F5 de un integrante (`POST /api/demo/reset` sin
  cuerpo) NO la toca —solo cierra antes la semana que ya estaba pendiente, ver arriba—; `{scope:'all'}` (`resetFamilyWeeks()`) y
  reiniciar el server la vuelven al seed.

**Contratos (CONGELADOS por U5-A en `src/api/types.ts`; aditivos, los campos nuevos de tipos existentes van opcionales en el
tipo y el server de U5 los manda SIEMPRE).** Tipos nuevos: `FamilyPrizeCondition`, `FamilyWeekPrize`, `FamilyWeekMark`,
`FamilyWeekClosedRow`, `FamilyWeekClosed`, `FamilyCloseResult`, `FamilyPrizeOptions`, `FamilyPrizeRequest`, `MedalId`,
`EarnedMedal`, `MedalsResponse`. Aditivos: `FamilyLeagueRow += {days, bestRun, prevXp, wonLastWeek?, prizeEligible?}`
(`streakDays` NO se retira) · `FamilyLeague += {prize, history, canManage, week}` · `Redemption += {origin?, closedAt?}` ·
`ParentActivity += {medals?}` (lo sirve U5-B). El kind `medal` de `FeedItem` lo sumó U5-B (aditivo; la tarjeta es de U5-D).
Revisión de U5 (aditivo): `FamilyWeekClosed += {prizeInPlay?}` —el premio de ESA semana sigue en juego HOY (sin ganadores y es el
vigente: mismo `setAt`); `prize.winners: []` solo dice que nadie lo ganó al cerrar—.

```
GET  /api/leagues/family                     → FamilyLeague (U4 + U5)          · chico con Ligas apagadas: 403 (U4, igual)
POST /api/leagues/family/prize {FamilyPrizeRequest} → FamilyLeague (con el premio; reemplaza al anterior)
       403 chico {error:'El premio de la semana lo pone un adulto de la familia.'}  · 405 con GET
       400 {error}: 'Elegí para quién es el premio.' · 'Ese integrante no es de tu familia.' · 'Ese premio ya no está en la
           Tienda de {nombre}.' · los de checkPrizeFields ('El título tiene que tener entre 2 y 60 caracteres.' · 'La
           descripción admite hasta 140 caracteres.' · 'Elegí un emoji para el premio (por ejemplo 🎮).') · 'Ninguno de tus
           chicos está jugando la liga de la familia (tienen Ligas apagadas).' · 'Pedido inválido (se esperaba JSON).'
POST /api/leagues/family/prize/clear         → FamilyLeague (prize null)       · 403 chico (mismo texto) · 405 con GET
GET  /api/leagues/family/prize-options       → FamilyPrizeOptions              · 403 chico (mismo texto) · 405 con POST
POST /api/leagues/family/close-week          → FamilyCloseResult {closed, mine} · 405 con GET
       403 chico {error:'El cierre de la semana de la familia lo hace un adulto.'}
       400 {error:'La liga de la familia necesita al menos dos integrantes.'}
GET  /api/market/redemptions                 → igual; incluye los canjes origin 'liga-familia' del activo
GET  /api/parent/activity?member             → igual; sus redemptions incluyen el canje de la liga de M
POST /api/parent/deliver?member {id}         → igual; entrega también un canje 'liga-familia' de M
POST /api/demo/reset                         → igual; además, SOLO con {scope:'all'}, resetFamilyWeeks(); sin él, ANTES cierra la
                                               semana de la familia si estaba pendiente (revisión de U5)
```
Orden de cada pedido a `/api/leagues/*`: 403 de Ligas apagadas del chico (todo `/api/leagues/family*` lo hereda) → las rutas
de la familia (antes del 405 genérico) → lo de siempre. Un adulto nunca recibe 403 en nada de esto.

**Seeds (tal como quedaron; para U5-C).** La "semana pasada" de la familia sale de `closeFamilyWeek` sobre el `lastWeek`
SEMBRADO (`progress.seedLastWeekOf`, nunca el progreso vivo). Los días salen de `familyWeek.seedWeekDays(racha, díaDeLaSemana,
deseado)`: dependen del DÍA de hoy (coherentes con la racha).

| | Ian (9) | Luna (12) | Andrés (adulto) |
|---|---|---|---|
| Esta semana: XP · racha (U4, sin cambios) | 1.240 · 5 | 1.290 · 9 | 450 · 2 |
| Esta semana: días (`days`) | min(5, día+1) — miércoles: 3 | día+1 — miércoles: 3 | min(2, día+1) — miércoles: 2 |
| Semana pasada del seed (`prevXp`) · días | 1.180 · 6 | 1.350 · 7 lunes/martes, 6 de miércoles a domingo | 300 · 3 |
| En el historial sembrado | — | 🏆 (+ ✨ un lunes o martes) | — |
| En vivo, contra su semana pasada | ↑ ya superada (1.240 > 1.180) | le faltan 61 XP (la UI no lo dice) | ↑ ya superada (450 > 300) |
| Hechos de medallas fijos (`bestStreak · comebacks · pbWeeks · fullWeeks`) | 5 · 0 · 0 · 0 | 9 · 0 · 0 · 1 | 2 · 0 · 0 · 0 |
| Copas (`crowns`) | 0 | 1 | 0 |

Historial sembrado: `[{week: 0, simulated: false, total: 2830, prize: null, label: 'la semana pasada', rows: Luna 1.350 🏆 ·
Ian 1.180 · Andrés 300}]` (sin ↑: la semana anterior a ésa no existe). Primer cierre simulado con el seed: 🏆 Luna · ↑ Ian ·
↑ Andrés · total 2.980; con "supera su semana" cobra Ian (Luna 1.290 < 1.350); con "gana la semana", Luna.

**Bordes (U5-A).** "F5 a medias": el historial y el premio son de la familia y sobreviven al F5 de un integrante; el canje del
premio vive en el slice del chico y se va con SU F5 (el historial sigue diciendo que lo ganó: correcto como historia). Tras el
F5 de un integrante después de un cierre, su XP vuelve a la del seed mientras la de los demás sigue en 0, y su `prevXp` también:
el ↑ de su fila se compara contra la semana pasada SEMBRADA, no contra la que acaba de cerrar (la tarjeta «La semana pasada»
conserva la semana real). Pasa igual con el F5 que dispara el cierre del lunes (`demoReset.ts`: el reset del que abre corre
entre la foto y el reparto). El cierre individual de "Mi liga" desincroniza (la foto de la familia toma la XP de ese integrante
desde SU cierre); el de la familia los realinea.
Un chico al que le apagan Ligas sale de la tabla y del premio, pero su liga pública cierra igual con la de la familia y sus
marcas viejas siguen en el historial (el historial sembrado nombra a todos: es historia de la familia). **Premio huérfano**
(comportamiento actual; decisión de producto pendiente): si con el premio puesto se le apagan Ligas a TODOS los chicos, el
premio queda puesto y el adulto se queda sin solapa Familia en Ligas para quitarlo (una sola fila); en Familia → Premios lo
sigue viendo, pero esa línea es de solo lectura y su link cae en Mi liga: para quitarlo hay que volver a prender Ligas a un
chico. Si en el medio pasa un lunes, el cierre va con una sola fila y sin copa, el premio no se consume (no hay chicos que lo
ganen) y, al volver a prender Ligas, el chico ve «… sigue en juego» de una semana que no jugó. Tras varias semanas
sin uso, el cierre real cierra una sola y la rotula por posición. El seed calcula los días con el día de la semana del
momento en que NACE cada slice: un slice nacido el lunes y leído el miércoles conserva sus días del lunes (quirk heredado
del seed fijo, como la XP del seed que no escala con el día).

**Verificado (U5-A, 28-oct, dev del usuario 8787; solo `curl`/urllib contra localhost).** `npx tsc -b --force` y `npx tsc -p
tsconfig.server.json --noEmit` limpios · `npm run build` verde · `npm test`: 36 archivos / 380 tests (antes 32 / 316; U5-A suma
`familyWeek.test.ts`, `familyLeague.test.ts`, `marketFamilyPrize.test.ts` y 10 casos en `progressWeek.test.ts`; el resto de la
diferencia es de otra tanda en paralelo). Humo por API, 64 chequeos OK: el seed (🏆 Luna 1.350, total 2.830, sin ↑, `prevXp`
1.180/1.350/300, `canManage` solo el adulto); 403 con su texto para cada POST/GET de familia de un chico, 405 con el método
equivocado, 401 de Familia para un chico; cada 400 con su texto literal; premio copiado de la Tienda de Luna y archivar el
original no lo cambia; cierre simulado (marcas correctas, nada negativo, total 2.980, canje solo para Ian, `mine` = Liga
Chispa); ⚡ y movimientos de los tres IGUALES antes/después de cerrar y de entregar; las tres ligas públicas cerradas;
"Ya se lo di" (con otro integrante → `ok:false`); el F5 de Ian no toca el historial y `{scope:'all'}` sí; sin ganadores el
premio sigue en juego; "gana la semana" → Luna; la zona de la familia rige el corte (Kiritimati/Pago Pago mueven
`closesInDays` igual en la familia y en la liga pública). **NO verificado en vivo**: el cierre real de un lunes (necesita mover
el reloj del server): cubierto por `familyLeague.test.ts` con reloj falso (el camino con el reset de quien abre la app, por
`familyMonday.test.ts` desde la revisión de U5). Estado: `server/data` idéntico byte a byte al
respaldo (el archivar/reactivar dejó un `updatedAt` en `parent.json`: se restauró y se forzó la recarga del API) y la RAM en
el seed (`{scope:'all'}`).

**Para U5-B (medallas, server).** Hechos listos: `progress.medalCountersOf(id)` → `{bestStreak, comebacks, pbWeeks, fullWeeks}`
(o el registro de una línea en `progress.ts`), `leaguesFake.crownsOf(id)`. Puntos de disparo marcados con `// U5-B:` en
`leaguesFake.ts`: el paso 6 del cierre simulado y el final de `familyCloseIfDue` (allí hay que sincronizar a CADA integrante
bajo SU `runAsUser`: el contexto es el de quien abrió la app); falta además el `syncMedals` después de `startNewWeek` en
`closeWeek`. `index.ts` ya llama `familyCloseIfDue` antes de `/api/medals` y `/api/medals/*`. `ParentActivity.medals`,
`EarnedMedal`, `MedalsResponse` y `MedalId` ya están en `types.ts`.

**Para U5-C (cliente de la liga).** Todo en `types.ts`. ⚠ Los 6 envoltorios de `src/api/index.ts` (`familyPrizeOptions()`,
`setFamilyPrize(req)`, `clearFamilyPrize()`, `closeFamilyWeek()`, `medals()`, `medalsSeen()`) **NO están**: el brief de esta
tanda prohibía tocar `src/` fuera de `types.ts` (otra tanda trabajaba en el shell del cliente); los suma U5-C (o el
coordinador) con el patrón de los de al lado (`familyLeague`, `closeWeek`). El ↑ de la fila es `prevXp != null && xp >
prevXp`; la 🏆 chiquita, `wonLastWeek`; "Repetir el de la semana pasada" sale de `history[0].prize` (hoy se re-envía como
texto literal —emoji, título y descripción—, SIN `from` aunque haya sido de la Tienda: ver 12.C); el chip del pie se ofrece
con `canManage` y ≥ 2 filas.

<!-- U5-B: medallas de la plataforma (server). -->
### 12.B Las medallas de la plataforma — server (U5-B, 28/29-oct)

**Modelo.** 13 medallas "estilo GitHub" (audio 1016) que se DERIVAN de hechos, nunca se entregan a mano. Reglas PURAS en
`server/src/medalRules.ts` (catálogo con los textos literales de la spec §5.2, `learnFactsFrom`, `earnedFrom`, `sortMedals`);
estado y rutas en `server/src/medals.ts`, HOJA del grafo (importa solo `perUser`, `requestContext`, `users`, `web` y
`medalRules`): cada dueño de un dato REGISTRA su parte al cargar (`registerMedalFacts`) — `learnResults` (sus filas + el
catálogo), `learnRoutes` (`createdBy`), `space` (`savedFactsOf`: papelera incluida, lo purgado no), `friendsFake`
(`friendCountOf`), `progress` (`bestStreak`, `comebacks`, `pbWeeks`, `fullWeeks`) y `leaguesFake` (`crownsOf`); `feedFake`
registra el sumidero de la noticia y `parent` el gate de los candados (un adulto siempre ve lo suyo: `featureOn` de un adulto
es `false` por fail-closed).
- **Estado (D3: RAM por usuario, sin archivo).** `{earned: Map<id, {at, times}>, seen}`. Seed = lo que derivan los hechos de
  ESE momento, todo visto. `syncMedals(uid)` agrega lo que se cumple y no estaba (`at` = la fecha del hecho si la trae, si no
  ahora), sube `times` de las repetibles (max) y NUNCA saca nada; por cada medalla NUEVA, UNA noticia en el feed DEL DUEÑO
  (si el pedido es de otro, la emite bajo `runAsUser(uid)`). Idempotente. Un `times` que sube no es noticia.
- **Cuándo se sincroniza** (con `ensureMedals` ANTES de mover el hecho, así lo nuevo no entra al seed como "visto"):
  `POST /api/learn/results` (las dos ramas, antes de responder); `saveItem` de Mi espacio; aceptar un amigo y el
  "auto-aceptar" del NPC (que el código resuelve al LEER en `settleOutgoing`, no con timer); importar una ruta;
  `closeWeek` (después de `startNewWeek` y de las noticias del cierre); el cierre simulado de la familia (paso 6, cada uno
  bajo SU `runAsUser`; antes de la copa, los slices de todos existen); el cierre real perezoso (ídem); `GET /api/medals`
  (red de seguridad) y `GET /api/parent/activity` (bajo el `runAsUser` del integrante).
- **Feed.** Kind ADITIVO `medal` (`{kind, id: 'fm-<n>', time: 'recién', reason: 'Es tu medalla nueva', medal: EarnedMedal}`,
  sin `fresh` ni reacciones) en lo vivo del usuario (`pushFresh`: píldora "N novedades ↑"). Al servir: la copa solo con
  Ligas prendido, el primer amigo solo con Amigos, las palabras/temas de la familia filtran título + texto; el resumen de
  la edición no la cuenta.
- **Reset.** `POST /api/demo/reset` llama `resetMedals(id)` AL FINAL (cuando progreso, amigos y la semana de la familia ya
  volvieron al seed): re-siembra EN EL ACTO; con `{scope:'all'}`, a los tres del seed.

**Catálogo final: 13** (veredicto de `ruta-creada`: SE QUEDA). `createdBy` es un metadato aditivo de la fila de
`learn-routes.json` que no se sirve en ninguna respuesta (`listItems` y `/one` mapean campos explícitos; verificado por API)
ni cambia la validación, los mensajes, el reemplazo transaccional ni el orden del importador del porte; nadie más lee ese
archivo. El autor es quien importó la ruta POR PRIMERA VEZ: una reimportación (editarla en /crear) CONSERVA el autor (o la
falta de autor: la seed poc-solar y las filas de antes de U5 quedan sin autor para siempre). Revisión de U5: también `createdAt`
(la fecha de esa PRIMERA importación, la de «Tu primera ruta»; antes salía de `importedAt`, que cada reimportación pisa), con el
mismo criterio: solo en filas con autor, no se sirve, la reimportación lo conserva (una fila con autor de antes lo toma de su
último `importedAt` al reimportarse).

| id | Medalla | Hecho | Candado | Repetible |
|---|---|---|---|---|
| `primera-posta` | 🎯 Primera posta | ≥ 1 objetivo con fila `completed` no `rollup` (fecha: esa fila) | — | no |
| `diez-objetivos` | 🧠 Diez objetivos | ≥ 10 objetivos distintos así (fecha: la del 10.º) | — | no |
| `ruta-completa` | 🗺️ Ruta completa | rutas del catálogo con todas sus postas logradas con partidas COMPLETADAS (`routeRuns` sobre esas filas: rendirse o el tiempo no cuentan, a diferencia del camino; fecha: la fila que completó la primera; revisión de U5) | — | ×N rutas |
| `posta-perfecta` | 💯 Sin un error | una fila `completed` no `rollup` con pct 1 | — | no |
| `primer-repaso` | 🔁 Primer repaso | una fila `completed` con source `active-recall` (aunque sea rollup) | — | no |
| `primer-guardado` | 📁 Tu primer guardado | ≥ 1 ítem en Mi espacio (papelera incluida) | — | no |
| `ruta-creada` | ✏️ Tu primera ruta | ≥ 1 ruta del catálogo con su `createdBy` | — | no |
| `primer-amigo` | 🤝 Primer amigo | ≥ 1 amigo en su grafo | Amigos | no |
| `tres-dias` | 🗓️ Tres días seguidos | `bestStreak ≥ 3` (máximo histórico) | — | no |
| `de-vuelta` | 🌱 De vuelta | `comebacks ≥ 1` | — | no |
| `semana-completa` | ✨ Semana completa | `fullWeeks ≥ 1` | — | ×N |
| `mejor-semana` | 📈 Superaste tu semana | `pbWeeks ≥ 1` | — | ×N |
| `semana-familia` | 🏆 Copa de la familia | `crowns ≥ 1` (copas de la familia) | Ligas | ×N |

**Contratos (aditivos).** `GET /api/medals` → `MedalsResponse {medals, unseen}` del ACTIVO: solo las ganadas (el catálogo
no viaja: sin total, sin "faltan"), las más nuevas primero y las sin fecha al final en el orden del catálogo, sin las de un
dominio apagado para ese chico; `fresh` en las que no vio · `POST /api/medals/seen` → idem con `unseen 0` (marca vistas las
que VE: una escondida por un candado sigue "Nueva" hasta que se prenda) · ambos 405 con el otro método · sin sección (el
Ciclo del día no los cierra) · `familyCloseIfDue` corre antes (U5-A). `ParentActivity.medals` = TODAS las del integrante,
sin `fresh`, con `hidden: 'ligas' | 'amigos'`. `FeedItem` += `{kind: 'medal'}` (en `src/api/types.ts`).

**Pila de arranque con los datos de HOY (29-oct).** Ian **6** (🗺️ 📁 🎯 💯 🤝 🗓️ —desde la revisión de U5 la 🗺️ trae la fecha de la
fila del 28-oct que completó la ruta y va primera—: la spec decía 5; la 🗺️ "Ruta completa"
sale de las 3 filas que alguien jugó el 28-oct a la noche en `ruta.kzd4pr9brpdj`, que con la del 23-oct completan sus 2
postas: es derivada, cambia con los datos) · Luna **4** (🤝 🗓️ ✨ 🏆) · Andrés **0** (sin chip). Primer cierre simulado de la
familia: "Superaste tu semana" NUEVA para Ian y para Andrés (su primera), Luna suma su 2.ª copa (×2, sin noticia).

**Desvíos y decisiones de implementación (todas internas del server).** (1) El registro de `progress.ts` lee el store SIN
cortar la semana (no usa `medalCountersOf`, que corta): si leer los hechos cortara un lunes pendiente, `ensureMedals`
sembraría ese corte como "visto" y el "Superaste tu semana" del lunes no llegaría como nuevo (test en
`medalsLeague.test.ts`). (2) `MedalFacts` suma las FECHAS de los hechos que la tienen (`tenthTargetAt`, `perfectAt`,
`recallAt`, `firstRouteCreatedAt` y, desde la revisión de U5, `firstRouteCompletedAt`), para que la pila diga "Desde el…" también
tras un F5. (3) `registerMedalFacts(fn,
name?)`: el nombre es opcional, solo para el aviso si una parte tira (una parte que tira vale cero y no tumba el pedido). (4)
`syncMedals` emite la noticia bajo el `runAsUser` del dueño aunque el llamador se olvide (defensa en profundidad). (5)
Familia → Actividad SINCRONIZA antes de leer (bajo el `runAsUser` del integrante: su noticia cae en SU feed). (6) El brief
de la tanda sugería "el primer canje" como ejemplo de medalla en vivo: NO existe en la spec (regla 2 de §5.1: ninguna
medalla se consigue gastando ⚡); la prueba en vivo es "Superaste tu semana".

**Bordes (U5-B).** Lo de RAM (racha, semanas, copa, amigos) vuelve al seed con el F5 de ese usuario; la copa se RE-DERIVA de
las copas de la familia (el F5 de uno no las toca), pero SIN fecha: el hecho no la trae, así que una copa ganada en vivo pierde
su «Desde el…» tras el F5 del ganador (se re-siembra con `at` null). Purgar el único guardado / borrar la única ruta propia:
la medalla queda en la sesión y se va con el F5 (su hecho ya no existe). La primera posta es UNA por entorno (la fila
persiste). Un usuario cuyo slice de medallas no existía y cuyo progreso ya cortó un lunes antes de nacer (server prendido a través de un lunes,
sin que nadie de la familia lo tocara): ese "Superaste tu semana" entra al seed como visto (la medalla está; solo no dice
"Nueva" ni trae noticia). Entre U5-B y U5-D la píldora del Feed puede contar una noticia `medal` que el cliente todavía no
pinta (R9 de la spec).

**Verificado (U5-B, 29-oct; solo `curl`/urllib contra localhost, sin cookies ni credenciales).** `npx tsc -b --force` y `npx
tsc -p tsconfig.server.json --noEmit` limpios · `npm run build` verde · `npm test`: 41 archivos / 464 tests (antes 36 / 380;
U5-B suma `medalRules.test.ts`, `medals.test.ts`, `medalsLeague.test.ts` y `medalsFeed.test.ts`: 55 casos; el resto de la
diferencia es de las tandas del cliente en paralelo). Humo en un server ESPEJO propio (puerto 8797, con una COPIA de
`server/data`: Learn, Mi espacio, import de ruta y candados escriben ahí) — 62 chequeos OK: pila del seed y reset
determinístico; cierre de la familia → medallas, Actividad, noticia en el feed de cada dueño y de nadie más; re-sync sin
duplicar; seen; F5 de Ian y de Luna; Ligas apagadas (Luna) y Amigos apagado (Ian): escondidas en la pila y en el feed,
`hidden` en Actividad, vuelven al prender; primera posta perfecta de Luna; primer guardado de Andrés; «Tu primera ruta» de
Ian con un bundle de fixture (Luna lo re-importa y el autor sigue siendo Ian; borrado y F5 → se va); Ian le gana la semana a
Luna → copa nueva. En el dev del usuario (8787) solo lo de RAM — 27 chequeos OK — y `{scope:'all'}` al final. `server/data`
real idéntico byte a byte al respaldo. **NO verificado en vivo**: el cierre real de un lunes (cubierto por
`medalsLeague.test.ts` con reloj falso; el camino con el reset de quien abre la app, por `familyMonday.test.ts` desde la revisión
de U5) y "Primer amigo" ganado en vivo (ningún chico del seed arranca sin amigos: el camino
de aceptar se ejercitó sin medalla nueva y la regla está en unidad).

**Para U5-D (cliente de medallas).** `api.medals()` / `api.medalsSeen()` ya están (los sumó U5-C). El chip sale de
`GET /api/medals` (`medals.length`, puntito si `unseen > 0`; sin medallas no hay chip); la hoja ordena tal cual llega; "×N"
viene en `times` (solo ≥ 2); "Desde el…" con `at` (null = sin fecha). La tarjeta del Feed es `case 'medal'` en
`FeedPage.block` (el tipo ya está en `types.ts`); Actividad pinta `dash.medals` con la nota de las `hidden`.

<!-- U5-C: la liga de la familia (cliente). -->
### 12.C La liga de la familia — cliente (U5-C, 29-oct)

**Hecho.** `src/api/index.ts` suma los 6 envoltorios que faltaban (`familyPrizeOptions`, `setFamilyPrize`, `clearFamilyPrize`,
`closeFamilyWeek`, `medals`, `medalsSeen`; aditivos). Lo puro vive en `src/sections/leagues/lib/familyWeek.ts` (textos y
borrador de la hoja, con `__tests__/familyWeek.test.ts`).
- **Ligas → Familia** (todos): arriba de la tabla, "La semana pasada" (`FamilyWeekCard`: copa, marcas ↑/✨ de cada uno,
  "Entre todos sumaron N XP", el premio "→ para Ian (se lo da Andrés)" o, sin ganadores, según `prizeInPlay`: "sigue en
  juego" SOLO en la última semana cerrada y si ese premio sigue vigente; si no —y en las anteriores—, "pasó a la semana
  siguiente"; y un `<details>` "Semanas anteriores") y el premio en juego (`FamilyPrizeCard`). La fila (`FamilyRanking`, §4.5
  de la spec): puesto · avatar · nombre + 🏆 chiquita (`wonLastWeek`) + Vos y, debajo, siete puntitos `DaysDots` "N de 7
  días" (D2, sin letras de día) y "↑ superó su semana" SOLO cuando `prevXp != null && xp > prevXp` (con premio "supera su semana", el ↑ de un CHICO lleva el emoji del
  premio). La racha de U4 ya no se pinta en la fila. Título "Esta semana: ¿quién aprende más días?" y el pie de §4.2.
- **Premio** (D1, D4): el chico lo ve ("Si superás tu semana anterior: … · Te lo da Andrés"); sin premio, no hay tarjeta.
  El adulto (`canManage`): "Poné un premio para esta semana" → hoja `FamilyPrizeSheet` (`.shov/.shcard`; "De los premios de
  tus chicos" agrupado por Tienda —lista con scroll propio— o "Uno nuevo"; condición con radios nativos y "para todos los que
  superen su semana" PRESELECCIONADA; la validación del cliente es solo de forma y el 400 se muestra TAL CUAL con
  `ApiError.reason`; Esc, Tab atrapado y foco de vuelta con `store/lib/sheet.useSheetKeys`). Con premio: Cambiar (reabre con
  lo vigente; sin elegir otra cosa va el texto PROMETIDO, también si vino de la Tienda —si su ítem ya no está o cambió, la hoja
  pasa a "Uno nuevo" con ese texto—: el único POST con `from` es elegir un ítem de la Tienda que no sea el ya prometido) y Quitar
  (confirmación chica). Si el de la semana pasada se consumió: "Repetir el de la semana pasada" (re-envía `history[0].prize`
  como texto literal —emoji, título y descripción—, SIN `from`: con `from` el server re-copiaba el ítem de HOY, con otro texto
  si se editó o 400 si se archivó). Si quedó sin ganadores y sigue vigente (`prizeInPlay`): etiqueta "Sigue en juego".
- **Cierre de la familia** (D4): en la solapa Familia, solo para el adulto con ≥ 2 filas, el chip del pie es "Simular cierre de
  la semana de la familia" (`SimulateCloseChip` con props opcionales; en las otras solapas y para un chico, el de siempre).
  Aviso `FamilyCloseBanner` (prefijo `lgx-`: copa con festejo de una vez, marcas, total, premio, "Tu liga también cerró:
  saliste 7º de 12 en la Liga Chispa…" con el `closeCopy` de siempre; foco al título) + `LEAGUE_WEEK_CLOSED` con
  `detail = mine` (lo que ya escucha la medallita del avatar; sirve igual para el chip de medallas de U5-D).
- **Tienda** del chico: `FamilyPrizeBanner` (`stfp-`) ARRIBA de la grilla de premios (sin precio, sin Canjear, sin corazón;
  "No se canjea: se gana en la liga de la familia →" a `/ligas?tab=familia`). Es una lectura aparte (no tumba la Tienda) pero
  se re-pide en CADA `load()` de la Tienda —la primera carga, «Reintentar» y las recargas tras un canje, una compra o un regalo—
  y cuando cambia el candado; SOLO con Ligas prendidas para el chico (con Ligas apagadas ni se pide: no hay 403 en la consola y
  la tarjeta no existe). Si una lectura falla queda lo último que se supo. **Tus canjes**:
  un canje `origin: 'liga-familia'` muestra "🏆 Lo ganaste en la liga de la familia" en lugar del precio ⚡.
- CSS nuevo grepeado libre: `lgw-` (semana pasada), `lgp-` (premio y hoja), `lgd-` (puntitos), `lgx-` (aviso) en
  `leagues.css`; `stfp-` en `store.css`.

**Textos que se apartan un pelo de la spec (a conciencia).** "(se lo da Andrés)" en vez de "(se la da…)": el título del premio
es libre y "lo" (= el premio) sirve para todos, como el "Te lo da" de §3.3; con quien mira: "para vos" / "se lo das vos". "Nadie
sumó esa semana." en la tarjeta del historial ("esta semana" queda para el aviso del cierre recién hecho). La tarjeta de la
Tienda suma la condición y quién lo da ("Si superás tu semana anterior · Te lo da Andrés") para que el chico sepa cómo se gana.

**NO hecho (fuera del terreno de esta tanda: `src/sections/parent/**` lo tenía prohibido).** En Familia → Premios, la fila del
canje de la liga (`DeliveryRow`) todavía dice "⚡ 0" en lugar de "🏆 De la liga de la familia · cerró el {fecha}" (el "Ya se lo
di" funciona igual: verificado), y falta la línea de solo lectura "Premio de la semana de la familia: … · Se elige en Ligas →
Familia" en `RewardsPanel` (§3.2). Los dos son cambios chicos de cliente para quien tenga `parent/**`.

**Verificado (29-oct, dev del usuario 5173/8787, Chrome headless con perfil descartable, solo localhost: Google Fonts e
i.ytimg bloqueados → capturas con fuente de respaldo).** `tsc` de cliente y server limpios, build verde, `npm test` 37
archivos / 409 tests. E2E de 92 chequeos sin fallas (dos corridas finales): Ian sin controles de adulto; hoja con D1; los
tres 400 (título 1 letra, emoji, descripción 141) con el texto literal del server y el foco en el motivo; premio de la Tienda
de Luna; Ian y Luna lo ven en Ligas y en su Tienda; cierre de la familia (copa Luna 1.290, ↑ Ian y Andrés, 2.980 XP, premio
a Ian, ⚡ y movimientos de los tres iguales); canje en Tus canjes de Ian → "Ya se lo di" en Familia → Entregado; Repetir,
Quitar; 403 de un chico por API; Ligas apagadas para Luna (sin tarjeta en su Tienda y sin pedido a `/api/leagues/family`; la
solapa sigue para Ian y Andrés con 2 filas); 375 px sin scroll horizontal; consola sin errores no esperados.
**Ojo para el QA (U5-E):** mientras corrían otras tandas, algún OTRO cliente cargaba la app (o reseteaba por API) como Ian o
como Andrés: sus slices volvían al seed en medio de la prueba (una vez se perdió el canje de Ian; otra, Andrés volvió a 450
XP sin ningún pedido de la página de este E2E —medido—). Es el "dos QA contra el mismo server se pisan" de §8.0 de la spec:
correr el E2E de U5 con el server solo para el QA.

<!-- U5-D: medallas de la plataforma (cliente). -->
### 12.D Las medallas de la plataforma — cliente (U5-D, 29-oct)

**Hecho.** Las medallas de U5-B en pantalla, con las cinco reglas de la spec §5.1 (solo las ganadas: sin total, sin "faltan",
sin siluetas; nada se pierde; texto informativo; cada uno ve las suyas). Lo puro vive en `src/shared/lib/medals.ts` (textos
del chip, "Desde el…", "×N", la nota de los candados, el evento; con `__tests__/medals.test.ts`).

> **HISTÓRICO (SHELL-2, 30-oct).** El chip «🏅 N» y la medallita de liga sobre el avatar se SACARON de la tarjeta del
> perfil, que quedó en avatar (→ Configuración) · nombre · 🎧 · puesto de liga. La hoja «Tus medallas» sigue montada en la
> tarjeta y hoy la abre SOLO «Ver tus medallas» de la noticia de una medalla en el Feed (`openMedalsSheet`); ya no hay
> lectura periódica de `/api/medals`: se pide al abrirla. Lo de abajo sobre el chip es el registro de U5-D. Ver §13.

- **Tarjeta del perfil** (`src/shared/components/ProfileCard.tsx`): de UN botón a un `div.profile` con dos botones hermanos:
  el de siempre (avatar + nombre + edad → "Tu avatar", con la medallita de liga y la lapicera) y el chip **`mdl-chip` "🏅 N"**
  con un puntito si hay alguna sin ver (`aria-label="Tus medallas: 7, 1 nueva"`). Sin medallas el chip NO existe (Andrés al
  arrancar). `useMedals` lee `GET /api/medals` al montar, en cada cambio de pantalla, al volver el foco, cuando cambian los
  candados de Ligas/Amigos, tras `LEAGUE_WEEK_CLOSED` (el cierre de la familia también lo dispara) y con
  `innerith:medals-changed`; una respuesta vieja no pisa una más nueva. `openMedalsSheet()` (patrón `openAvatarPicker`) abre
  la pila desde otra pantalla.
- **La pila "Tus medallas"** (`MedalsSheet.tsx`, pura; `medals.css` con prefijo `mdl-`, importado en `main.tsx` después de
  `avatar.css`): chasis `.shov/.shcard` y el teclado de `store/lib/sheet.useSheetKeys` (importado, sin tocarlo): Esc, fondo y ✕
  cierran, Tab queda adentro y el foco vuelve a QUIEN la abrió (el chip o el botón de la noticia del Feed). Grilla "como un
  diploma": disco dorado con cinta (CSS, sin assets), título, texto, "Desde el 23 de octubre" (solo si el hecho trae fecha),
  "×3" (solo `times ≥ 2`) y la etiqueta "Nueva"; en el orden en que llega del server; encabezado "Tus medallas" + "Las que
  fuiste ganando en Innerith.". Al abrir: `GET /api/medals` (la pila con sus `fresh`: las "Nueva" se ven en ESTA apertura) y
  después `POST /api/medals/seen` (el puntito del chip se va con la hoja abierta; en la próxima apertura, sin "Nueva").
- **Feed** (`src/sections/home/`): `cards/FeedMedalCard.tsx` (pura, estilo C de noticia con `MyAvatar` y el emoji en un disco
  dorado: "Tu medalla · recién", "Ganaste la medalla «Superaste tu semana»", el texto de la medalla, "Ver tus medallas" y el
  "por qué"; SIN reacciones, SIN "ver menos" y SIN el anillo de recién entrada) y su `case 'medal'` en `FeedPage.block`: queda
  saldado el R9 de U5-B (la píldora ya no cuenta una noticia que no se pinta). `FeedPage` dispara `innerith:medals-changed`
  cuando la primera página o la píldora traen una noticia de medalla; `lib/visibility.ts` suma la red de seguridad del server
  (`liveAllowed`): la copa solo con Ligas, el primer amigo solo con Amigos.
- **Familia → Actividad** (`components/ActivityPanel.tsx`): bloque "Medallas de {integrante}" con la cantidad, de `dash.medals`
  (todas, sin "Nueva"): emoji, título, "×N" y "Desde el…"; las que el integrante no ve llevan "(Ligas apagadas: Luna no la
  ve)" / "(Amigos apagado: Ian no la ve)". Sin medallas: "Todavía no ganó medallas.". Va entre "Está practicando" y "Lo que
  guardó en Mi espacio".
- **Remates de U5-C en Familia → Premios** (C tenía `parent/**` prohibido): `cards/DeliveryRow.tsx` con `origin:
  'liga-familia'` dice "🏆 De la liga de la familia · cerró el 29 oct" (de `closedAt`) en lugar de "⚡ 0"; el "Ya se lo di" no
  se tocó. `containers/RewardsPanel.tsx`, arriba: "Premio de la semana de la familia: 🚲 1 hora de bici · para todos los que
  superen su semana · Se elige en Ligas → Familia" (link a `/ligas?tab=familia`; lee `api.familyLeague()`; si falla, no hay
  línea).
- CSS nuevo, grepeado libre: `mdl-` (`medals.css`), `pz-md-` y `pz-fprize` (al final de `parent.css`), `.hf-medal` (`home.css`).

**Desvíos (a conciencia).**
1. Clases de la tarjeta: el div lleva `profile mdl-prof` y el botón del avatar CONSERVA `idav-prof` (+ `mdl-me`), en vez del
   `<div className="profile idav-prof">` literal de la spec: así las reglas de `avatar.css` (tamaño por densidad, la lapicera
   que se pinta en hover) siguen en el botón y pasar el puntero por el chip no las dispara. El hover y el anillo de foco de la
   tarjeta ENTERA salen de `:has(...)`, y un `::after` estira el botón a toda la tarjeta (se toca en cualquier lado, como
   cuando era un botón). Lo que `shell.css` le daba a `.profile > div` (el `min-width:0` del nombre y el sr-only del rail de
   tablet) ya no le llega al nombre, que ahora vive adentro del botón: lo replica `medals.css`. `shell.css` no se tocó.
2. En el rail de tablet (80 px) el chip va DEBAJO del avatar: en 56 px no entran juntos.
3. `useMedals` relee en CADA cambio de pantalla (la spec: al entrar y salir de Ligas): una medalla ganada en Mi espacio,
   Aprender o Buscar llega al chip sin F5 apenas se navega. Y el Feed dispara el evento también en su primera carga, no solo
   por la píldora.
4. Al abrir la hoja: GET y DESPUÉS el seen (el POST devuelve la pila sin `fresh`; sin el GET, una hoja abierta desde el Feed
   antes de que el chip se enterara perdería sus "Nueva").
5. La línea de Premios usa el texto literal de la spec ("para todos los que superen su semana" / "para el que gane la
   semana") y, sin premio, dice "ninguno por ahora · Se elige en Ligas → Familia" (la spec no decía qué mostrar; si la familia
   no tiene liga —menos de dos jugando— no hay línea). El bloque de Actividad muestra también el "×N".
6. Terreno: el brief nombraba `src/sections/feed/**`, que no existe: el Feed es `src/sections/home/` y ahí se tocó solo
   `FeedPage`, la tarjeta nueva, `lib/visibility.ts` y dos reglas de `home.css` (que el agente del shell editaba en paralelo:
   sus cambios y estos conviven).

**Bordes.** El F5 de verdad (sin el switch) re-siembra la pila de ese usuario: "Superaste tu semana" se va con su progreso y
"Tu primer guardado" queda porque su hecho persiste (spec §5.4; medido en el espejo: tras guardar, Andrés arranca con 📁 en
cada reset). El "visto" vive con la pila: tras recargar con el switch, una "Nueva" que ya se vio no vuelve.

**Verificado (29-oct; sin cookies ni credenciales: playwright-core + Chrome headless con perfil descartable propio en el
scratchpad —borrado—, SOLO localhost: todo lo externo abortado).** `npx tsc -b --force` y `npx tsc -p tsconfig.server.json
--noEmit` limpios · `npm run build` verde · `npm test`: 42 archivos / 474 tests (antes 41 / 464: + `medals.test.ts`, 10
casos). E2E en un ESPEJO propio (API 8798 con una COPIA de `server/data`, sin `.env` + vite 5189 sirviendo el `src/` real;
ya apagados y borrados): **71/71** — Ian: chip "🏅 6", hoja en el orden del server sin total ni "faltan", foco/Tab/Esc/fondo;
una medalla nacida en el server sin que el cliente lo sepa → "Simular NPCs" → píldora → el chip pasa a 7 con puntito SIN F5
(`innerith:medals-changed`); "Ver tus medallas" → "Nueva" primero → el puntito se va → reabrir sin "Nueva" → recarga con el
switch, sin puntito; Andrés sin chip → la línea del premio en Premios → su link → "Simular cierre de la semana de la familia"
→ "🏅 1" con puntito SIN recargar (`LEAGUE_WEEK_CLOSED`) → su noticia → la hoja → el foco de vuelta; noticias de medalla
solo en el feed de su dueño (Ian y Andrés sí, Luna no); `DeliveryRow` "🏆 De la liga de la familia · cerró el 29 oct" sin ⚡
→ "Ya se lo di" → Entregado; la línea pasa a "ninguno por ahora"; Actividad de Luna (copa ×N) y de Ian (su medalla nueva, con
fecha); **primer guardado de Andrés en Mi espacio** (video → Guardar → carpeta nueva) → "🏅 1" con puntito al volver al
Feed, sin F5, y su noticia; **candados** (Ligas de Luna, Amigos de Ian) → la nota en Actividad y la medalla fuera de la pila
del chico; 375 px sin scroll horizontal y la hoja entera; el chip en el cajón; rail 768; densidades 1366×900, 1280×720 y
1366×640 (chip adentro, nombre entero). Contra el dev del usuario (5173/8787), solo lo de RAM: 49/52, 34/37 y 13/13 en tres
corridas; TODA falla coincidió con un reset AJENO de Ian o de Andrés (después de un cierre su XP de la semana volvía a la del
seed —1.240 / 450— mientras la de Luna seguía en 0, y este E2E no los reseteaba en ese tramo: medido con
`/api/progress/summary`), y cada chequeo que falló en vivo pasó en otra corrida en vivo o en el espejo. Sondas aparte
(medidas, no a ojo): hover y anillo de la tarjeta partida; el chip tocable en el rail; la hoja ARRIBA de todo en escritorio y
a 375 (píxeles: la barra inferior, el dock y el cajón quedan oscurecidos por su velo; `elementFromPoint` da el velo): vivía en
la barra lateral como "Tu avatar", así que el "la barra inferior tapa el pie de las hojas" del shell no la alcanzaba (después,
SHELL-FIX montó las dos hojas del perfil en `.app` con un portal: `docs/RESPONSIVE.md` §2.6). Consola:
0 errores de la app (solo recursos externos abortados por el test y un `/favicon.ico` del arranque del script). Estado final:
resets por usuario y `{scope:'all'}` al final (Ian 6 · Luna 4 · Andrés 0, todo visto; la familia en su semana sembrada);
`server/data` idéntico byte a byte al respaldo salvo `mytube.json`, que cambió a las 00:55 por OTRO usuario del server (MyTube;
antes de las corridas en vivo, y con el mismo checksum antes y después de ellas: este trabajo no lo toca).

**NO verificado.** Safari y Firefox (solo Chrome). Un lector de pantalla real (solo los `aria-*` y el foco). En vivo, las
medallas de Learn (escribirían `learn-results.json`) y "Primer amigo" (ningún chico del seed arranca sin amigos); el cierre
real de un lunes.

**Para U5-E.** Correr el E2E con el server solo para el QA (las corridas en vivo de esta tanda se cortaron por resets ajenos
de Ian y de Andrés).

## 13. Shell nuevo — SHELL-2 (30-oct)

> Pedidos de Esteban del 30-oct, en una ola de tandas (SHELL-2, CONFIG, BUSCARCHAT, FEED-3 y afinados en vivo; commits
> `4c16110` · `4cf23fe` · `cb832e3` · `19b7f1e` · `3fd8555`): menú reordenado, adiós a la barra superior, una página de
> Configuración a la que lleva el avatar, menús contextuales a la derecha con su circulito en el menú, y Buscar y Chat al
> nivel del POC. Ningún contrato del server cambió: todo es cliente.

**El menú** (`NAV` de `src/shared/components/Sidebar.tsx`, la fuente también de la barra inferior del teléfono): Feed ·
Buscar · Chat · **Mis videos** (la sección MyTube: cambió el nombre visible, no la ruta `/mytube` ni el código) · Mi
espacio · Calendario · Aprender · Tienda · After Day · Familia (solo el adulto, abajo de todo). Junto a la palabra
«Tienda», los ⚡ del usuario activo (solo con la Tienda prendida; se refrescan al moverse la moneda, al volver el foco o la
pestaña). El punto Calendario lleva de ícono el almanaque con el día de HOY en la zona de la familia. Ligas sigue sin ser
punto del menú y Configuración tampoco lo es.

**Sin barra superior.** `TopBar.tsx` no existe más. Dónde quedó cada cosa: el reloj y la campana se retiraron (las
solicitudes llegan a la zona Destacado del Feed y a Buscar → Personas; los no leídos, al dock de Mensajes); los ⚡, junto a
«Tienda»; la posición de liga y el 🎧 Sonido de fondo, a la tarjeta de perfil; el switch de usuario, a Configuración.

**La tarjeta de perfil** (pie de la barra lateral, `src/shared/components/ProfileCard.tsx`): EXACTAMENTE avatar · nombre ·
🎧 · puesto de liga. El avatar (con la ropa puesta) navega a `/configuracion`; el nombre va solo, sin la edad; el 🎧 es el
MiniPlayer (su panel se abre encima de la tarjeta); el escudo con «N.º» lleva a `/ligas` (solo con Ligas prendida y si
llegó la liga: se relee al montar, cada 60 s, al cerrar una semana y al volver el foco). Sin medallita de la semana, sin
lapicera y sin chip de medallas. Las dos hojas del perfil siguen montadas acá: «Tu avatar» la abren Configuración y el
«Ponérsela» de la Tienda; «Tus medallas», solo el «Ver tus medallas» de la noticia de una medalla en el Feed.

**Configuración** (`/configuracion`, `src/sections/settings/`): «Configuración» + «Cuenta de {nombre}», en una columna
angosta con secciones de título claro y ayuda en gris (el patrón de los Ajustes del POC).
- **Perfil**: el avatar grande, el nombre (solo lectura) y «N años» o «Adulto»; «Tu avatar» → «Cambiar» abre la MISMA
  hoja de siempre, con la prenda puesta preseleccionada (sin la Tienda prendida, la ayuda no la nombra).
- **Sonido**: «Música de fondo» y «Ruidos para concentrarte» (blanco, marrón, rosa: prender, apagar y volumen), sobre los
  MISMOS stores del MiniPlayer y con los MISMOS topes de Familia → Límites («máx. N»; se releen al entrar). Al chico le dice
  que el máximo lo pone su familia; al adulto, con el link a Familia → Límites.
- **Ciclo (demo)**: el selector que antes vivía abajo del menú (§11). Con un chico, SU ciclo, solo si tiene rangos. Con el
  adulto, el del integrante del `?m=` de la URL o, sin él, el PRIMERO («Ciclo de Ian (demo)»), solo si ese integrante tiene
  rangos; como el avatar lleva a `/configuracion` sin `?m=`, sin tocar la URL es el primer integrante.
- **Cambiar de usuario** (demo): §2.

**Circulitos de destacados** (`src/shared/lib/navHighlights.ts`): el punto de una sección con menú contextual lleva un
círculo con cuántos ítems destacados esperan ahí (con 0 no hay; más de 9, «9+»). El Sidebar los SIEMBRA al montar y al
volver el foco o la pestaña, y la sección los PISA con su cuenta real (hoy, el Feed).

**Menús contextuales** (en escritorio, ≥ 1024 de contenedor: columna derecha de 380, sticky, a la par del título; por
debajo, apilados arriba del contenido; sin nada destacado no hay columna):
- **Feed**: la zona Destacado (📌) = el hero «tu siguiente paso» + las solicitudes de amistad. El «por qué» de cada card
  va siempre abajo a la derecha.
- **Tienda**: la billetera (saldo y accesos a deseos, canjes y movimientos) + el premio de la semana de la familia. La
  Tienda ya no tiene las categorías «Premios» / «Ropa»: las grillas solas.
- **Calendario**: la próxima clase. El título lleva el almanaque; sin lede ni «Tenés N clases por delante».
- **Aprender**: PRIMERO la tarjeta de Active recall y después la liga COMPLETA (el resumen y la tabla entera con tu fila
  resaltada, → `/ligas`).

**Cabeceras**: Tienda, Calendario, Aprender, Mi espacio y Mis videos van con ícono + título, sin subtítulo; Ligas arranca
directo en la cabecera de su liga (sin título, lede ni «Asignada por tus resultados») con las solapas Mi liga · Familia ·
Tu zona · País. Los subtítulos (`.lede`) que quedan, con menos aire y un gris más claro. Mi espacio quedó tipo Google
Drive (grilla de columnas iguales, vista previa en los archivos, migas SIEMPRE —también en la raíz—, la Papelera con
sombra). La solapa de Familia de la sección es «Mis videos» (`/familia/mytube`).

**Buscar y Chat** (tanda BUSCARCHAT): la home de Buscar, centrada y SIN solapas; con búsqueda, Todo (de entrada) ·
Videos · Imágenes · Artículos (ex «Páginas», `?tab=pages` por compat) · Personas / Mentores. El Chat con varias
conversaciones guardadas en el navegador e historial a la derecha (README, `/chat`). El reproductor ya no tiene
Me gusta / No me gusta.

**Usuario por usuario.**

| | Chico (Ian, Luna) | Adulto (Andrés) |
|---|---|---|
| Menú | Sin Familia; los apagados y el Ciclo del día de ESE chico sacan puntos | Con Familia al fondo; nada lo saca |
| ⚡ junto a «Tienda» | Con SU Tienda prendida | Siempre (los candados son del chico) |
| Tarjeta de perfil | El puesto de SU liga, con Ligas prendida | El puesto de su liga de grandes (Liga Chispa) |
| Circulito del Feed | Hero + solicitudes (con Amigos) | Solo el hero: lo social es de los chicos (§10) |
| Circulito del Calendario | 1 si `GET /api/calendar` le trae alguna clase | Igual, con sus clases |
| Circulito de la Tienda | 1 si hay premio de la familia que puede ganar (con Ligas) | Nunca: el premio lo cobran solo los chicos |
| Circulito de Aprender | 1 con su liga (con Ligas) | Nunca: la liga del contextual es del chico |
| Contextual de la Tienda | Billetera + premio de la familia | Billetera (su Tienda es solo la ropa) |
| Contextual de Aprender | Active recall + su liga completa | Active recall (si tiene qué repasar) |
| Home de Buscar | «Buscar a otros chicos de Innerith» (con Amigos) | «Ver los mentores» |
| Configuración → Sonido | «El volumen máximo lo pone tu familia…» | Link a Familia → Límites (sin topes) |
| Configuración → Ciclo (demo) | Su ciclo, si tiene rangos | El del primer integrante (o el del `?m=`), si tiene rangos |

**Teléfono** (< 640 de contenedor): la barra inferior lleva 4 puntos + «Menú» —al chico, Feed · Buscar · Mis videos ·
Aprender; al adulto, Feed · Buscar · Aprender · Familia; si un candado saca uno, entra el siguiente del menú— y SIN
circulitos ni ⚡; «Menú» abre la barra lateral entera como cajón, con los circulitos, los ⚡ y la tarjeta de perfil.

**NO verificado en este pase de docs** (solo se leyó el código): el comportamiento en pantalla de cada ancho, Safari y
Firefox, y lo que esté cambiando la tanda en vuelo del 30-oct sobre las tarjetas de video de Mis videos y Mi espacio y
sobre la marca de la app.
