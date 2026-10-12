# Porte Smarty→Innerith · Informe 3: MyTube, After Day y arquitectura de la app

> Análisis de ingeniería inversa sobre `smarty-poc` rama **develop**, HEAD `47f434b` (12-oct-2026).
> Producido por el analista de la fase de investigación (pedido de Esteban: funcionalidad EXACTA,
> sin recortes; estética irrelevante). Los otros informes: 01 route-lab+Crear, 02 Learn+Active Recall,
> 00 el mapa consolidado.

**Base.** La app vive en `app/`: React 19, Vite 8, Tailwind 4, Dexie 4 y pnpm (`pnpm -C app run dev`, http://localhost:5173). Es 100% frontend: los datos viven en IndexedDB (base Dexie `smarty`, 26 tablas, versiones v1 a v16) y en localStorage (claves con prefijo `smarty.`). Todo verificado en código salvo lo marcado "no verificado".

---

## 1. MyTube

### 1.1 Qué es
MyTube no tiene catálogo propio: es una vista sobre los videos que aprobó el padre (`ytVideos`) más la entidad canal (`ytChannels`).
- Un canal existe y se puede seguir si tiene al menos un video aprobado. Dentro del canal solo se ve lo aprobado.
- "Seguir" es un flag del niño (`ytChannels.followed`). No hay suscripción real a YouTube.

### 1.2 Vistas
La ruta `/mytube` muestra `MyTube.tsx`. La sección está sujeta al horario de `'mytube'`.

**Inicio de MyTube.** Dos solapas, Canales y Mis listas. La solapa vive en estado local (no en la URL) y arranca en Canales.
- **Canales:** muestra solo los canales que el niño sigue y que tienen contenido.
  - Cada tarjeta: avatar, título y "N videos". El conteo sale del índice y no descuenta los títulos con palabras bloqueadas.
  - El orden es por `channelId`, no alfabético.
  - Vacío: "Todavía no seguís ningún canal. Cuando veas un video, tocá Seguir para tenerlo acá."
  - **No hay buscador de canales ni grilla para descubrir.** A un canal que no se sigue solo se llega desde el chip de canal del reproductor.
- **Mis listas:** primero una tarjeta "Nueva lista", después las listas del niño, de la más nueva a la más vieja.
  - Portada: el primer video que siga aprobado y no tenga palabra bloqueada.
  - El conteo cuenta solo esos videos.

**Vista de canal** (`ChannelView.tsx`, overlay a pantalla completa):
- Arriba: avatar, título, @handle, botón Seguir/Siguiendo y la descripción curada (dos líneas; tocar la expande).
- Solapa **Videos (N)**: aprobados, sin duplicados y sin palabras bloqueadas, en orden de ingesta. Muestra 40 y después "Ver más (N restantes)" de a 60. Cada fila: miniatura con duración, título y "agregado {fecha}". Tocar abre el video suelto.
- Solapa **Playlists (N)**: las playlists propias del canal en YouTube que tengan al menos un video aprobado, en orden alfabético. Acordeón. Tocar un video lo abre suelto: **no reproduce la playlist como cola.**

**Vista de lista** (overlay, `ListView` dentro de `MisListas.tsx`):
- Menú ⋮ con Renombrar y Borrar (confirma: "Los videos no se borran").
- "Reproducir todo" abre el reproductor con la lista como cola (`openPlaylist(videos,0)`).
- "Escuchar de fondo" manda la cola entera al audio de fondo (`playQueue(...)`) y cierra la vista.
- Cada fila tiene ↑/↓ (intercambia con el vecino visible, por videoId) y ✕ para quitar. Tocar un ítem lo reproduce suelto.

**Selector de lista** (`ListPicker`): hoja "Agregar a una lista" desde el reproductor. Marca con check las listas que ya tienen el video y permite crear una "Lista nueva" con ese video adentro.

**Overlays:** no son rutas. Estado en `ChildShell` con contador `seq` que re-monta en cada apertura. El Atrás del navegador funciona por una pila en `overlayNav.ts` (pushState + un único listener de popstate que cierra el de arriba). Se encadenan (canal → reproductor → canal).

### 1.3 De dónde salen los videos
El padre los carga en Admin → Listas → YouTube (`pages.tsx` + `youtube.ts`). Varias URLs a la vez, una por línea o con `;`.

**URLs aceptadas:** youtu.be/ID, watch?v=ID, /shorts/, /embed/, /playlist?list= y /@handle. Con `&list=` de prefijo PL/UU/OL/FL se toma como playlist. **No acepta** /channel/UC…, /c/ ni /user/.

**Qué necesita cada tipo:** un video suelto funciona sin key (título por noembed.com). Playlist y canal **requieren key de YouTube Data v3**.

**Al ingerir:**
- `videos.list` en lotes de 50: guarda duración, canal, tags, categoryId y topics.
- `channels.list`: título, handle, avatar y descripción.
- Descripción curada: limpia URLs/mails/promos → resumen kid-friendly con el modelo "juez" de OpenAI → sin key, descripción limpia cortada a 400 chars → si el padre ya la editó, no se pisa.
- Canal: sincroniza todas sus playlists propias en `ytPlaylists`.
- Foto fija: los videos nuevos del canal NO entran solos. Tope por entrada `videoCapPorEntrada` (500 por defecto; 0 = sin tope).

**Mantenimiento:** Reingestar (no borra lo que ya no está en la fuente), "Completar canales (MyTube)" (rellena canal/duración/tags faltantes), "Quitar duplicados". Al borrar una entrada se borran sus videos; canal sin videos se borra con sus playlists y el `followed`. En Admin, "Canales de MyTube" permite editar la descripción de cada canal.

### 1.4 Búsqueda y filtros
- **MyTube no tiene buscador propio.** Se busca desde el chat (`show_videos`), desde Buscar y desde "Relacionados".
- Motor MiniSearch en memoria (`videoSearch.ts`): indexa título, nombre de entrada y canal, descripción a 140 chars, tags y topics; AND, sin prefijos, fuzzy 0.2, sin muletillas; hasta 24 resultados; consulta sin tema → nada.
- Relacionados: primero mismo canal (más nuevos), después similares por tema. Muestra 12, saca bloqueados antes de cortar.
- Palabras bloqueadas: se aplican a títulos AL DIBUJAR en todas las vistas de MyTube.
- **No hay moderación de títulos/miniaturas al ingerir** (SPEC RF-4.2 la pide; no implementada).

### 1.5 Reproducción
**Reproductor universal** (`VideoPlayer.tsx`):
- Contención: iframe youtube-nocookie, sandbox sin popups ni navegación, `pointer-events:none`; `controls=0`, `rel=0`, `fs=0`, `disablekb=1`, `iv_load_policy=3`; postMessage filtrado por `e.source`; miniatura tapa el video antes de empezar y al terminar (en pausa se ve el cuadro).
- Controles propios: tocar pausa/reanuda; ±10 s; barra arrastrable con teclado; volumen con tope parental `maxVolVideo`; pantalla completa interna sin recargar.
- Apaisado desde 720 px: relacionados al costado.
- Debajo: chip del canal y Seguir · Guardar en Drive (si ya está, muestra la carpeta y lleva ahí) · "Escuchar de fondo" (solo con `bgAudioEnabled`) · "Agregar a lista".
- Título con palabra bloqueada: no carga el iframe, aviso de contenido interceptado + evento `palabra`.
- Cola: panel "En la lista"; avanza al terminar o si no está disponible; al final vuelve al principio (repite siempre); se frena si TODA la cola da error; tocar un relacionado sale del modo cola.
- Con el reproductor abierto, pausa el audio de fondo y lo reanuda al cerrar.

**Audio de fondo** (`backgroundAudio.ts`, `BackgroundAudioHost.tsx`, `MiniPlayer.tsx`, `ytBridge.ts`, `ambientNoise.ts`):
- Iframe oculto fuera de pantalla (no `display:none`) montado en el shell del niño. Sobrevive al cambio de sección; se corta al ir a /admin o /imglab.
- Estado: cola e índice · volumen (`smarty.bgAudioVolume`, 60) · repetir off/all/one (`smarty.bgAudioRepeat`, 'all') · flag de pausa automática · flag `audioOnly` · posición y duración.
- Mini-reproductor (auriculares en la barra, siempre visible): anterior/reiniciar, play/pausa, siguiente, ciclo de repetir, "Abrir video" (oculto en `audioOnly`; abre el reproductor desde 0), Parar, barra de posición, volumen; ruidos blanco/marrón/rosa por Web Audio con volumen propio (`smarty.bgAmbientVol`, 35; tope `maxVolAmbiente`).
- "Escuchar de fondo" desde el reproductor pasa la posición actual (`&start=`).
- **No se guarda posición, cola ni historial. No existe "continuar viendo".** Sin MediaSession ni service worker.

### 1.6 Tablas Dexie de MyTube
`youtube`, `ytVideos`, `ytChannels`, `ytPlaylists`, `userPlaylists`, `blockedWords`, `saved`/`folders`, `events` (`palabra`, `guardado`). Detalle en §3.3.

### 1.7 Qué suma MyTube vs "canales + listas" y qué no tiene
**Suma:** (1) modelo de catálogo mantenible (ingesta/reingesta/completar/dedup/tope por entrada); (2) canal enriquecido (handle, descripción curada por IA editable, solapa Playlists del canal filtrada a lo aprobado); (3) reproductor universal con contención, relacionados, cola con avance automático y salto de caídos, Seguir/Guardar/Lista/Fondo; (4) motor de audio de fondo compartido (cola, repetir, posición, ruidos, topes del padre, pausa automática); (5) filtros transversales (palabras al dibujar, horario por sección, `bgAudioEnabled`).

**No tiene:** feed propio, "continuar viendo", historial, buscador interno, recomendaciones fuera de Relacionados, ni suscriptores/likes.

**Comparación con innerith-ui (lectura rápida, no exhaustiva):**

| Aspecto | Innerith hoy | Smarty POC |
|---|---|---|
| Lista de canales | Todos los canales, "Para descubrir" y buscador | Solo los seguidos, sin buscador |
| Página de canal | Videos aprobados y suscriptores | + descripción curada, handle y solapa Playlists; sin suscriptores |
| Mis listas | Equivalente | Equivalente |
| Audio de fondo | `bgAudio`, `MiniPlayer`, `ambientNoise` ya existen | Ídem |

---

## 2. After Day

**Qué es.** Sección (`/afterday`, ícono de luna) donde el niño escucha una lista de videos de YouTube curada por el padre, **solo como audio de fondo**. Nunca abre el reproductor de video; el mini-reproductor no ofrece "Abrir video". No es rutina de cierre ni resumen ni audio generado. La idea (HORARIOS.md): música para trabajar o estudiar con su propia franja horaria (incluso 24 h), disponible cuando lo demás está cerrado.

**Vista del niño** (`AfterDay.tsx`):
- Encabezado: "Audio para escuchar de fondo mientras hacés otra cosa. Tocá uno y seguí navegando."
- Grilla 2/3/4 columnas, del más nuevo al más viejo. Tarjeta: miniatura, título (o "Audio"), botón play. La que suena se resalta.
- Tocar llama `playMusic(track, 0, audioOnly=true)`: cola de UN tema; con repetir 'all' se repite ese tema. Tocar otro reemplaza. No hay "reproducir todo".
- Vacío: "Todavía no hay audio acá. Un adulto puede agregarlo desde el panel."

**Vista del padre** (Admin → Listas → "after day"): link de YouTube + nombre opcional; sin repetidos ("Ese video ya está en la lista."); valida que sea video ("No es un link de un video de YouTube"); lista con miniatura, nombre o "(sin nombre)", videoId y Quitar. No se edita, no se reordena, no hay carga múltiple.

**Datos.** Tabla `musicWhitelist` (Dexie v13): `{videoId (único), url, title?, thumb (hqdefault), addedAt}`. **Independiente de `ytVideos`**, sin key de YouTube. En el respaldo va en Configuración.

**Interacciones.** Mismo motor de fondo que MyTube (suena una sola cosa por vez). Dentro de Learn, el director de escenas baja/funde/pausa este audio y lo restaura al salir. Sigue sonando al cambiar de sección; no sobrevive a /admin ni a recargar. Si la franja se cierra, la sección se oculta pero **el audio que sonaba sigue**.

**Docs:** HORARIOS.md (Feature B, spec principal; dice "sin implementar" pero las 3 fases están hechas) · REPRODUCCION.md · SONIDO_FONDO.md (proponía mp3; el código sintetiza) · BACKLOG.md · FEED.md (diseño: "Noche / After Day: calmo, audio, sin gamificación fuerte"). SCENE_DIRECTOR/MOTOR_AUDIO no tratan After Day.

---

## 3. Arquitectura de `app/`

### 3.1 Carpetas
`index.html` · `package.json` · `vite.config.ts` · `vercel.json` · `public/` (íconos, manifest con start_url /chat, wav de Learn) · `src/`: `main.tsx` (tema guardado antes del primer render → `initTheme`), `App.tsx` (router + arranque), `db.ts` (Dexie), `components/` (Md, SafeImage, BrandFooter), `zones/child/` (shell, secciones, overlays, reproductores, fondo), `zones/admin/` (Admin, Onboarding, pages, LearnRoutes), `zones/lab/ImageLab.tsx`, `lib/` (servicios), `learn/` (motor de actividades, audio, sceneDirector, ytScenePlayer, importación y creador de rutas, auditor de facts).

### 3.2 Rutas de la SPA

| Ruta | Componente | Condición de acceso |
|---|---|---|
| `/` y `*` | HomeRedirect | A la primera sección abierta: chat → mytube → drive → afterday → learn → search; si ninguna, /chat |
| `/chat` | ChildChat | Key de OpenAI + horario |
| `/buscar` | Search | Key + flag `searchActivo` (off por defecto) + horario |
| `/mytube` | MyTube | Key + horario |
| `/drive` | Drive | Key + horario |
| `/afterday` | AfterDay | Key + horario |
| `/learn` | Learn | Key + flag `learnActivo` (off por defecto) + horario |
| `/crear` | RouteCreator | Solo la key. El menú lo oculta pero **la ruta no tiene guardia** |
| `/admin/*` | Admin | Onboarding → PIN → subrutas: inicio, listas, instrucciones, reglas, probar, actividad, ajustes |
| `/imglab` | ImageLab | Sin guardia; necesita keys de Serper y Vision |

Overlays del niño: lector, reproductor, canal, lista, "Ver más", visor de imágenes, selector de carpeta, selector de lista, historial de chats.

### 3.3 Esquema Dexie completo (base `smarty`, v1–v16)

| Tabla | V | Clave e índices | Campos | Para qué | Respaldo |
|---|---|---|---|---|---|
| sites | 1 | ++id, domain, status | domain, status activo/pausado, warning?, blocked?, blockedReason?, blockedAt?, createdAt | Lista blanca de artículos; `blocked` = muro anti-bot, se excluye | Configuración |
| topics | 1 | ++id, kind, name | kind blanca/negra, name, description, critical?, createdAt | Temas que propone Smarty / que revisan jueces y filtro por ítem | Configuración |
| youtube | 1 | ++id, type, status | type video/playlist/canal, url, title, videoIds[], status, channelId?, createdAt | Permisos de YouTube del padre | Configuración |
| messages | 1 | ++id, conversationId, isTest, createdAt | role, text (con marcadores), contextText?, kind (9 tipos), sources?, isTest | Chat | Sesión |
| traces | 1 | ++id, messageId, conversationId, isTest, createdAt | policyVersion, input, retrieval, output, accionFinal, resumen | Traza por decisión | Sesión |
| conversations | 1 | ++id, isTest, startedAt | messageCount, redirCount, crisisCount, fichaExtracted?, title?, archived? | Sesiones de chat | Sesión |
| events | 1 | ++id, type, state, createdAt | type (10 tipos; 'solicitud' y 'copia' sin uso), detail, state, conversationId? | Actividad del padre | Sesión |
| ficha | 1 | ++id, category | category, text, origin smarty/padre | Intereses del niño → prompt | Mixta |
| saved | 1 | ++id, type, createdAt | type, title, url, dataUrl?, folderId?, trashedAt? | Drive | Sesión |
| snapshots | 2 | ++id, url, policyVersion | html/markdown/text, hero, sections[], verdict, motivo, cita, policyVersion (-1 = lectura de ruta), fetchedAt | Caché del lector | Sesión |
| ytVideos | 3 (+índice v9) | ++id, videoId, entryId, channelId | title, thumb, entryId, description, channelTitle, duration, addedAt, tags, categoryId, topics | Catálogo aprobado | Catálogo |
| imgVerdicts | 4 | &url | url, ok | Veredictos de Vision | Sesión |
| blockedWords | 5 | ++id, word | word, createdAt | Lista negra de palabras | Configuración |
| imgSearches | 6 | &query | results[], fetchedAt | Caché de búsquedas de imágenes (7 días) | Sesión |
| articleMeta | 7 | &url | host, favicon, thumb, summary, resolved | Tarjetas de artículo (14 días) | Sesión |
| styleTemplates | 8 | ++id, &slug, builtin | ejes de estilo y fondo | Temas visuales | Mixta |
| ytChannels | 9 | &channelId, followed | title, handle, descRaw, desc, thumb, followed, createdAt | Canales + seguir | Catálogo |
| ytPlaylists | 10 | &playlistId, channelId | channelId, title, thumb, videoIds[] | Playlists propias del canal | Catálogo |
| folders | 11 | ++id, parentId | name, parentId (0 = raíz), color, emoji, trashedAt? | Carpetas de Drive | Sesión |
| domainRules | 12 | ++id, scope, [scope+kind] | scope articulos/imagenesB/lente:id, kind, value | Filtros de dominio | Configuración |
| lenses | 12 | ++id, &lenteId | lenteId, definicion | Temas sensibles de imágenes | Configuración |
| musicWhitelist | 13 | ++id, &videoId, addedAt | videoId, url, title, thumb | After Day | Configuración |
| userPlaylists | 14 | ++id, createdAt | name, videoIds[] (orden), createdAt, updatedAt? | Mis listas | Sesión |
| activityResults | 15 | ++id, target, finishedAt | target, source, typeId, score, pct, skills, seed, rollup | Resultados de Learn | Sesión |
| learnRoutes | 16 | &id | enabled, origin, importedAt, route, meta, editorial | Rutas importadas | Catálogo |
| learnDefinitions | 16 | &id, target, routeId | def | Definiciones de actividades | Catálogo |

### 3.4 localStorage (prefijo `smarty.`)
- **Keys:** openaiKey, youtubeKey, pixabayKey, serperKey, visionKey.
- **Acceso:** pinHash, recoveryHash, onboarded.
- **Perfil/modelo:** apodo, modelPreset (calidad/maxima/economico), auditModel, instrucciones, policyVersion, soloFuentes.
- **Flags:** learnActivo, searchActivo, imagenesActivo, bgAudioEnabled, debugMode.
- **Horarios:** featureSchedules (JSON por sección).
- **Volumen:** maxVolVideo, maxVolAmbiente (topes); bgAudioVolume, bgAudioRepeat, bgAmbientVol (preferencias).
- **Moderación/búsqueda:** moderationUrl, moderacionEstricta, juezOptimista, saltearJuezVideos, articulosModo, imagenesModoB, imagenesMotorGoogle, visionModoA, visionUmbral, imagenesLimite, imagenesCupoDiario, imgModCount/Date, searchGl, searchHl.
- **Catálogo:** videoCapPorEntrada.
- **Límites de sesión:** limitesActivo, limiteSesionMin, descansoMin, topeMensajes, recordatorioMin, preavisoMin, lockUntil.
- **Avatar/voz:** momentoModeracion, chatNarracion, momentoVozUrl, chatTema.
- **Estilo:** styleActiveSlug, styleCache.
- **Otros:** menuOpen, drive.lastFolder, routeLabUrl, routeCover.*, imgSeed, imgCacheNoL.v1.
- **Reglas editables:** `smarty.ov.<knob>` — ~77 overrides entre prompts, reglas y constantes (Admin → Reglas).

### 3.5 Servicios externos
- **OpenAI (Responses API)** desde el navegador (`dangerouslyAllowBrowser`, key de Ajustes, `llm.ts`): modelo principal del chat (tools, hasta 4 rondas), jueces de entrada/salida, expansor de imágenes, resúmenes del lector y ficha, descripción de canales, auditor de facts (gpt-5.5 por defecto), prueba de key del onboarding. Presets: calidad = gpt-5.4 + mini · máxima = gpt-5.5 + mini · económico = todo mini.
- **YouTube Data v3** (`youtube.ts`): sin key solo noembed para sueltos. Miniaturas i.ytimg; embeds youtube-nocookie.
- **Serper:** /search (artículos y auditor) y /images (motor Google). Key en header.
- **Google Vision:** moderación del motor Google (key en URL). **Pixabay:** opcional.
- **Sin key:** Commons, Wikipedia REST, r.jina.ai, favicons de Google.
- **Labs locales:** moderation-lab (NudeNet, `smarty.moderationUrl`, :5202) · voice-server (default apunta a :5203 — MISMO puerto que route-lab; el README dice :5201) · route-lab :5203 con endpoints /routes, /module y /emit.

### 3.6 Cachés y arranque
Lector: extracción 7 días; veredicto por `policyVersion`. articleMeta 14 días. imgSearches 7 días. imgVerdicts sin vencimiento. MiniSearch en memoria (se reconstruye al ingerir). Casi cualquier cambio del padre llama `bumpPolicyVersion()` → re-juzgar. Ajustes: "Limpiar caché de bloqueos".
Arranque: carga de listas de imágenes, migración de caché, `dedupYtVideosIfNeeded`, carga de rutas de Learn, `initTheme`, `navigator.storage.persist()` (recién al montar el chat).

### 3.7 Configuración inicial
**Portón del niño:** `ChildShell` revisa `settings.apiKey`; sin ella: "Smarty todavía no está configurado…" + link a /admin.
**Onboarding** (mientras `onboarded` no está): 1) Apodo (obligatorio) + "¿Ya tenés un respaldo? Importalo" (pide el PIN del respaldo y recarga) · 2) Key de OpenAI con "Probar conexión" (obligatorio que pase; **la key se guarda al probarla**) · 3) PIN de 6 dígitos · 4) Código de recuperación de 8 caracteres. Guarda apodo, apiKey, sha256(PIN), sha256(código), onboarded, y recarga. NO pide las otras 4 keys (van en Ajustes).
**Entrada al panel:** PIN de 6; 5 fallidos → 15 min de bloqueo + evento `pin`; recuperación con el código; auto-bloqueo a los 5 min de inactividad.

