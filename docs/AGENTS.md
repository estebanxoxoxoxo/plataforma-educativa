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
   Ojo en COMENTARIOS de CSS: un `*/` adentro del texto (p.ej. escribir `src/**/*.css`) CIERRA el
   comentario y el navegador descarta EN SILENCIO la regla que sigue (pasó de verdad con tokens de color).
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
8. Menú actual (EN ESTE ORDEN, 12-oct-2026 tarde, SIN submenús): Feed (= el feed de
   recomendaciones, la home en `/`; antes se llamó Home y Descubrir) · Buscar (`/buscar/*`) ·
   Chat (`/chat`) · MyTube (`/mytube`; las rutas viejas `/espacio/videos*` redirigen acá) · Aprender (su encabezado lleva el botón "Crear" → `/crear`, que marca Aprender
   como sección activa; con W3 se vuelve Learn: aprender+practicar colapsados) · Tienda (`/tienda`) · Calendario (`/calendario`) · Mi espacio AL FONDO (`/espacio/carpetas` directo).
   LIGAS TAMPOCO ES PUNTO DE MENÚ (12-oct): la posición vive SIEMPRE en la BARRA SUPERIOR estilo
   GT7 (src/shared/components/TopBar.tsx: liga → link a /ligas · ⚡ Energy Coins · fecha/hora
   compacta · campana de notificaciones con las solicitudes y los no-leídos del dock; respeta los
   apagados del padre). AMIGOS YA NO ES SECCIÓN (12-oct): los amigos siguen existiendo — viven en el dock de Mensajes,
   se BUSCAN por nombre de usuario en Buscar y las solicitudes llegan como notificación destacada
   en la zona PINNEADA de arriba del Feed (tanda F2). `/practicar*` sigue vivo (entra el feed por
   «Seguí practicando»); `/repasar*` no existe (redirige a /aprender). "Feed" es el feed, NO el
   chat. Si cambiás rutas, dejá redirecciones de las viejas.
9. **La economía del demo vive en RAM** (pedido de Esteban): XP/Energy Coin/canjes NO se persisten
   a disco; cada carga de página hace POST /api/demo/reset (ver src/hooks/user.tsx) y todo vuelve a
   los valores iniciales (seed). Si tu módulo guarda estado económico, exponé un reset() y
   registralo en ese endpoint. SÍ persisten los activos/preferencias del chico (space.json,
   wishlist.json, identity.json: el avatar) y la CONFIG del padre (parent.json v2: on-off de
   funcionalidades, premios de la Tienda, temas blancos/negros, palabras de la familia, topes de
   volumen y preset aplicado; teachers.json: profes contratados — las clases NO se guardan, se
   derivan al leer y la serie corre sola). Los AVISOS al padre
   (crisis/contacto/bloqueos) viven en RAM y hoy NO se registran en el reset del demo.
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
  errores de consola y terminar con `console.log('ERR', errs)`). El dev ya corre: web 5173, api 8787
  (tsx watch recarga solo; si 8787 no responde, el watch crasheó: mirá el error de compilación).
- Los puertos 5173/8787 son del dev de INNERITH: no levantes dev servers de otros proyectos
  (smarty-poc, etc.) ni ocupes esos puertos — ya pasó que un Vite ajeno tomó el 5173 y todos vieron
  otra app. Si necesitás un entorno propio, usá puertos efímeros y apagalo al terminar.
- Mirá al menos una captura con tus propios ojos antes de dar por buena la estética.

## Qué actualizar al terminar una feature
- `README.md` (tabla de backend/rutas si cambió) y `docs/VISION.md` (tabla visión↔código).
- NO commitear ni pushear salvo que el pedido lo diga explícitamente. Attribution de commits:
  terminar el mensaje con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Estado demo
`server/data/space.json` es estado real del demo (carpetas Dinos/General, 16 canales seguidos,
lista "Música para estudiar"). No lo borres ni lo llenes de basura de prueba: si creás datos para
probar, limpialos al final (papelera → borrar definitivo, unfollow, etc.).
