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
  los Boards (.tsx/CSS), así que el server no lo puede cargar tal cual; (2) la hidratación del motor
  necesita las definiciones de TODAS las rutas (hoy: `one` por ruta). **Seed:** el bundle real de
  poc-solar es `route-lab/jobs/poc-solar/60-route-bundle.json` (`fixtures/poc-solar.json` es la salida
  LLM enlatada del modo stub, no un bundle) y `jobs/` lo ignora el `.gitignore` de route-lab → en un
  clon limpio el catálogo arranca vacío (a decidir: versionar una copia del bundle fuera de `jobs/`).
  **Operativo:** en esta máquina el Control de aplicaciones de Windows bloquea `.venv\Scripts\uvicorn.exe`;
  corre con `.\.venv\Scripts\python.exe -m uvicorn server:app --port 5203`. El :5203 de Esteban sirve
  desde la carpeta del POC (arrancó antes de la copia): la QA usó la copia del repo en un puerto efímero
  para no escribir jobs en el POC.