### 3.8 Panel de padres
Menú: Inicio, Listas, Instrucciones, Reglas, Probar, Actividad, Ajustes.
- **Listas:** solapas sitios, temas, palabras, youtube, after day, imágenes, lentes.
- **Actividad:** conversaciones, eventos, guardados (con ruta de carpeta y papelera), ficha.
- **Ajustes** (un solo "Guardar ajustes"): perfil y modo (apodo, solo fuentes, Learn beta con generación de rutas, Buscar beta) · audio (música de fondo + topes video/ruidos) · imágenes (buscador, URL NudeNet, estricto) · avatar y voz · límites y horarios (editor por sección) · claves y modelos (5 keys, tope de videos, preset, modelo del auditor, juez optimista, saltear juez de videos) · búsqueda (gl/hl, modo artículos, motor Google: modo B, umbral, Vision modo A, límite, cupo diario) · otros (debug, línea de ayuda, cambio de PIN, respaldo).

### 3.9 Respaldo (`backup.ts`)
**Exportar:** 4 ámbitos (Configuración, Catálogo, Sesión, Todo). Archivos `smarty-{scope}-YYYY-MM-DD-HH-mm.json`. Contenido `{format:'smarty-backup-enc', iv, data}` cifrado AES-GCM con `sha256(PIN)` como clave. Adentro `{format:'smarty-backup', version 1, scope, settings (todas las smarty.*), tables}`. **Incluye las 5 keys y el pinHash.**
**Importar:** pide el PIN; acepta respaldos viejos sin cifrar; reemplaza solo el ámbito del archivo; ficha y estilos se reponen parcialmente con ids nuevos; un import de "Todo" vacía también las tablas que no vienen.

