# Briefing para agentes que implementan en Innerith

Leé esto ENTERO antes de tocar código. Después: `README.md` (arquitectura y swap-points) y
`docs/VISION.md` (qué es el producto y qué existe dónde). No arranques sin leer los tres.

## Qué es esto
Plataforma educativa **para grandes y chicos** (homeschooling conservador de EE.UU.; UI en español
rioplatense, voseo; para los chicos, tono amable de ~9 años). UI React 19 + TS + Vite en `src/`,
backend Node sin framework en `server/` (puerto 8787, proxy `/api` de Vite).
**Usuarios demo (línea 14-oct, `docs/USUARIOS.md` — LEELO si tu tanda toca usuarios, Familia,
mentores o candados):** Ian (9, chico), Luna (12, chica; U3) y Andrés (adulto, el guardián de los dos;
la config de cada chico es POR INTEGRANTE y Familia la elige con `?member=<id>`: USUARIOS.md §9). **Cada uno tiene lo suyo
(U4, USUARIOS.md §10)**: XP/⚡/racha, canjes y guardarropas, wishlist, Learn, Mi espacio, liga, amigos y feed en vivo son POR
USUARIO; de la familia quedan el catálogo aprobado, After Day, la config del padre y las mentorías. El usuario ACTIVO viaja en
la cabecera `X-Innerith-User` (la pone `src/api/index.ts` desde `localStorage['innerith.user']`, leído UNA vez por carga
de página: cada pestaña conserva su usuario hasta recargar; server: `actingUser()` de `server/src/users.ts`); se cambia con el chip de la barra superior
(switch de demo: recarga la app SIN resetear la demo; el F5 resetea solo al activo — U4-C). **Los candados son del chico**: apagados de funcionalidades y
el CICLO DEL DÍA (rangos horarios con las secciones de cada uno; reemplazó a los horarios por sección: USUARIOS.md §11) NO rigen
para un adulto (server y cliente; `useFeatures()` ya devuelve todo prendido para él). La sesión de Familia es la del adulto activo (implícita; el PIN del server
quedó dormido y NUNCA se imprime).

## Reglas de arquitectura (NO negociables)
1. **La UI es un esqueleto**: los containers llaman a `api` (`src/api/index.ts`); los componentes
   son puros por props. Nada de fetch ni estado de dominio en componentes.
2. **Todo lo que falta de backend se fakea EN EL SERVER** (patrón `server/src/feedFake.ts`),
   manteniendo EXACTA la forma de respuesta futura (contratos en `src/api/types.ts`). Marcar FAKE.
3. Moderación fail-closed siempre: nada se muestra si no está aprobado (catálogo, lista blanca,
   palabras bloqueadas). Un video/lectura solo se referencia por id/URL aprobado y se re-resuelve
   al leer. No crear superficies nuevas de moderación sin pedirlo.
4. Estructura por secciones: `src/sections/<sección>/{containers,cards,components,lib}` +
   `<sección>.css` importado en `src/main.tsx`. Código y carpetas en inglés; textos de UI en
   castellano rioplatense.
5. **CSS**: clases con prefijo propio de la sección. Antes de inventar una clase, grepearla en
   `src/**/*.css` — ya hubo choques reales (`.act`, `.scard`, `.vthumb`, `.fgo`). Ojo con el
   *grid blowout*: `#v-space` usa `grid-template-columns:minmax(0,1fr)` por eso.
   Ojo en COMENTARIOS de CSS: un `*/` adentro del texto (p.ej. escribir `src/**/*.css`) CIERRA el
   comentario y el navegador descarta EN SILENCIO la regla que sigue (pasó de verdad con tokens de color).
   **Layout de página**: el ancho y la alineación los da `.view` (tokens `--content-w`/`--view-px`
   en base.css) — NINGUNA sección pone su propio max-width/margin:auto de página. Excepciones más
   angostas SIEMPRE centradas en el mismo eje (video 760, lector 900, feed 780; los overlays de Learn van a pantalla
   completa en un portal sobre `<body>`). Una vista con
   `padding:0` alinea sus barras con `var(--view-pad-x)`. Listas de filas en grid: `minmax(0,1fr)`.
