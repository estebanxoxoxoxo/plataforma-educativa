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

## 4. Decisiones abiertas (para hablar con Esteban)

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
  la del repo se levanta con `cd route-lab && .\.venv\Scripts\uvicorn.exe server:app --port 5203`.
- La app del POC corre en :5173; su wizard quedó en el paso 2 (clave de OpenAI: la carga Esteban, o
  importa su respaldo en el paso 1 para traer la config real).
- Innerith web en :5188 (preview) + API :8787.