---

## 4. Deltas doc↔código en Buscar, Drive y Chat

### 4.1 Buscar (BUSQUEDAS.md es del 19-jun)
- **Nuevo: /buscar (4-jul)**, off por defecto (`searchActivo`). Solapas Todo/Videos/Imágenes/Artículos. No usa el modelo principal: palabra bloqueada → juez de entrada 1×/consulta → por tipo, veto por ítem + juez de salida.
- **Artículos en el chat (22-jun):** `search_articles` ya no muestra tarjetas; devuelve candidatos con resumen y el texto de los 3 primeros; el modelo elige con `show_articles(ids)`. Paralelismo 4→8 (`const.articulosMaxBusquedas`). Sitios prioritarios (`const.articulosPrioritarios`, Wikipedia). Muros anti-bot siempre excluidos.
- **Imágenes:** Serper+Vision YA conectado tras toggle off (el doc dice que no). El expansor clasifica el término en un "lente". Carga inicial automática de sitios y lentes. "Leer la página" desde una imagen solo si el sitio está en la lista blanca.
- **Nuevo: el juez de salida "pela" ítems** (hasta 3 veces re-juzga sin el ítem bloqueado).
- **Videos:** igual al doc; pesos tags 2.5 / topics 2 fijos en código.

### 4.2 Drive (DRIVE.md es del 17-jun)
- **Nuevo:** papelera restaurable (`trashedAt`); borrar carpeta manda TODO a papelera (el doc decía mover arriba); restaurar/definitivo/vaciar, también en Admin.
- **Nuevo:** `search_archivo` en el chat (títulos, carpetas y texto de artículos guardados; tarjetas que abren y llevan a la carpeta).
- **Nuevo:** el botón de guardar muestra estado real y carpeta (`useSaved`).
- **Distinto:** raíz `parentId 0` (no null) · sin índice `folderId` en `saved` · sin límite de profundidad.