6. Drive: en la RAÍZ viven solo carpetas (lógica Windows/nube); los archivos siempre adentro de
   una carpeta; "General" es el destino por defecto. Carpetas todas con el MISMO ícono
   (`IcFolderWin`). Papelera restaurable: nada se borra de verdad sin "borrar definitivo".
7. Ligas: se ASIGNAN por resultados (nunca se eligen/buscan), 12 participantes, y el puntaje
   semanal es UNO solo (mismo número en liga, zona y país). El ciclo semanal (closesInDays real +
   lastWeek/medalla) tiene UNA sola fuente: server/src/leaguesFake.ts — no lo dupliques.
8. Menú actual (EN ESTE ORDEN, 14-oct-2026, SIN submenús): Feed (= el feed de
   recomendaciones, la home en `/`; antes se llamó Home y Descubrir) · Buscar (`/buscar/*`) ·
   Chat (`/chat`) · MyTube (`/mytube`; las rutas viejas `/espacio/videos*` redirigen acá) · Aprender (`/aprender` = Learn desde W3+W4: aprender + practicar + Active Recall
   colapsados; la ruta abierta es estado de la vista y `?ruta=<id>` la abre directo; su encabezado lleva el botón "Crear" → `/crear`, que marca Aprender
   como sección activa) · After Day (`/afterday`) · Tienda (`/tienda`) · Calendario (`/calendario`; muestra las clases del USUARIO ACTIVO) · Mi espacio (`/espacio/carpetas` directo)
   · **Familia (`/familia/*`) AL FONDO, SOLO PARA EL ADULTO** (línea 14-oct: la ex Zona de padres,
   sin portón de PIN; con un chico activo la ruta navega al Feed y el link discreto del Sidebar ya
   no existe; `/padres/*` redirige conservando subruta; la tab "Profesores" es ahora "Mentorías"; F2, 28-oct: la solapa "YouTube" es
   "MyTube" —`/familia/youtube` redirige— y After Day y Ciclo del día tienen solapa propia; orden desde el 29-oct, pedido de Esteban: Funcionalidades · Temas y
   palabras · Protecciones · MyTube · Ciclo del día · After Day · Límites · Avisos · Premios · Mentorías · Actividad).
   LIGAS TAMPOCO ES PUNTO DE MENÚ (12-oct): la posición vive SIEMPRE en la BARRA SUPERIOR estilo
   GT7 (src/shared/components/TopBar.tsx: liga → link a /ligas · ⚡ Energy Coins · fecha/hora
   compacta · CHIP DEL USUARIO ACTIVO con el switch de demo (14-oct) · campana de notificaciones con las solicitudes y los no-leídos del dock; respeta los
   apagados del padre cuando mira un chico). AMIGOS YA NO ES SECCIÓN (12-oct): los amigos siguen existiendo — viven en el dock de Mensajes,
   se BUSCAN por nombre de usuario en Buscar y las solicitudes llegan como notificación destacada
   en la zona PINNEADA de arriba del Feed (tanda F2). BUSCAR tiene la solapa **Mentores SOLO con
   un adulto activo** (U2, 14-oct: catálogo + contratación con plan/beneficiario + post-compra de
   días; la administración vive en Familia → Mentorías). PRACTICAR YA NO EXISTE (W3, 12-oct: los cursos viejos y su
   práctica se borraron): `/practicar*` y `/aprender/:id` redirigen a /aprender, y el hero del Feed ("Seguí con <ruta>")
   lleva a `/aprender?ruta=<id>`; `/repasar*` no existe (redirige a /aprender). "Feed" es el feed, NO el
   chat. Si cambiás rutas, dejá redirecciones de las viejas.
