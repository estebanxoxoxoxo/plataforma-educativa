# Porte Smarty→Innerith · 00: Mapa consolidado y plan de tandas

> 12-oct-2026. Fuente canónica: `smarty-poc` rama **develop** @ `47f434b` (la carpeta adjunta a la sesión).
> Mandato de Esteban: **funcionalidad EXACTA, sin recortes; la estética no se copia**. route-lab ya se
> copió **tal cual** a `innerith-ui/route-lab/` ("copiar pegar y listo; después lo integrás, sin
> reinterpretar"). Detalle por subsistema: informes [01](01-route-lab-crear.md) (route-lab + /crear),
> [02](02-learn-active-recall.md) (Learn + Active Recall), [03](03-mytube-afterday-arquitectura.md)
> (MyTube, After Day, arquitectura). Este doc es el mapa que los une y el plan.

## 1. El mundo nuevo del POC, en una página

- **Crear (`/crear` + route-lab :5203).** La ruta se arma POR MÓDULOS; cada módulo tiene UNA fuente
  (título de Wikipedia o video de YouTube). "Generar" = `POST /module` (síncrono) → posta de
  **comprensión** (lectura/video + preguntas, umbral 70%) + N postas de **profundización** (una por
  concepto) + **inventario de facts** con quote. Curaduría con checkboxes + `POST /emit` (sin
  re-extraer); **auditoría de facts** (OpenAI+Serper, tool-calling) corre en el navegador del POC.
  Guardar = `flatten` → `importRouteBundle` (valida, acuña de prueba con el portero, reemplazo
  transaccional) → Dexie. route-lab es FastAPI 100% síncrono (sin colas/polling); `/routes` es el
  pipeline viejo de Admin; la app nunca llama a `/health`.
- **Learn (una sola sección = Aprender+Practicar colapsado).** Mosaico de rutas por categoría +
  botón raíz "Active recall". Ruta = camino zig-zag de postas agrupadas en módulos (encabezado
  sticky con "ver" = guidebook libre). La primera posta del módulo trae el CONTENIDO adentro del
  overlay (lectura zen o video → "Empezar preguntas") y se aprueba con `passThreshold`; después las
  profundizaciones (sin umbral) y un repaso opcional. **El progreso es 100% derivado** de
  `activityResults` (append-only) por **target**; estrellas por `bestPct`; desbloqueo lineal;
  replays siempre. Motor de actividades local puro (core+registry+porteros+generadores por seed):
  flashcards, multiplechoice, quiz, domino, multi. **Cero LLM en tiempo de juego.**
- **Active Recall.** El mismo motor (multi) en dos lugares: posta de repaso (K=min(5,n), alcance
  módulo/ruta) y raíz sin fin que cicla todas las rutas. Urgencia = `0.6·(1−lastPct) +
  0.4·min(1, Δt/3 días)`. Sin fechas, sin SRS por ítem, sin "estás al día"; re-acuña el mismo set
  barajado.
- **MyTube.** Vista sobre el catálogo aprobado: SOLO canales seguidos + Mis listas; ChannelView con
  handle, descripción curada por IA (editable por el padre) y solapa Playlists del canal (filtradas
  a lo aprobado); ingesta del padre por lote de URLs (YT Data v3) con mantenimiento (reingestar,
  completar, dedup, tope por entrada); reproductor universal con contención total, relacionados,
  cola con avance automático y salto de caídos; audio de fondo global con MiniPlayer y ruidos.
- **After Day.** Sección propia (luna): lista de audio curada por el padre (`musicWhitelist`,
  independiente del catálogo, sin key) que el chico reproduce SOLO como fondo (`audioOnly`), pensada
  para franja horaria propia.
- **Transversales.** Horarios por sección; flags (`learnActivo`, `searchActivo`, `bgAudioEnabled`);
  overlays con pila e integración con Atrás; respaldo cifrado por ámbitos; ~77 overrides editables.

## 2. Reglas del porte (las nuestras, aplicadas a esto)

1. **Exactitud funcional** (mandato): mismas reglas, mismos umbrales, mismos textos de error, mismos
   contratos de datos. Todo desvío se anota en el informe de la tanda y en este doc.
2. **Arquitectura Innerith** (AGENTS 1-2): la UI es cáscara → lo que en el POC vive en Dexie/browser
   pasa a NUESTRO server (RAM o persistido según regla 9) manteniendo formas; route-lab queda como
   servicio hermano COPIADO TAL CUAL (decisión Esteban 12-oct) y el server Node lo proxya/orquesta
   en la integración (sin reinterpretar su código).
3. **Keys server-side**: lo que el POC llama desde el navegador con la key de Ajustes (auditoría de
   facts, descripciones de canal) en Innerith va por nuestro server.
4. **Dónde vive cada dato (regla 9):** rutas importadas + definiciones = CATÁLOGO (persisten);
   resultados (`activityResults`) = sesión del demo (RAM + reset por carga), salvo decisión en
   contrario de Esteban (ver §4.4).
5. El motor de actividades del POC es TS puro y local por diseño (**jamás LLM en juego**): se porta
   al cliente tal cual, con sus tests.

## 3. Plan de tandas propuesto (orden)

| # | Tanda | Qué entrega | Base |
|---|---|---|---|
| W1 | **Crear + integración route-lab** | Sección /crear EXACTA (módulos → Generar → editar/curar → auditar → Guardar); proxy del server Node a route-lab (:5203, URL configurable); auditoría de facts movida al server; importador de bundle → `learn_routes`/`learn_definitions` del server (persistidos) | Informe 01 + route-lab copiado |
| W2 | **Motor de actividades** | Port 1:1 de `learn/activity/*`, registry, porteros, generadores, los 5 tipos con sus Boards y el multi; tests portados | Informe 02 §5-6 |
| W3 | **Learn colapsado** | Mosaico por categoría + RutaView (camino/módulos/guidebook) + ActivityOverlay con fases (lectura con NUESTRO lector real · video → preguntas) + `resolveRoute` exacto + resultados por target al server; reemplazo de Aprender/Practicar en el menú | Informe 02 §2-4, §9 |
| W4 | **Active Recall del POC** | Posta de repaso + raíz sin fin con la urgencia exacta; resolución del encaje con nuestro Repasar (decisión §4.3) | Informe 02 §7 |
| W5 | **MyTube** | Reemplaza "Mi espacio → Videos": followed-only + ChannelView enriquecido (handle, desc curada server-side editable, playlists del canal) + ingesta/mantenimiento del padre server-side + cola con avance automático y relacionados en el reproductor | Informe 03 §1 |
| W6 | **After Day** | Punto de menú nuevo + `musicWhitelist` en Zona de padres + vista del chico `audioOnly` sobre el MiniPlayer existente | Informe 03 §2 |
| W7 | **Transversales** | Horarios por sección en Zona de padres (HORARIOS.md) aplicados server-side; flags que falten | Informe 03 §3.4 |

W2 puede correr en paralelo con W1 (no comparten archivos). W3 depende de W1+W2. W4 de W3.
W5/W6/W7 son independientes entre sí y de la línea Learn.

## 4. Decisiones — RESUELTAS por Esteban (12-oct-2026)

1. **/crear vive en la ZONA DEL CHICO**, como en el POC (punto de menú propio).
2. **Los 5 cursos actuales se convierten a rutas** (bundles seed): un solo modelo mental.
3. **Active Recall se copia EXACTO** ("tiene toda su lógica: toma de todas las rutas y genera un
   repaso con mezcla de todo; examinarlo extremadamente bien"). **El Repasar actual de Innerith
   VUELA** (menú, sección y server propio se retiran cuando aterrice W4). Nota de fidelidad: en el
   código del POC la raíz del AR es sin fin y por urgencia, no hay gating "diario" — se porta lo
   que el código hace.
4. **Progreso (`activityResults`): mismo método que el POC.** El POC lo PERSISTE (IndexedDB del
   navegador; sobrevive a recargas; en el respaldo va como ámbito "sesión"). En Innerith → persiste
   del lado del server (archivo append-only, patrón space.json), FUERA del reset del demo.
   [Informado a Esteban: el método del POC es persistencia local, no RAM.]
5. **Los quirks documentados del POC se portan EXACTO por ahora** (rendirse=lograda, % ponderado
   por racha, recall que destraba comprensiones, etc.). Cada uno queda citado en el informe de su
   tanda como "fiel al POC".
6. **MyTube exacto como está en el POC** (mirando el POC en profundidad): followed-only, sin
   buscador propio, ChannelView con playlists del canal, ingesta y mantenimiento del padre. Lo que
   Innerith tenía de más en Videos (grilla "Para descubrir", buscador, suscriptores) se retira al
   aterrizar W5.

**Desvíos forzados (no negociables de Innerith, documentados):** (a) las claves JAMÁS van al
cliente → la auditoría de facts (que el POC corre en el navegador con la key de Ajustes) se porta
con la MISMA lógica pero ejecutada en nuestro server; (b) los datos que el POC guarda en
IndexedDB se guardan en nuestro server manteniendo formas y semántica de persistencia.

## 4-bis. Decisiones abiertas originales (histórico)

1. **¿Dónde vive /crear?** En el POC está en el menú del chico ("pensado para el adulto", URL sin
   guardia). Propuesta: en la Zona de padres v1, y más adelante habilitable al chico por permiso
   (audio 13: "o el mismo chico, si ya es grande, según los permisos que le da el padre").
2. **Los 5 cursos actuales de Innerith** (Aprender/Practicar hoy): ¿se convierten a formato ruta
   (bundles seed generados una vez con route-lab) o conviven hasta que Learn madure? Propuesta:
   convertirlos (un solo modelo mental, el demo no pierde contenido).
3. **Nuestro Repasar vs el Active Recall del POC.** El informe 02 §13 lo marca: nuestro Repasar
   tiene ledger por fact con niveles y sesión diaria; el AR del POC es por target, sin fechas ni
   "al día". Copiar 1:1 es un retroceso en esa dimensión. Opciones: (a) exacto-POC y Repasar
   desaparece del menú; (b) el menú Repasar pasa a abrir la RAÍZ del AR del POC (exacto en motor y
   urgencia) manteniendo el punto de menú; (c) híbrido (motor POC + nuestra sesión diaria encima).
4. **`activityResults` en el demo:** ¿RAM con reset por carga (regla de la economía; las rutas
   persisten como catálogo) o persistido (el progreso de rutas sobrevive a F5)? Propuesta: RAM.
5. **Bugs documentados del POC** (rendirse=lograda, % ponderado por racha vs umbral, recall que
   destraba comprensiones, After Day sin filtro de palabras, /crear sin guardia, playlists de canal
   desordenadas por `anyOf`, etc. — listas completas en cada informe §Trampas): ¿se portan EXACTO o
   corregidos dejando cada desvío documentado? Propuesta: corregidos + documentados uno a uno.
6. **MyTube W5:** ¿entra la ingesta del padre completa de una (server-side con nuestra key de YT) o
   primero la experiencia del chico sobre el catálogo ya importado (~95k videos) y la ingesta en una
   tanda siguiente?

## 5. Estado operativo (12-oct)

- route-lab **copiado tal cual** a `innerith-ui/route-lab/` (fuente completa + jobs + fixtures;
  excluidos solo `.venv`, `__pycache__` y `.env`); `.gitignore` actualizado; `.env.example`
  restaurado con la plantilla de HEAD; venv propio creado e instalado; `.env` local con la key
  (nunca impresa). El :5203 hoy lo sirve una instancia de Esteban (python PID externo, modo `real`);
  la del repo se levanta con `cd route-lab && .\.venv\Scripts\python.exe -m uvicorn server:app --port 5203`
  (OJO: `uvicorn.exe` directo lo bloquea el Control de aplicaciones de Windows en esta máquina).
- La app del POC corre en :5173; su wizard quedó en el paso 2 (clave de OpenAI: la carga Esteban, o
  importa su respaldo en el paso 1 para traer la config real).
- Innerith web en :5188 (preview) + API :8787.
- **W2 (motor de actividades) — HECHA 12-oct, sin commitear.** Árbol nuevo `src/learn/` espejo de
  `app/src/learn/` del POC @ `47f434b`: núcleo `activity/*`, los 5 tipos `activities/*` (engines,
  módulos, configs, generadores, porteros), `kits/dragdrop/*`, `react/useActivity.ts`, los 5 Boards,
  `registry.ts`, `definitions.ts` (12 seeds + hook de importadas), `recallActivity.ts` (solo el ARMADOR
  `buildRecallActivity`), `visual/*` y `audio/*` (+ `engine/*`). Fidelidad: de los 72 archivos portados,
  61 son idénticos al POC salvo especificadores de import (`.ts` fuera: Innerith no permite importar
  con extensión); los otros 11: clases Tailwind→`lrn-` y lucide→íconos de Innerith (5 Boards +
  VisualStage), paths (gameManifest, sceneDirector, ytScenePlayer) y dos cortes de ALCANCE
  (definitions, recallActivity). Desvíos/seams documentados en cada archivo: `hydrateImportedDefinitions` (Dexie)
  NO se porta → la hidratación desde `api` la cablea W3 con `registerImportedDefinitions(filas.map(r=>r.def))`;
  `recallableTargets` + `lib/recall` (urgencia) → W4; `sceneDirector`/`ytScenePlayer` portados FIELES
  pero SIN MONTAR (el director lee el fondo de `audio/bgAudioPort.ts`, inerte hasta que W3 lo enchufe
  al MiniPlayer con `bindBgAudio`; `ytScenePlayer` usa `src/shared/lib/ytBridge`). Quirks portados
  tal cual y fijados por tests: trampas 6, 13 (inflado del multi con hijos MC), 17 (`quiz-relampago`,
  `multi-actividad`), 38, 39, 40. Assets: los 9 WAV a `public/learn/audio/` (SHA-256 idénticos;
  `baseUrl` `/learn/audio/`). Estilos mínimos en `src/learn/learn-engine.css` (prefijo `lrn-`, lo
  importa cada Board; estética fina = W3). Tests: `npm test` (vitest 4, devDependency) → 9 suites /
  107 tests verdes (6 suites portadas del POC + 3 nuevas: opción múltiple, fidelidad, armador de
  recall). Humo Edge headless (harness en el scratchpad): partida completa de flashcards, MC, quiz,
  dominó (drag real) y un multi de 2 hijos, ERR []. **Pendiente W3:** montar los Boards en el
  ActivityOverlay (lobby/cuenta/resultado, `makeSeed`), cablear hidratación de importadas y
  resultados al server, integrar SceneDirector/escenas con el MiniPlayer, estética fina de los Boards.
  Hallazgo a decidir (no tocado): en pantallas hi-DPI el canvas de partículas del VisualStage se ve
  al doble de tamaño (pasa igual en el POC: `absolute inset-0` no estira un `<canvas>`).
- **W1 (/crear + route-lab + catálogo + auditoría) — HECHA 12-oct, sin commitear.** `sections/create/**`
  (+ `create.css`, prefijo `cr-`): port exacto de `RouteCreator.tsx` con `routeDraft.ts`, `parseYtUrl` y
  `cropToCover`/`mqThumb` portados a `sections/create/lib/`; route-lab se llama DIRECTO desde el navegador
  (`/module`, `/emit`; URL editable en la vista, recordada en `innerith.routeLabUrl` al Generar); los
  `confirm()` del POC son una hoja de Innerith (`ConfirmSheet`) con el MISMO texto. Server:
  `learnRoutes.ts` = el catálogo (filas Dexie `learnRoutes`/`learnDefinitions` con sus formas) en
  `server/data/learn-routes.json` (atómico, fuera del reset), validación del importador del POC con sus
  mensajes + reemplazo transaccional por `routeId`; `create.ts` = `factAudit` del POC en el server
  (`gpt-5.5`, Serper + Wikipedia, 8 rondas). **Aditivos** (a formalizar en types.ts): item de lista
  `modules`; `one` → `editorial`; resultado del import `title/definitions/postas`; bundle `editorial`
  (+`meta`); `/api/create/audit` `{payload:{fact,lang?}}` → `{ok,result|error}`. Quirks portados tal
  cual: 33/F1 (reabre `['flashcards']`/`'auto'`; Aplicar sobre un MC reabierto emite flashcards), F2,
  F3, F5, F6, F7, F8, F10. QA: E2E Edge real (2 módulos chicos + 1 auditoría real) y ensayo en seco con
  route-lab simulado, ERR []; el catálogo quedó solo con la seed. **Pendiente W3:** (1) sumar al import
  el acuñado seco COMPLETO (generador + portero, `buildDefinition(id, 1)`): hoy el server valida Tipo y
  generador registrados pero NO el contenido (p. ej. una tarjeta vacía pasa); el registry de W2 importa
  los Boards (.tsx/CSS), así que el server no lo puede cargar tal cual [**SALDADA 14-oct**, tanda Deudas técnicas A: `registryCore.ts` + `dryMint.ts`]; (2) la hidratación del motor
  necesita las definiciones de TODAS las rutas (hoy: `one` por ruta). **Seed:** el bundle real de
  poc-solar es `route-lab/jobs/poc-solar/60-route-bundle.json` (`fixtures/poc-solar.json` es la salida
  LLM enlatada del modo stub, no un bundle) y `jobs/` lo ignora el `.gitignore` de route-lab → en un
  clon limpio el catálogo arranca vacío (a decidir: versionar una copia del bundle fuera de `jobs/`).
  **Operativo:** en esta máquina el Control de aplicaciones de Windows bloquea `.venv\Scripts\uvicorn.exe`;
  corre con `.\.venv\Scripts\python.exe -m uvicorn server:app --port 5203`. El :5203 de Esteban sirve
  desde la carpeta del POC (arrancó antes de la copia): la QA usó la copia del repo en un puerto efímero
  para no escribir jobs en el POC.
- **W3+W4 (Learn colapsado + Active Recall) — HECHA 12-oct, sin commitear.** REVISIÓN DE FIDELIDAD (revisor independiente POC↔port, 12-oct) — diferencias asumidas y documentadas: (1) sin "(Beta)" en el subtítulo; (2) skeleton + "Reintentar" si el catálogo no carga (el POC leía Dexie local, sin fallas); (3) la fila grabada: `finishedAt` lo sella el SERVER (contrato), `pct` se clampa a [0,1] y un target vacío da 400 — la urgencia del recall puede moverse por latencia/relojes (demo: misma máquina, nulo); (4) CORREGIDO al cierre: el lector anidado se titula con el TEXTO del link (como el POC), con la URL de respaldo; (5) si falla el guardado de un resultado se pierde con console.error (sin retry: pendiente conocido) [**SALDADA 14-oct**, tanda Deudas E: cola con reintentos en orden] y si falla la hidratación de definiciones el botón raíz no aparece hasta reentrar; (6) CORREGIDO al cierre: GET /api/learn-routes filtra `enabled !== false` (paridad useImportedRoutes; hoy sin efecto). Aprender ES Learn (`sections/learn/**`,
  prefijo `ln-`): port EXACTO de `Learn.tsx`, `RutaView.tsx`, `ActivityOverlay.tsx`, `lib/learn.ts` (resolveRoute y
  compañía), `lib/recall.ts` (→ `src/learn/recall.ts`, con `skillMastery`), `recallableTargets` (→ `src/learn/recallActivity.ts`),
  `overlayNav` (useOverlay), `routeCover` y las fases `ReadingView`/`VideoReadingView`. **Mosaico** de las rutas del catálogo
  por categoría (orden del POC; un grupo = grilla plana) con portada (manual → miniatura maxres/mq del 1er video → emoji),
  "N/M postas" y el botón raíz "Active recall · N temas" (espera la hidratación: trampa 16 resuelta, aprobado). **Camino**:
  zig-zag por índice global, los 6 pares de color EXACTOS por módulo con banda sticky y guidebook, nodos círculo/cuadrado,
  estados de `resolveRoute` tal cual, repaso en ruta (K = min(5, n), urgencia en el gesto). **Overlay** (portal a pantalla
  completa): lectura con el LECTOR REAL de Innerith (mismo `api.article` + `WikiArticle`; ReadingView propio de la
  sección porque ArticlePage está atada a su ruta) o video propio (nocookie + sandbox) → "Empezar preguntas →" → lobby,
  cuenta 3-2-1 (700/450 ms), Runner y resultado, `makeSeed` exacto, persistencia primero (hijo → su target, outer → posta,
  recall sin outer, multi con rollup). **Datos**: `lib/learnData.ts` = el liveQuery del POC sobre el server (filas +
  rutas + hidratación con `GET /api/learn-routes/definitions`, nuevo); `recordResult` → `api.recordLearnResult`
  fire-and-forget. **SceneDirector montado**: `useScene('ruta')`, push/update/pop por fase, gano/perdio, y
  `bindBgAudio` con el MiniPlayer real (bgAudio sumó `getBgState` + `setMusicVolumeTransient` y des-mutea al
  `unduck`, como el POC). **Economía** (desvío aprobado, `server/src/learnResults.ts`): la 1ª fila `completed` no-rollup
  de cada target paga 30 ⚡ + 30 XP (la tarifa de cerrar una unidad de Practicar) y el resultado lo muestra ("+30 ⚡").
  **Feed** re-apuntado a las rutas reales (hero "Seguí con <ruta>" · "Vas X de Y postas", cards y rutas compartidas del
  catálogo, `/aprender?ruta=<id>`). **Retirado**: `sections/practice/**` + `practice.css`, los cursos de `sections/learn`
  (CourseGrid/CoursePage/CourseCard/CourseCardSkeleton/CourseArt/UnitAccordion/ChapterCard), `server/src/{learn,practice}.ts`
  y `course`/`lastCourse` de `progress.ts` (el "seguí practicando" lo deriva Learn). **Desvíos/recortes documentados**:
  sin iframe TEMP de YouTube en la escena 'ruta' (vuelve a `temaA`, como dice el propio POC) ni panel "Probar YouTube";
  sin la portada de Wikipedia para rutas de artículo [**SALDADA 14-oct**, tanda Deudas D: la pide el SERVER y la guarda en la fila]; `trusted` del lector sin equivalente (el server modera siempre);
  links del cuerpo → lector anidado (el server decide); el reloj de `finishedAt` es el del server (contrato);
  try/catch en el asentado de `equalPowerFade` (bug latente del POC: NotSupportedError al cambiar de escena rápido);
  si una definición rompe al acuñarse se ve el error del POC en vez de tumbar la página. **Hallazgo**: la trampa 31
  real es otra — "Atrás" en la fase de contenido de una posta CIERRA el overlay entero (orden de efectos de React:
  el ActivityOverlay queda arriba de la pila); portado igual que el código. QA: tsc/build/`npm test` (11 suites, 122
  tests: +recall y +resolveRoute) y E2E Edge (≈100 checks de los 10 pedidos + prueba aislada de lectura/repaso de
  módulo con ruta temporal), ERR []. **Pendiente**: ~~acuñado seco completo al importar (W1)~~ (saldada 14-oct), formalizar en types/api
  lo aditivo (`course.emoji` del feed) y podar cursos/práctica del contrato (coordinador).
- **W5 (MyTube) — HECHA 12-oct, sin commitear.** Port exacto de `MyTube.tsx`, `ChannelView.tsx`, `MisListas.tsx`
  (ListView), `lib/mytube.ts`, `lib/youtube.ts` y la solapa YouTube de `pages.tsx`. **Chico** (`sections/mytube/**`,
  `mt-`): `/mytube` con solapas Canales | Mis listas en estado local (viaja en el state del historial, nunca en la URL;
  arranca en Canales); Canales = SOLO seguidos con contenido, sin buscador ni "Para descubrir"; `/mytube/canal/:id` con
  @handle, descripción curada en dos líneas expandible, Seguir/Siguiendo, Videos (N) de a 40 + «Ver más» de a 60 y
  Playlists (N) en acordeón, sin suscriptores; `/mytube/lista/:id` (Reproducir todo → cola, Escuchar de fondo → cola
  entera al MiniPlayer y cierra, ↑/↓ con el vecino visible, ✕, ⋮ Renombrar/Borrar con el texto del POC). Los overlays del
  POC son rutas: «Volver» = Atrás si se vino de MyTube. **Server** (`server/src/mytube.ts`): la capa que el catálogo plano
  no tiene —entidades de canal, playlists propias y la ingesta del padre— en `server/data/mytube.json` (atómico,
  catálogo: fuera del reset); el canal se ENRIQUECE ON-DEMAND la primera vez (channels.list → descripción curada con el
  modelo juez, sin pisar la del padre → playlists propias solo donde el POC las sincronizaba) y queda cacheado; los
  videos de la familia se SUMAN al catálogo global al servir. **Padre** (Zona de padres → YouTube): lote de URLs con el
  parser exacto, tabla de entradas con Reingestar/Eliminar, Completar canales, Quitar duplicados, tope por entrada y
  «Canales de MyTube» con la descripción editable. **Aditivos** (a formalizar en types.ts; cliente provisorio en
  `src/api/index.ts`, formalizado en la consolidación del 12-oct): `/api/mytube/{channels, channel, channel/videos, channel/playlist}` y
  `/api/mytube/admin/{state, channels, add, reingest, remove, backfill, dedup, cap, channel-desc, usage}` (detalle en el
  README y en la cabecera de `mytube.ts`). **Quirks portados tal cual:** Canales por channelId y con conteo que no
  descuenta palabras; «1 videos»; Playlists (N) sin mirar palabras; videos de una playlist ordenados por videoId (bug del
  `anyOf`); todo video (también los de una playlist y los de una lista) se abre SUELTO; un video = un entryId (borrar una
  entrada se lleva los que otra posterior compartía); reingestar no borra; `followed` cae con el canal; descripción vacía
  del padre se re-cura en la próxima ingesta; `Number(cap) || 0`. **Desvíos** (además de a/b): el catálogo base es de solo
  lectura (reingestar/completar solo refrescan filas de la familia); canal del catálogo base sin entidad → título del
  catálogo; editar la descripción de un canal sin entidad la crea; textos que nombraban la pantalla del POC: «(Ajustes)»
  → «(falta en el servidor)», «Agregar a lista» → «＋ Lista» (el botón del reproductor de Innerith), y el vacío de
  entradas aclara que existe el catálogo base. **Retirado** (cero zonas muertas): `space/containers/{VideosPage,
  ChannelPage,PlaylistPage}`, `space/cards/{ChannelCard,PlaylistCard,VideoTile}`, `space/components/{ChannelsPane,
  PlaylistsPane}` y sus bloques de `space.css`. **Pendiente (coordinador):** (1) enchufar `familyCatalog` en `videos.ts`
  (getCatalogVideo/getVideo/searchVideos) para que Buscar, el reproductor, el chat, Mis listas y Drive vean los videos de
  la familia — hasta entonces un video que sumó la familia y no está en `catalog.json` se ve en MyTube pero el reproductor
  lo rechaza; (2) el chip de canal del reproductor → `/mytube/canal/:id` (única puerta a un canal no seguido en el POC);
  (3) retirar `GET /api/space/channels|channel` (+ `api.channels/channel`, `Channel`, `ChannelDetail`) del contrato. [14-oct, tanda Deudas B y C: el reproductor quedó EXACTO al POC en las 4 diferencias que quedaban —relacionados, cola circular con salto de caídos, «Escuchar de fondo» solo del actual, «＋ Lista» con ✓— y `/api/mytube/admin/*` pide la sesión del portón.]
  QA: E2E Edge (101 checks, ERR []) + prueba aislada de Completar canales y de la trampa del entryId.
- **W6+W7 (After Day + Horarios por sección) — HECHA 12-oct, sin commitear.** Port exacto de `AfterDay.tsx`,
  `lib/afterday.ts`, `AfterDayTab` (Admin → Listas), `lib/featureSchedule.ts`, `HorariosEditor` (Ajustes) y el filtrado +
  guard de ruta de `ChildShell.tsx`, sobre el contrato congelado (45766b7). **After Day** (`sections/afterday/**`, `ad-`):
  grilla 2/3/4 (los sm/lg del POC, por ventana) del más nuevo al más viejo; tarjeta = miniatura + título o "Audio" + play; la
  que suena resaltada (nota musical); tocar = `playTrack(…, 0, audioOnly=true)` → cola de UN track (con repetir 'all' se repite
  ese), tocar otra la reemplaza, NUNCA abre el reproductor; vacío con los textos del POC; relee al volver el foco (el liveQuery
  del POC). `bgAudio` sumó `audioOnly` (lo fija cada `playQueue`/`playTrack`, default false: el "Escuchar de fondo" del
  reproductor lo apaga, como el POC) y el MiniPlayer esconde "Abrir el video" con él. **Padre**: «Música de After Day» al pie
  de Zona de padres → YouTube (link + nombre opcional + Agregar, "✓ Agregado: …", lista con miniatura, nombre o "(sin
  nombre)", videoId y Quitar) con la SESIÓN (`GET /api/parent/music`, `POST music/add`, `POST music/remove` en `parent.ts`).
  **Server** `afterday.ts`: `extractVideoId` del POC tal cual (copia del parseYtUrl + el fallback `v=`/youtu.be: un
  `watch?v=X&list=PL…` es el video X), "No es un link de un video de YouTube" / "Ese video ya está en la lista.", thumb
  hqdefault, `music.json` atómico fuera del reset. **Horarios**: `server/src/schedule.ts` = `isFeatureOpen`/`nextOpenLabel`
  EXACTOS (cruce de medianoche, from == to = 24 h, fail-open) + `checkPatch` (secciones conocidas, 7 días, HH:MM) +
  `patchSchedules` + `sectionForApi`; `index.ts` responde `403 {error:'horario', section, opensAt}` ANTES de rutear (Chat/Tienda
  APAGADOS responden su propio 403: gana el apagado). Cliente: `sections/parent/lib/scheduleRules.ts` (reglas puras, espejo del
  server, con tests) + `lib/schedules.ts` (store junto a features/limits: GET al montar, tick de 30 s que relee y evalúa con
  la hora del server —delta `serverNow − Date.now()`—, foco, BroadcastChannel, y al ENTRAR a una sección con el dato > 15 s
  espera la lectura nueva, como useFeatureGate); el Sidebar filtra; `ScheduleGate` va compuesto DENTRO de `FeatureGate` (App.tsx
  intacto) con la pantalla "cerrado" del POC (copy.fueraDeHorario + "Se abre de nuevo a las HH:MM." si hoy abre más tarde) con el
  estilo de FeatureOff y "Ir al Feed". Editor del padre debajo de los topes de volumen: "Restringir {sección} por horario",
  Lun→Dom guardado por getDay(), abierto/cerrado + desde "a" hasta; "Guardar horarios" manda SOLO lo tocado.
  **Quirks portados tal cual:** After Day no filtra palabras bloqueadas; el audio que sonaba sigue al cerrarse la franja (la
  sección se va del menú y la vista pasa a "cerrado"); el `v=` de cualquier dominio pasa como videoId; sin nombre = "Audio" en
  la tarjeta y "Música" en el MiniPlayer; tocar la tarjeta que ya suena no la reinicia (y si estaba en pausa la marca "sonando"
  sin mandar play: `playQueue` con el mismo id no re-monta el iframe, igual que el POC); el editor normaliza por día; "se abre
  a las…" solo mira hoy; un horario inválido deja la sección ABIERTA. `bgAudioEnabled` no existe en Innerith (nada que portar).
  **Desvíos** (además de a/b): (1) el server es la verdad Y el candado (403) — el POC solo escondía la vista en localStorage;
  (2) título por noembed cuando el padre no pone nombre (decisión del contrato; el POC no buscaba título); (3) mapa del
  enforcement afinado respecto del brief para no cerrar lo que el POC no cerraba (overlays del shell): `/api/article` (lector:
  lo usan Feed, Mi espacio, chat y las postas de lectura de Aprender) y `/api/video` nunca se gatean; `/api/teachers*` es la
  pantalla Profesores del PADRE (como `/api/mytube/admin/*`, siempre pasa); de `/api/space/*` solo se gatea el Drive
  (`/api/space/drive*` menos crear carpeta) — Seguir y Mis listas son de MyTube y `save`/`folders`/crear carpeta son del
  selector "¿Dónde lo guardás?" (el FolderPicker del POC, que crea carpetas); en el cliente `/buscar/articulo/:id` y
  `/buscar/video/:id` tampoco se cierran con Buscar; (4) validación: un día ABIERTO de una sección restringida necesita sus dos
  horas (el server exige HH:MM; en el POC una hora vacía dejaba el día abierto entero); en días cerrados o secciones sin
  restringir una hora vacía vuelve al default; (5) "sin restringir" con una semana propia se guarda (el editor del POC la
  recuerda) y con la de fábrica se borra la entrada (equivale a no tener horario: el archivo queda limpio); (6) sin el "nada
  disponible" del POC: el Feed nunca se cierra; (7) el día y la hora se leen en la zona horaria del navegador (el contrato trae
  el instante del server, no su zona; en el demo es la misma máquina); (8) el panel suma una línea al pie ("El Feed no tiene
  horario… la música sigue hasta que {chico} la pare") — se puede quitar. QA: tsc -b --force, tsc server, build, `npm test`
  (12 suites, 134 tests: +horarios), unidad del server en el scratchpad (≈100 casos: franja, mapa API→sección, patch, parser),
  humo de API (35) y E2E Edge (≈100 checks de los 9 pedidos, incluido el tick que cierra After Day sin recargar con el audio
  sonando; 1280/1024/820), ERR []. Estado restaurado: `schedules.json` = `{}` y `music.json` = `[]` (sin seed). **Pendiente
  (coordinador):** (1) ¿seed de After Day para el demo? (hoy nace vacía); (2) confirmar los ajustes al mapa de enforcement del
  desvío 3; (3) con la Tienda fuera de franja el guardarropas de "Tu avatar" (ProfileCard lee `/api/market`) dice "No pude ver tu
  ropa ahora…" [**SALDADA 14-oct**, Deudas F]; (4) el Feed sigue ofreciendo rutas y ⚡ de secciones cerradas (llevan a "cerrado"); (5) una vista que monta con
  el dato apenas viejo puede pedir su API y ver un 403 un instante antes de que el portón la cierre (el 403 no dispara una
  relectura: haría falta tocar `src/api`); (6) zona horaria de la familia [**SALDADA 14-oct**, Deudas G; el desvío (7) deja de aplicar: el día y la hora se leen en la zona de la familia].
- **Tanda «Deudas técnicas» (A-G) — HECHA 14-oct** (commiteada con los remates del coordinador; sobre los contratos congelados en a459ec6; repo ya en
  Desktop). **A · acuñado seco completo**: el registry se partió sin tocar lógica — `src/learn/registryCore.ts` (Tipos,
  generadores, portero y `build`, TS puro) + `registry.ts` (núcleo + Boards, misma forma y orden de claves);
  `definitions.ts` usa el núcleo y `src/learn/dryMint.ts` es el bloque del importador del POC tal cual (registrar → acuñar
  con seed 1 → rollback + `La app rechaza el bundle (acuñado seco falló):\n- <defId>: <causa>` con todas las causas).
  `learnRoutes.ts` lo importa (el tsconfig del server sigue los imports a `../src`: sin .tsx ni CSS en la cadena); se
  retiró el chequeo parcial. Quirks fieles: un id del seed se acuña con el SEED; un multi con hijas inexistentes pasa (se
  resuelven al jugar). Test: `src/learn/__tests__/dryMint.test.ts` (5, incluida la seed poc-solar). **B · reproductor
  exacto-POC**: `videos.ts:relatedVideos` (port de `videoSearch.ts`) → `Video.related`; `VideoSidePanel` («Relacionados» /
  «En la lista»), apaisado = la VISTA ≥ 720 px y más ancha que alta (el POC mide la ventana porque su reproductor es un
  overlay a pantalla completa); cola circular con racha de caídos (onError vía `parseYtError`, un play la resetea);
  cambios de video con `replace` (el overlay del POC no apila historial); «Escuchar de fondo» = solo el actual;
  `space.playlists(videoId)` → `has` y `ListSheet` con ✓. **C · sesión del portón**: `parent.hasParentSession` (+
  `PARENT_SESSION_EXPIRED`) en `mytube.ts` (todo `/admin/*`) y `teachersFake.ts` (`/api/teachers*`; `/api/calendar` público);
  `YouTubePanel`/`TeachersPanel` por `parentCall`. **D · portada de rutas de artículo** (`server/src/routeCover.ts`, puro +
  glue en `learnRoutes.ts`): firstContent/wikiTitle del POC, summary al host del artículo, `route.cover` = URL http en la
  fila; al importar en segundo plano, lazy en el GET (≤ 2,5 s) y al leer el Feed; "ya intentada" en RAM. /crear no reabre
  una portada http como manual (`routeDraft.unflatten`). **E · cola de guardado** (`learnData.ts`): FIFO de a uno,
  reintentos 2/8/30 s solo para fallas transitorias, orden preservado, optimista una sola vez; test
  `sections/learn/lib/__tests__/learnData.test.ts` (6). **F · avatar con Tienda cerrada**: `useWardrobe` mira el store de
  horarios (y ante un 403 reconfirma) → aviso suave sin reintento ni candados. **G · zona horaria de la familia**:
  `src/shared/lib/zonedClock.ts` (helper Intl compartido server/cliente) + `parent.json tz` + `POST /api/parent/tz` +
  `schedule.ts` (setFamilyTzSource, sin ciclo) + `feedFake` (franja y día del resumen) + `scheduleRules.ts`/`schedules.ts` +
  `TimezoneControl` arriba de los horarios. Test: `src/shared/lib/__tests__/zonedClock.test.ts` (7). QA: tsc -b --force,
  tsc server, build y `npm test` (15 suites) verdes; regresión de unidad de W7 (99) OK; E2E Edge por trabajo, corrida final (A 8 por API, B 33,
  C 25 por API + 7 en la UI, D 18 de unidad + D/E 10 en la UI, F 9, G 14 por API + 13 en la UI), consola limpia salvo las
  miniaturas 404 de un video del catálogo que YouTube ya no tiene.
  **Pendiente (coordinador)**: (1) ~~subtítulo del Feed y reloj del TopBar con hora del navegador~~ [**SALDADA 14-oct**,
  remate del coordinador: `daypartLine(serverDate(sched), sched.tz)` y `clockParts` con `wallClock` + `timeZone` — los dos
  miran la zona de la familia y el delta con el server]; (2) un POST de resultado que llegó al server pero perdió la
  respuesta se graba dos veces al reintentar (haría falta una clave de idempotencia en el contrato); (3) el catálogo de
  videos trae algunos que YouTube ya borró (miniatura 404): la cola los saltea, pero aparecen en relacionados/búsqueda.