### 4.3 Chat (recientes)
Tools de música y ruido con tarjetas · `search_archivo` · historial con archivado · la conversación activa sobrevive al cambio de sección · reanuda la última si tiene <30 min · juez estricto u optimista · experimentales: tema oscuro y narración.

### 4.4 Otros desfasajes
- HORARIOS, SONIDO_FONDO y LISTAS dicen "sin implementar" y ESTÁN implementados.
- LISTAS/REPRODUCCION dicen que "Escuchar de fondo" desde el reproductor manda la cola entera: el código manda SOLO el video actual.
- `app/README.md` viejo (habla de web_search de OpenAI y moderación omni).
- INFORME_BETA dice PIN de 4; el código usa 6.

---

## 5. Archivos clave (paths completos en el repo smarty-poc)
- Router: `app/src/App.tsx` · Esquema: `app/src/db.ts` · Shell: `app/src/zones/child/ChildShell.tsx`
- Vistas del niño (`app/src/zones/child/`): MyTube.tsx, ChannelView.tsx, MisListas.tsx, VideoPlayer.tsx, MiniPlayer.tsx, BackgroundAudioHost.tsx, AfterDay.tsx, BgSoundCards.tsx, Search.tsx, Drive.tsx, FolderPicker.tsx, ChildChat.tsx
- Servicios (`app/src/lib/`): mytube.ts, youtube.ts, videoSearch.ts, listas.ts, afterday.ts, backgroundAudio.ts, ytBridge.ts, ambientNoise.ts, featureSchedule.ts, settings.ts, backup.ts, drive.ts, overrides.ts, llm.ts, pipeline.ts, moderation.ts, chatTools.ts, mediaTools.ts, musicTools.ts, articleTools.ts, archivoTools.ts, imageEngine/index.ts, imageEngine/serper.ts
- Admin (`app/src/zones/admin/`): Admin.tsx, Onboarding.tsx, pages.tsx
- Learn audio: `app/src/learn/audio/sceneDirector.ts`
- Docs: HORARIOS.md, REPRODUCCION.md, LISTAS.md, SONIDO_FONDO.md, BUSQUEDAS.md, DRIVE.md, BACKLOG.md, SPEC.md (RF-4), docs/INFORME_BETA.md (propuesta de mapeo a backend por ámbito del respaldo)