9. **La economía del demo vive en RAM y es POR USUARIO** (pedido de Esteban; U4): XP/Energy Coin/racha/canjes/guardarropas,
   el grafo de amigos, el ciclo de liga y el feed en vivo NO se persisten; cada usuario tiene su slice (`server/src/perUser.ts`)
   y cada CARGA DE PÁGINA hace `POST /api/demo/reset`, que vuelve al seed **solo al usuario activo** (el switch de usuario
   NO resetea: la demo de la familia sigue; `{scope:'all'}` resetea a todos — para QA). Si tu módulo guarda estado
   económico o de demo: hacelo con `perUser(seed)`, exponé `reset(userId?)` y registralo en ese endpoint. SÍ persisten, POR
   USUARIO: `space.json` v2, `wishlist.json` v2, `learn-results.json` v2, `identity.json` v2; y la config de la familia
   (`parent.json` v3 por integrante, `schedules.json` v3 —el Ciclo del día—, `teachers.json` v2, `music.json`, `mytube.json`). Los AVISOS al
   padre PERSISTEN (FS-BASE-A: `alerts.json`, de la familia, 0600, ids que nunca se reusan) y no entran en el reset. La SEMANA DE LA LIGA DE LA FAMILIA (U5-A, `docs/USUARIOS.md` §12: historial,
   premio del adulto, copas) también es RAM de la FAMILIA: el reset por usuario no la toca; solo `{scope:'all'}`
   (`resetFamilyWeeks`) y reiniciar el server. Las MEDALLAS (U5-B, `server/src/medals.ts`) son RAM POR USUARIO sin archivo
   (D3), DERIVADAS de hechos que cada módulo dueño registra (`registerMedalFacts`): si tu módulo mueve un hecho de una
   medalla, llamá `ensureMedals(uid)` ANTES y `syncMedals(uid)` DESPUÉS (la noticia cae en el feed del dueño); entran en el
   reset (`resetMedals`, AL FINAL, después de los demás).
   Detalle de lo persistido (tandas anteriores): `parent.json` v3 —members[id]: on-off de funcionalidades, premios de la
   Tienda, temas blancos/negros, palabras de la familia, topes de volumen, preset aplicado y dial del Feed; tz y PIN de la
   familia; migra solo del v2 con respaldo .pre-v3 (o .pre-v3-<ms> si ya había otro)—; `schedules.json` **v3** (tanda F1, 28-oct; `docs/USUARIOS.md` §11): el CICLO DEL DÍA
   de cada integrante `{version: 3, members: {[id]: {ranges}}}` —rangos horarios `{id, name, from, to, sections}`; reemplazó a los
   horarios por sección (v2), que NO se convierten: el v2 queda en `.pre-v3` (o `.pre-v3-<ms>`: nunca se saltea) y cada integrante arranca sin rangos; las
   reglas puras en `src/shared/lib/cycleRules.ts` —el MISMO código en server y cliente desde F2, como `zonedClock.ts`—; el editor es
   Familia → Ciclo del día y el selector «Ciclo (demo)» vive abajo del menú—; su override de demo ("estás en este rango", `POST /api/demo/cycle`) es RAM por
   usuario y SÍ entra en `/api/demo/reset`;
   `teachers.json` v2: CONTRATOS de mentorías —mentor + beneficiario + plan + días, más `seq` (contador de ids que solo
   crece: un id cancelado no se reusa; tanda B1); migra solo del v1— y las clases NO se guardan: se derivan al leer por
   slot, ancladas en la ZONA HORARIA DE LA FAMILIA (tz null = la del server) y la serie corre sola. U4: `space.json`,
   `learn-results.json` y `wishlist.json` migran solos del v1 (todo a ian) con respaldo en `.pre-v2` (o `.pre-v2-<ms>` si ya
   había otro), y un archivo ilegible —o con una `version` desconocida— queda como `.roto-<ms>` (no se pisa). FS-BASE-B: todo
   lo de server/data se escribe con `server/src/durable.ts` (tmp + fsync + rename, disco ANTES que la RAM). (El switch que no resetea lo hace el cliente —U4-C—: `setActingUser` marca `sessionStorage['innerith.keepDemo']` y
   `consumeKeepDemo()` la consume en `src/hooks/user.tsx`, una vez por carga.)
   **Botones de demo ("Simular…")**: chip discreto con el prefijo CSS de su sección, que SOLO dispara
   un endpoint de demo del server fake (nada de lógica simulada en el cliente) y refetchea; el efecto
   vive en RAM y una recarga vuelve al seed, como todo el demo.
