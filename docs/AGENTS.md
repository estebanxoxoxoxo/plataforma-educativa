# Briefing para agentes que implementan en Innerith

Leé esto ENTERO antes de tocar código. Después: `README.md` (arquitectura y swap-points) y
`docs/VISION.md` (qué es el producto y qué existe dónde). No arranques sin leer los tres.

## Qué es esto
Plataforma educativa para chicos (homeschooling conservador de EE.UU.; UI en español rioplatense,
voseo, tono amable para un chico de ~9 años). UI React 19 + TS + Vite en `src/`, backend Node sin
framework en `server/` (puerto 8787, proxy `/api` de Vite). El usuario demo es Ian (9).

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
   **Layout de página**: el ancho y la alineación los da `.view` (tokens `--content-w`/`--view-px`
   en base.css) — NINGUNA sección pone su propio max-width/margin:auto de página. Excepciones más
   angostas SIEMPRE centradas en el mismo eje (video 760, lector 900, ejercicio 780). Una vista con
   `padding:0` alinea sus barras con `var(--view-pad-x)`. Listas de filas en grid: `minmax(0,1fr)`.
6. Drive: en la RAÍZ viven solo carpetas (lógica Windows/nube); los archivos siempre adentro de
   una carpeta; "General" es el destino por defecto. Carpetas todas con el MISMO ícono
   (`IcFolderWin`). Papelera restaurable: nada se borra de verdad sin "borrar definitivo".
7. Ligas: se ASIGNAN por resultados (nunca se eligen/buscan), 12 participantes, y el puntaje
   semanal es UNO solo (mismo número en liga, zona y país). El ciclo semanal (closesInDays real +
   lastWeek/medalla) tiene UNA sola fuente: server/src/leaguesFake.ts — no lo dupliques.
8. Menú actual: Descubrir (= el FEED, es la home en `/`) · Buscar (`/buscar/*`) · Chat (`/chat`) ·
   Mi espacio (`/espacio/carpetas`, `/espacio/videos` con solapas Canales|Mis listas) · Tienda
   (`/tienda`) · Aprender · Practicar · Amigos · Ligas. "Descubrir" es el feed de recomendaciones
   (así lo define la visión), NO el chat. Si cambiás rutas, dejá redirecciones de las viejas.
9. **La economía del demo vive en RAM** (pedido de Esteban): XP/Energy Coin/canjes NO se persisten
   a disco; cada carga de página hace POST /api/demo/reset (ver src/hooks/user.tsx) y todo vuelve a
   los valores iniciales (seed). Si tu módulo guarda estado económico, exponé un reset() y
   registralo en ese endpoint. SÍ persisten los activos/preferencias del chico (space.json, wishlist.json) y la CONFIG del padre (parent.json: on-off de funcionalidades y premios de la Tienda).
10. **Watcher de Vite/tsx en Windows**: a veces pierde la segunda de dos ediciones seguidas del
   mismo archivo y sirve un módulo viejo. Si el navegador no refleja tu cambio, verificá el módulo
   servido y hacé un `touch` del archivo para forzar la recarga.

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
  errores de consola y terminar con `console.log('ERR', errs)`). El dev ya corre: web 5173, api 8787
  (tsx watch recarga solo; si 8787 no responde, el watch crasheó: mirá el error de compilación).
- Mirá al menos una captura con tus propios ojos antes de dar por buena la estética.

## Qué actualizar al terminar una feature
- `README.md` (tabla de backend/rutas si cambió) y `docs/VISION.md` (tabla visión↔código).
- NO commitear ni pushear salvo que el pedido lo diga explícitamente. Attribution de commits:
  terminar el mensaje con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Estado demo
`server/data/space.json` es estado real del demo (carpetas Dinos/General, 16 canales seguidos,
lista "Música para estudiar"). No lo borres ni lo llenes de basura de prueba: si creás datos para
probar, limpialos al final (papelera → borrar definitivo, unfollow, etc.).
