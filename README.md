# Innerith UI

UI de Innerith (React + TypeScript + Vite), portada 1:1 del prototipo `../index.html`.

```bash
npm install
npm run dev
```

Abrí con `?stage` (por ejemplo `http://localhost:5173/?stage`) para verla en el lienzo de 1280×720 escalado, igual que el prototipo, y comparar.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/api/types.ts` | Contratos de datos (lo que el backend tiene que devolver) |
| `src/api/index.ts` | **API fake**: latencia simulada, estado en memoria y log de cada llamada en la consola (`[api] → GET …`) |
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

## Conectar el backend

Reemplazá el cuerpo de cada método de `src/api/index.ts` por un `fetch` que devuelva el mismo tipo de `types.ts`. Los contenedores no cambian.
`api.chat` es un generador asíncrono (streaming): podés mapearlo a SSE o WebSocket emitiendo los mismos eventos (`token`, `share-checking`, `share`, `done`).

## Rutas

`/` · `/descubrir/busqueda?q=&tab=` · `/descubrir/articulo/:id` · `/descubrir/video/:id` · `/descubrir/chat` ·
`/aprender` · `/aprender/:id` · `/practicar` · `/practicar/:id` · `/practicar/:id/ejercicio/:n` · `/amigos` · `/ligas` · `/ligas/:id`

## Diferencias con el prototipo

- Corregidos los estilos que se pisaban: barra del reproductor (`.pbar` → `.vbar`), fila "Rango temporal" del cuadro de Wikipedia (`.sub` → `.wk-sub`), perfil lateral (`.kid` → `.profile`) y clase de imágenes (`.ph` → `.ph-img`).
- La miniatura compartida en el chat muestra la foto (en el prototipo, un SVG la tapaba).
- El temporizador muestra `1:00` en vez de `0:60`.
- Agregados: estados de respuesta incorrecta y de tiempo agotado, y mensaje de búsqueda sin resultados.