---

## 6. Trampas y detalles finos para el porte

**Dependencias entre secciones**
- TODAS las secciones del niño (MyTube y After Day incluidas) quedan detrás de la key de OpenAI.
- Hueco del asistente: si el padre prueba la key y abandona, la zona del niño queda abierta sin PIN.
- MyTube, chat, Buscar y Drive comparten catálogo y reproductor. MyTube y After Day comparten el motor de fondo (una sola cola). Learn baja o pausa ese audio.

**Supuestos de IndexedDB**
- Índices booleanos (`followed`, `isTest`) no indexan en IndexedDB.
- `ytVideos` con `++id`: se pueden duplicar (se limpian al arrancar).
- `anyOf` no respeta el orden → **bug:** las playlists dentro de un canal muestran los videos por videoId, no en el orden de la playlist; `listVideos` sí reordena bien.
- Cada video tiene un único `entryId`: **borrar un permiso borra también los videos que comparte con otro permiso.**
- `followed` vive en catálogo: se pierde si se borra el canal.
- No se revalidan videos borrados/privados (RF-4.5 sin implementar).
- Safari puede borrar IndexedDB a los 7 días.

**Inconsistencias del POC**
- `bgAudioEnabled` solo oculta el botón del reproductor y las tarjetas del chat; no afecta After Day, ni "Escuchar de fondo" de una lista, ni el mini-reproductor.
- After Day no filtra palabras bloqueadas.
- El audio de fondo no maneja el error de video no disponible: queda trabado en silencio.