10. **Watcher de Vite/tsx en Windows**: a veces pierde la segunda de dos ediciones seguidas del
   mismo archivo y sirve un módulo viejo. Si el navegador no refleja tu cambio, verificá el módulo
   servido y hacé un `touch` del archivo para forzar la recarga.

## Porte Smarty (tandas W1-W7)
Si tu tanda es del PORTE de la POC de Smarty: lectura OBLIGATORIA de `docs/porte-smarty/00-mapa-porte.md`
(plan + decisiones de Esteban) y del informe de tu subsistema (01/02/03), y del CÓDIGO FUENTE del POC
(`C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc`, rama
develop ya servida — SOLO LECTURA ahí). Regla suprema: **funcionalidad EXACTA, sin recortes ni mejoras
creativas; los quirks documentados se portan tal cual (decisión 12-oct)**. La estética NO se copia: se
usa el sistema visual de Innerith. Desvíos permitidos SOLO los dos forzados del §4 del mapa (claves al
server, IndexedDB→server) y cualquier otro se frena y se reporta. `innerith-ui/route-lab/` es copia
literal del POC: NO se edita salvo pedido explícito.

## Seguridad (crítico)
- Claves de API SOLO en `server/.env`; config real en `server/data/` — ambos gitignored. JAMÁS
  imprimir claves, moverlas al cliente, ni commitear esos paths. Verificá `git status` antes de
  cualquier commit que te pidan.
- El PIN parental no se imprime ni se guarda en ningún lado.
- No tocar `server/data/config.json`, `catalog.json`, `defaults.json` salvo pedido explícito.

## Verificación (obligatoria antes de reportar "listo")
- `npx tsc -b --force` y `npx tsc -p tsconfig.server.json --noEmit` limpios; `npm run build` verde.
- E2E con Edge headless (playwright-core, `channel:'msedge'`): script `.mjs` en el scratchpad de la
  sesión, patrón de los existentes (navegar, `waitForSelector`, screenshots a `shots/`, juntar
  errores de consola y terminar con `console.log('ERR', errs)`). Si el dev del usuario ya corre
  (web 5173, api 8787: `npm run dev` lo levanta él), usalo (tsx watch recarga solo; si 8787 no
  responde, el watch crasheó: mirá el error de compilación). Si NO corre, levantá el tuyo: api en
  8787 (`npx tsx watch --env-file=server/.env server/src/index.ts`) y web en 5188
  (`npx vite --port 5188 --strictPort`) — y MATALOS al terminar la tanda (listá el PID al
  levantarlos; ya quedó un tsx watch huérfano y confundió todo).
- El 5173 es del `npm run dev` DEL USUARIO: no lo ocupes nunca (ni con tu web de QA ni con dev
  servers de otros proyectos como smarty-poc) — ya pasó que un Vite ajeno tomó el 5173 y todos
  vieron otra app. El web de QA de agentes vive en 5188.
- Mirá al menos una captura con tus propios ojos antes de dar por buena la estética.

## Qué actualizar al terminar una feature
- `README.md` (tabla de backend/rutas si cambió) y `docs/VISION.md` (tabla visión↔código).
- NO commitear ni pushear salvo que el pedido lo diga explícitamente. Attribution de commits:
  terminar el mensaje con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Estado demo
`server/data/space.json` (v2, POR USUARIO desde U4) es estado real del demo: el espacio de Ian (`users.ian`: sus carpetas y lo
que tiene guardado, y sus 16 canales seguidos) es el que se muestra. Lo mismo `learn-results.json` v2 y `wishlist.json` v2
(las filas de Learn y los deseos de Ian). Los espacios de Luna y Andrés nacen al usarse (con sus canales de arranque). No lo
borres ni lo llenes de basura de prueba: si creás datos para probar, limpialos al final (papelera → borrar definitivo,
unfollow, etc.); las filas de Learn no tienen API de borrado (si probás con POST, restaurá el archivo con el server parado o
reportalas).
