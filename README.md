# Innerith UI

UI de Innerith (React + TypeScript + Vite), portada 1:1 del prototipo `../index.html`.

```bash
npm install
SMARTY_PIN=xxxxxx npm run import:smarty -- "<ruta al smarty-all-*.json>"   # una vez: claves + listas de Smarty
npm run dev        # levanta el backend (puerto 8787) y la web (Vite) juntos
```

`import:smarty` descifra el respaldo de Smarty con el PIN del padre y escribe `server/.env` (claves de API) y `server/data/config.json` (sitios aprobados, temas, reglas de dominio, palabras bloqueadas, prompts editados). Las dos rutas están en `.gitignore`.

Abrí con `?stage` (por ejemplo `http://localhost:5173/?stage`) para verla en el lienzo de 1280×720 escalado, igual que el prototipo, y comparar.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/api/types.ts` | Contratos de datos (lo que el backend tiene que devolver) |
| `src/api/index.ts` | Cliente de API: páginas y artículos van al backend real; el resto sigue **simulado** (latencia y estado en memoria). Cada llamada se loguea en la consola (`[api] → GET …`) |
| `src/api/mock.ts` | Datos de prueba (los del prototipo + relleno) |
| `src/sections/<sección>/` | Una carpeta por punto del menú: `home`, `discover`, `learn`, `practice`, `friends`, `leagues` |
| `…/containers/` | Pantallas y paneles que piden datos a `api` y arman la vista |
| `…/cards/` | Ítems de listas y grillas (resultado, curso, amigo, liga, opción de respuesta…) |
| `…/components/` | Piezas visuales puras (reciben props; no llaman a la API) |
| `…/lib/` | Helpers sin UI de la sección (layout del camino, formato, etc.) |
| `…/<sección>.css` | Estilos de la sección |
| `src/shared/` | Lo común a todas: barra lateral, íconos, avatar, solapas, esqueleto |
| `src/styles/` | CSS global (base y layout) |

Una sección puede usar piezas de otra: Practicar reutiliza la grilla y la tarjeta de curso de `learn`.

Todas las vistas comparten UNA columna central (1040px máx, centrada), definida por `.view` en
`styles/shell.css` con los tokens `--content-w`/`--view-px`; las secciones no definen ancho de página.

## Backend (`server/`)

Node + TypeScript, reutiliza la lógica de la POC de Smarty. Las claves viven solo en el servidor.

| Ruta | Qué hace | Origen en Smarty |
|---|---|---|
| `GET /api/search/pages?q=` | Serper restringido a la lista blanca con `site:` (grupos de 12 en paralelo), re-rank léxico, filtro de dominios y palabras bloqueadas, top 6 | `articleTools.ts`, `serper.ts`, `domainFilter.ts` |
| `GET /api/article?url=` | Gate de sitio → extracción (Wikipedia REST o Jina → Readability → DOMPurify) → juez `gpt-5.4-mini` con la lista negra → cache (7 días, por `policyVersion`). Responde `ok`, `blocked` o `error` (fail-closed) | `reader.ts`, `extract.ts`, `articleAccess.ts`, `prompts.ts` |
| `GET /api/search/images?q=` | Un modelo traduce el pedido a términos visuales en inglés → Pixabay + Commons → filtro de palabras no aptas en títulos/categorías/tags → re-rank por título → moderación visual de Commons con la Moderation API de OpenAI (reemplaza a NudeNet). Lo descartado se devuelve como "Filtrado" | `imageTools.ts`, `imageSearch.ts` |
| `GET /api/search/videos?q=` | Solo el catálogo aprobado (≈95.000 videos importados): MiniSearch con los pesos de Smarty, AND, sin prefijo, fuzzy 0.2 | `videoSearch.ts` |
| `GET /api/video?id=` | Video aprobado + datos reales de YouTube (fecha, Me gusta, suscriptores, foto del canal) vía Data API | nuevo |
| `POST /api/chat` | Pipeline de Smarty: juez de entrada en paralelo con el principal, crisis (guion fijo + aviso al padre con el texto del chico), redirección por lista negra, tools (videos, imágenes, artículos), veto por ítem, palabras bloqueadas, juez de salida con pelado de medios. Temas y palabras de la familia (Zona de padres) sumados a los de fábrica. Fail-closed, sin streaming | `pipeline.ts`, `prompts.ts`, `chatTools.ts` |
| `GET /api/me` | Apodo del chico (de la configuración de Smarty) | — |
| `GET /api/identity` · `POST /api/identity` | **Identidad / avatar (PERSISTIDA** en `server/data/identity.json`; es un activo del chico, NO entra en `/api/demo/reset`): `{ nick, look }` con `look` = uno de los 16 personajes dibujados del cliente (`src/shared/components/Avatar.tsx`: SVG propio, sin assets externos) en un color de la paleta de 8, o `null` = iniciales. Sin archivo, Ian arranca con un look dibujado derivado de su nick. El POST valida contra el set (400 si no es del set) y escribe atómico (tmp+rename). Lo elige el chico desde su tarjeta de perfil (barra lateral → "Tu avatar"). Los DEMÁS usuarios no pasan por acá: su look se deriva en el cliente con un hash estable del nick (`lookFor`: ~80% personaje, ~20% iniciales; mismo nick = mismo look en amigos, chat, ligas y feed) | nuevo (`identity.ts`) |
| `GET /api/learn/course?id=&name=` | Aprender: temario del curso (fijo para los 5 cursos; generado por un modelo para los creados con "Generar curso") y **un contenido real por capítulo**: video del catálogo aprobado (1–20 min, sin repetir) o lectura de un sitio aprobado que ya pasó extracción + juez y está en español. Cacheado en `server/data/cache/courses/` | nuevo |
| `GET /api/feed` · `POST /api/feed/react` | **FAKE (demo)**: el feed de la home (recomendaciones + noticias sociales + reacciones). El algoritmo real no existe todavía; `server/src/feedFake.ts` lo simula manteniendo las formas de respuesta — los videos y lecturas que recomienda son contenido real del catálogo/lista blanca, lo social es de demo. Aplica EN SERIO la config del padre: saca lo que pega con un tema negro o trae una palabra de la familia, y prioriza sus temas blancos ("Porque a tu familia le interesa: …", 1 de cada 3 videos) | VISION.md §3 |
| `/api/practice/*` | **Practicar real**: ejercicios GENERADOS del contenido real de cada capítulo (lecturas extraídas y aprobadas, metadata de videos del catálogo) con regla de oro —ningún fact fuera del material, cada ejercicio guarda su cita—, revisión adversarial + validación determinística, caché por unidad en `server/data/cache/practice/`, corrección server-side (abiertas con el modelo; sin crédito cae a palabras clave) y premio real vía `progress.addXp()` | nuevo (`practice.ts`) |
| `GET /api/recall/summary` · `POST /api/recall/session` · `POST /api/recall/answer` · `POST /api/recall/finish` | **Repasar (RAM)** — Active Recall es el nombre interno, nunca en la UI (visión, audio 17): **ledger por fact** con fuerza 0-100 (< 40 floja · 40-79 mejorando · ≥ 80 firme; acierto +25, error −20). Seed demo = 24 ejercicios REALES copiados de la caché de Practicar (5 cursos, con su cita textual) + **ingesta en vivo**: `practice.ts` llama `recordResult()` con cada respuesta corregida (upsert por curso + clave del ejercicio). La sesión del día es UNA (10 cartas, lo más flojo primero, cursos intercalados, máx. 4 por curso; si ya existe se retoma con las cartas que faltan); `{extra:true}` con la de hoy hecha arma otra con lo que sigue. Corrige con el `grade()` de Practicar (abiertas: modelo → palabras clave), devuelve la cita y cómo quedó la fuerza; **+5 XP reales** la primera vez que se acierta una carta de la sesión del día (las extra no suman). Terminar la de hoy suma racha de repaso. `POST /api/demo/reset` vuelve al seed | nuevo (`recall.ts`) |
| `/api/leagues/*` | **FAKE de servidor** (patrón feedFake): "Vos" con la XP semanal REAL en la liga de 12, la zona y el país; el puesto se recalcula al practicar. `/mine` trae el ciclo: `closesInDays` REAL (cuenta regresiva al domingo) y `lastWeek` (seed demo: 2º → 🥈). El cierre real (congelar tabla, repartir medallas, re-asignar) es backend futuro. Con Ligas apagadas por el padre: 403 | `leaguesFake.ts` |
| `GET /api/progress/summary` · `GET /api/progress/tx` | **Progreso real (RAM)**: XP semanal (el puntaje ÚNICO de liga/zona/país), Energy Coin 1:1, racha y "seguí practicando". NADA de esto persiste: vive en RAM y `POST /api/demo/reset` (lo dispara el front en cada carga de página) vuelve al seed | nuevo (`progress.ts`) |
| `GET /api/market` · `POST /api/market/redeem` · `GET /api/market/redemptions` · `POST /api/market/wish` | **Tienda (RAM)**: premios publicados por el padre (seed demo), canje que gasta EC (los rechazos de negocio van con `200 + ok:false` para que el chico vea el motivo), canjes "pendientes de entrega". La **lista de deseos** sí persiste (`server/data/wishlist.json`). Los premios se leen de `parent.json` (los administra el padre); con la Tienda apagada todo `/api/market*` responde 403 | nuevo (`market.ts`) |
| `/api/parent/*` | **Zona del padre v2 — la configuración VIVA** (config PERSISTIDA en `server/data/parent.json`; un archivo de la v1 migra solo). **Sesión de API**: `POST /api/parent/unlock {pin}` → `{ok, token}` (token en RAM, 15 min deslizantes; `POST /api/parent/lock` lo cierra); TODAS las rutas piden `X-Parent-Token` (401 → la UI vuelve al portón) menos `GET features` y `GET limits`, públicas porque las lee la UI del chico. Grandes on-off (Tienda/Ligas/Amigos/Chat, con 403 server-side en market, chat, amigos y ligas), premios del marketplace, "Ya se lo di", actividad y protecciones. v2: `GET config` · `POST topics {white?,black?}` (temas blancos = sugerencias que el feed prioriza 1 de cada 3 y el chat propone; negros = los jueces los suman a la lista negra, el feed saca lo que pega y el nombre se corta como frase) · `POST words {extra}` (se SUMAN a las de fábrica en `matchBlockedWord`: búsquedas, títulos, chat, mensajes, feed) · `POST volume` + `GET limits` (topes de la música/ruidos de fondo: el MiniPlayer no pasa del tope y lo que suena baja en vivo) · `GET presets` + `POST presets/apply` (Primeros pasos 3-6 / Clásico conservador / Explorador completo: on-off + temas + palabras + topes de una vez; editar a mano → `preset: null`) · `GET alerts` + `POST alerts/seen` (avisos en RAM: crisis con el texto del chico (decisión 11-oct), intentos de contacto y "insistió" al 3.er mensaje frenado) | nuevo (`parent.ts`; config de Smarty: `settings.maxVol*`, `topics`, `blockedWords`, eventos `crisis`/`sondeo`) |
| `GET /api/teachers` · `POST /api/teachers/hire` · `POST /api/teachers/cancel` · `GET /api/calendar` | **FAKE de Profesores + Calendario del chico** (visión, audios 30 y 67; pedido de Esteban 11-oct): catálogo demo de 8 profes particulares (materia, USD por hora, rating, bio de una línea, emoji de la materia sobre un color de la paleta; sin fotos ni assets externos). El padre contrata en `/padres/profesores` con un horario SEMANAL (`{weekday 0=lunes…6, hour}` en punto, de 9 a 19); los rechazos de negocio van con `200 + ok:false` y el motivo (profe ya contratado, hora que el chico ya tiene con otro profe, horario fuera de rango). Las clases NO se guardan: se DERIVAN al leer desde la contratación (la serie corre sola: siempre 4 por profe, de 60 min, la primera puede estar en curso), en hora local sumando días (a prueba del cambio de horario). `GET /api/calendar` = las clases del chico SIN precios, por inicio. Contrataciones PERSISTIDAS en `server/data/teachers.json` (config del padre: no entra en `/api/demo/reset`; escritura atómica; seed de la primera vez: Matemática con Caro, miércoles 17:00, para que el calendario nazca vivo). Endpoints públicos como el resto de los fakes (deuda: pasarlos a la sesión del padre) | nuevo (`teachersFake.ts`) |
| `/api/friends*` | **FAKE de NPCs agénticos** (visión, audios 24 y 58): 6 amigos + solicitudes (NicoRobot), hilos con respuestas REALES del modelo (persona por NPC, contexto en cuarentena, juez de salida, tope de 20 respuestas por carga) y **moderación real de ida** (palabras bloqueadas —de fábrica y de la familia— → filtro de contacto → juez de mensajes con la lista negra de fábrica + la de la familia; si no corresponde, el mensaje NUNCA llega y el Moderador explica cómo decirlo mejor). Crisis, intentos de contacto y bloqueos repetidos → aviso al padre. 403 con Amigos apagado; el grafo social vive en RAM y resetea por carga | nuevo (`friendsFake.ts`) |
| `/api/space/*` | **Mi espacio** (real, persistido en `server/data/space.json`): Drive de carpetas anidadas (en la raíz viven SOLO carpetas, lógica Windows/nube; "General" recibe lo que no tiene destino) con papelera restaurable y "Guardar en…" (videos del catálogo, lecturas de sitios aprobados, imágenes moderadas), canales seguidos (MyTube: vistas sobre el catálogo aprobado, ~150 canales), y listas de reproducción ordenadas. Un video guardado/listado solo referencia un `videoId` aprobado: al leer se re-resuelve y se descarta lo des-aprobado o bloqueado | `drive.ts`, `mytube.ts`, `listas.ts` (lógica); el POC guardaba en IndexedDB |

Los links dentro de un artículo pasan por la misma ruta antes de abrirse. El reproductor usa YouTube nocookie contenido (sandbox, sin clics directos) con controles propios, como Smarty.

Prompts, reglas y constantes: se usa el override de la familia (del respaldo) o el valor de fábrica de Smarty, que se lee de su código con `npx tsx server/scripts/dump-smarty-defaults.ts "<ruta a smarty-poc>"` → `server/data/defaults.json`.

## Lo que sigue simulado

Reemplazá el cuerpo de cada método restante de `src/api/index.ts` por una llamada al backend que devuelva el mismo tipo de `types.ts`. Los contenedores no cambian. Queda simulado en el navegador: cursos (lista/generación). Fakes de servidor con formas finales: feed (`feedFake.ts`) y ligas (`leaguesFake.ts`), ya alimentados por la XP real de `progress.ts`.

`api.chat` es un generador asíncrono (streaming): podés mapearlo a SSE o WebSocket emitiendo los mismos eventos (`token`, `share-checking`, `share`, `done`).

## Rutas

`/` (**Descubrir**: el feed de recomendaciones ES el descubrir de la visión, y es la home) · `/buscar?q=&tab=` · `/buscar/articulo/:id` · `/buscar/video/:id` · `/chat` (el chat seguro; redirecciones desde las rutas viejas `/descubrir*`) ·
`/espacio/carpetas[/:folderId]` · `/espacio/papelera` · `/espacio/videos` (solapas Canales | Mis listas; detalle en `/espacio/videos/canal/:id` y `/espacio/videos/lista/:id`) · `/tienda` (y `/tienda?vista=deseos`, la lista de deseos) · `/padres` (presets + funcionalidades; + `/padres/{temas,limites,avisos,premios,profesores,actividad,protecciones}`, con portón de adulto y sesión de API; acceso discreto bajo el perfil; `/padres/profesores` = el marketplace de profes) ·
`/aprender` · `/aprender/:id` · `/practicar` · `/practicar/:id` · `/practicar/:id/ejercicio/:n` · `/repasar` (la sesión de hoy + fuerza por curso) · `/repasar/sesion` (el mazo; `?extra=1` = sesión extra, sin ⚡) · `/amigos` · `/ligas` (solapas Mi liga | Tu zona | País, con `?tab=zona|pais`) · `/calendario` (las clases del chico con los profes que contrató el padre: próxima clase, la semana de lunes a domingo y las que siguen; sin precios)

**Audio de fondo**: `src/shared/audio/` (port de `backgroundAudio.ts` + `ambientNoise.ts` de Smarty) — cola con repeat
off/one/all, handoff desde el player ("Escuchar de fondo" sigue desde la misma posición y manda la cola entera si venías
de una lista), duck automático cuando un video pasa a primer plano, y ruidos blanco/marrón/rosa sintetizados con Web Audio.
El control vive en la barra lateral (MiniPlayer); el iframe oculto, en el Layout. **Topes parentales de volumen** (port de
`settings.maxVol*` de Smarty): el padre los fija en Zona de padres → Límites; son techos (volumen efectivo = min(lo que eligió el
chico, tope)), los sliders del MiniPlayer no pasan del tope ("máx. 40") y lo que suena baja en el acto
(`sections/parent/lib/limits.ts` sobre el público `GET /api/parent/limits`, misma pestaña / otras pestañas / al volver el foco).

**Mensajes (dock estilo LinkedIn)**: `sections/friends/containers/ChatDock.tsx` también vive en el Layout, así que está en
TODA la app y sobrevive al cambio de sección. Abajo a la derecha, la barra «Mensajes» (minimizada por defecto; desplegada,
la lista de conversaciones con los amigos aceptados) y, a su izquierda, una ventana por conversación —cada apertura nueva
entra pegada a la barra y la fila crece hacia la izquierda—, cada una con su barra, minimizar y cerrar (Esc minimiza). Adentro,
el hilo de siempre: "escribiendo…", respuestas reales del NPC y la moderación de ida (`/api/friends/send`: lo bloqueado nunca
entra al hilo, el Moderador explica y el texto queda en el campo). El globo de `/amigos` abre la conversación acá (reabrir no
duplica: enfoca/restaura). Estado en RAM (`sections/friends/lib/chatDock.ts`, `useSyncExternalStore`): recargar = dock
cerrado. Cada ventana sondea `api.newMessages` mientras exista, abierta o minimizada (lo que llega minimizada suma a su badge);
sin ventana no hay sondeo. Si no entran: se minimizan las expandidas más viejas, las barras se encogen con elipsis y, si ni
así, las minimizadas más viejas se ocultan con un «+N» (nunca hay scroll lateral). Con Amigos apagado no existe; en
`/padres/*` no se muestra. z 55: sobre el contenido y bajo las hojas modales (las de una vista lo apartan con `:has`).

## Diferencias con el prototipo

- Corregidos los estilos que se pisaban: barra del reproductor (`.pbar` → `.vbar`), fila "Rango temporal" del cuadro de Wikipedia (`.sub` → `.wk-sub`), perfil lateral (`.kid` → `.profile`) y clase de imágenes (`.ph` → `.ph-img`).
- La miniatura compartida en el chat muestra la foto (en el prototipo, un SVG la tapaba).
- El temporizador muestra `1:00` en vez de `0:60`.
- Agregados: estados de respuesta incorrecta y de tiempo agotado, y mensaje de búsqueda sin resultados.