**Horarios**
- Control por sección; los videos se siguen abriendo desde chat/Drive/Buscar. El audio no se corta al cerrar la franja. /crear sin guardia. Horario inválido = sección abierta. Todo en localStorage, que el niño puede editar.

**Qué es local y qué requiere keys/labs**
- 100% local: navegación MyTube y listas, MiniSearch, relacionados, fondo, ruidos, horarios, Drive.
- Solo internet: embeds de YouTube y miniaturas i.ytimg.
- Key de YouTube: ingerir playlists y canales (un video sin key queda sin canal y NO aparece en MyTube).
- OpenAI: descripción de canales. After Day: ninguna key. Commons estricto: NudeNet corriendo.

**Qué pediría un backend real en Innerith**
- Catálogo por familia: ingesta/reingesta/completar server-side con la key de YouTube como secreto; relación muchos-a-muchos permisos↔videos; descripción curada en el server, editable; playlists de canal con su orden.
- Por niño: `child_follows`, listas ordenadas y, si se quiere, historial/progreso.
- Búsqueda y relacionados en el server.
- Config del padre: musicWhitelist, horarios, `bgAudioEnabled` y topes por niño aplicados en el server; palabras bloqueadas aplicadas al servir.
- Eventos. Keys fuera del cliente y fuera del respaldo.
- Queda en el cliente: iframe de YouTube, puente postMessage, pila de overlays, sintetizador de ruido.

---

## 7. No verificado por este informe
Funcionalidad del reproductor de Innerith · código interno de route-lab y voice-server · detalle interno de Learn y el creador de rutas · comportamiento en iPad.
