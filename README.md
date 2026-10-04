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

Los links dentro de un artículo pasan por la misma ruta antes de abrirse. El reproductor usa YouTube nocookie contenido (sandbox, sin clics directos) con controles propios, como Smarty.

Prompts, reglas y constantes: se usa el override de la familia (del respaldo) o el valor de fábrica de Smarty, que se lee de su código con `npx tsx server/scripts/dump-smarty-defaults.ts "<ruta a smarty-poc>"` → `server/data/defaults.json`.

## Lo que sigue simulado

Reemplazá el cuerpo de cada método restante de `src/api/index.ts` por una llamada al backend que devuelva el mismo tipo de `types.ts`. Los contenedores no cambian.

`api.chat` es un generador asíncrono (streaming): podés mapearlo a SSE o WebSocket emitiendo los mismos eventos (`token`, `share-checking`, `share`, `done`).

## Rutas

`/` · `/descubrir/busqueda?q=&tab=` · `/descubrir/articulo/:id` · `/descubrir/video/:id` · `/descubrir/chat` ·
`/aprender` · `/aprender/:id` · `/practicar` · `/practicar/:id` · `/practicar/:id/ejercicio/:n` · `/amigos` · `/ligas` · `/ligas/:id`

## Diferencias con el prototipo

- Corregidos los estilos que se pisaban: barra del reproductor (`.pbar` → `.vbar`), fila "Rango temporal" del cuadro de Wikipedia (`.sub` → `.wk-sub`), perfil lateral (`.kid` → `.profile`) y clase de imágenes (`.ph` → `.ph-img`).
- La miniatura compartida en el chat muestra la foto (en el prototipo, un SVG la tapaba).
- El temporizador muestra `1:00` en vez de `0:60`.
- Agregados: estados de respuesta incorrecta y de tiempo agotado, y mensaje de búsqueda sin resultados.
