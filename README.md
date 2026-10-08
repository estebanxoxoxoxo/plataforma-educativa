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
| `POST /api/chat` | Pipeline de Smarty: juez de entrada en paralelo con el principal, crisis (guion fijo), redirección por lista negra, tools (videos, imágenes, artículos), veto por ítem, palabras bloqueadas, juez de salida con pelado de medios. Fail-closed, sin streaming | `pipeline.ts`, `prompts.ts`, `chatTools.ts` |
| `GET /api/me` | Apodo del chico (de la configuración de Smarty) | — |
| `GET /api/learn/course?id=&name=` | Aprender: temario del curso (fijo para los 5 cursos; generado por un modelo para los creados con "Generar curso") y **un contenido real por capítulo**: video del catálogo aprobado (1–20 min, sin repetir) o lectura de un sitio aprobado que ya pasó extracción + juez y está en español. Cacheado en `server/data/cache/courses/` | nuevo |
| `GET /api/feed` · `POST /api/feed/react` | **FAKE (demo)**: el feed de la home (recomendaciones + noticias sociales + reacciones). El algoritmo real no existe todavía; `server/src/feedFake.ts` lo simula manteniendo las formas de respuesta — los videos y lecturas que recomienda son contenido real del catálogo/lista blanca, lo social es de demo | VISION.md §3 |
| `/api/practice/*` | **Practicar real**: ejercicios GENERADOS del contenido real de cada capítulo (lecturas extraídas y aprobadas, metadata de videos del catálogo) con regla de oro —ningún fact fuera del material, cada ejercicio guarda su cita—, revisión adversarial + validación determinística, caché por unidad en `server/data/cache/practice/`, corrección server-side (abiertas con el modelo; sin crédito cae a palabras clave) y premio real vía `progress.addXp()` | nuevo (`practice.ts`) |
| `/api/leagues/*` | **FAKE de servidor** (patrón feedFake): "Vos" con la XP semanal REAL en la liga de 12, la zona y el país; el puesto se recalcula al practicar. `/mine` trae el ciclo: `closesInDays` REAL (cuenta regresiva al domingo) y `lastWeek` (seed demo: 2º → 🥈). El cierre real (congelar tabla, repartir medallas, re-asignar) es backend futuro | `leaguesFake.ts` |
| `GET /api/progress/summary` · `GET /api/progress/tx` | **Progreso real (RAM)**: XP semanal (el puntaje ÚNICO de liga/zona/país), Energy Coin 1:1, racha y "seguí practicando". NADA de esto persiste: vive en RAM y `POST /api/demo/reset` (lo dispara el front en cada carga de página) vuelve al seed | nuevo (`progress.ts`) |
| `GET /api/market` · `POST /api/market/redeem` · `GET /api/market/redemptions` · `POST /api/market/wish` | **Tienda (RAM)**: premios publicados por el padre (seed demo), canje que gasta EC (los rechazos de negocio van con `200 + ok:false` para que el chico vea el motivo), canjes "pendientes de entrega". La **lista de deseos** sí persiste (`server/data/wishlist.json`). Los premios se leen de `parent.json` (los administra el padre); con la Tienda apagada todo `/api/market*` responde 403 | nuevo (`market.ts`) |
| `/api/parent/*` | **Zona del padre v1** (config PERSISTIDA en `server/data/parent.json`): grandes on-off de funcionalidades (Tienda/Ligas/Amigos/Chat, con 403 server-side en market y chat cuando están apagadas), premios del marketplace (publicar/editar/archivar; el seed vive acá), "Ya se lo di" para los canjes, actividad del chico (XP/⚡/racha/guardados con carpeta) y protecciones en lectura | nuevo (`parent.ts`) |
| `/api/space/*` | **Mi espacio** (real, persistido en `server/data/space.json`): Drive de carpetas anidadas (en la raíz viven SOLO carpetas, lógica Windows/nube; "General" recibe lo que no tiene destino) con papelera restaurable y "Guardar en…" (videos del catálogo, lecturas de sitios aprobados, imágenes moderadas), canales seguidos (MyTube: vistas sobre el catálogo aprobado, ~150 canales), y listas de reproducción ordenadas. Un video guardado/listado solo referencia un `videoId` aprobado: al leer se re-resuelve y se descarta lo des-aprobado o bloqueado | `drive.ts`, `mytube.ts`, `listas.ts` (lógica); el POC guardaba en IndexedDB |

Los links dentro de un artículo pasan por la misma ruta antes de abrirse. El reproductor usa YouTube nocookie contenido (sandbox, sin clics directos) con controles propios, como Smarty.

Prompts, reglas y constantes: se usa el override de la familia (del respaldo) o el valor de fábrica de Smarty, que se lee de su código con `npx tsx server/scripts/dump-smarty-defaults.ts "<ruta a smarty-poc>"` → `server/data/defaults.json`.

## Lo que sigue simulado

Reemplazá el cuerpo de cada método restante de `src/api/index.ts` por una llamada al backend que devuelva el mismo tipo de `types.ts`. Los contenedores no cambian. Queda simulado en el navegador: cursos (lista/generación) y amigos. Fakes de servidor con formas finales: feed (`feedFake.ts`) y ligas (`leaguesFake.ts`), ya alimentados por la XP real de `progress.ts`.

`api.chat` es un generador asíncrono (streaming): podés mapearlo a SSE o WebSocket emitiendo los mismos eventos (`token`, `share-checking`, `share`, `done`).

## Rutas

`/` (**Descubrir**: el feed de recomendaciones ES el descubrir de la visión, y es la home) · `/buscar?q=&tab=` · `/buscar/articulo/:id` · `/buscar/video/:id` · `/chat` (el chat seguro; redirecciones desde las rutas viejas `/descubrir*`) ·
`/espacio/carpetas[/:folderId]` · `/espacio/papelera` · `/espacio/videos` (solapas Canales | Mis listas; detalle en `/espacio/videos/canal/:id` y `/espacio/videos/lista/:id`) · `/tienda` (y `/tienda?vista=deseos`, la lista de deseos) · `/padres` (+ `/padres/{premios,actividad,protecciones}`, con portón de adulto; acceso discreto bajo el perfil) ·
`/aprender` · `/aprender/:id` · `/practicar` · `/practicar/:id` · `/practicar/:id/ejercicio/:n` · `/amigos` · `/ligas`

**Audio de fondo**: `src/shared/audio/` (port de `backgroundAudio.ts` + `ambientNoise.ts` de Smarty) — cola con repeat
off/one/all, handoff desde el player ("Escuchar de fondo" sigue desde la misma posición y manda la cola entera si venías
de una lista), duck automático cuando un video pasa a primer plano, y ruidos blanco/marrón/rosa sintetizados con Web Audio.
El control vive en la barra lateral (MiniPlayer); el iframe oculto, en el Layout. Pendiente: topes parentales de volumen
(`settings.maxVol*` de Smarty) cuando exista el panel del padre.

## Diferencias con el prototipo

- Corregidos los estilos que se pisaban: barra del reproductor (`.pbar` → `.vbar`), fila "Rango temporal" del cuadro de Wikipedia (`.sub` → `.wk-sub`), perfil lateral (`.kid` → `.profile`) y clase de imágenes (`.ph` → `.ph-img`).
- La miniatura compartida en el chat muestra la foto (en el prototipo, un SVG la tapaba).
- El temporizador muestra `1:00` en vez de `0:60`.
- Agregados: estados de respuesta incorrecta y de tiempo agotado, y mensaje de búsqueda sin resultados.
