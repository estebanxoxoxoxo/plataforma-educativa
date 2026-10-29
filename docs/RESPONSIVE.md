# Innerith en teléfono y tablet — auditoría y propuesta

> Deuda: **"Innerith no tiene diseño de teléfono"**. Spec del auditor, 28-oct-2026. NO se tocó el repo ni se commiteó nada.
> Todo lo que sigue se midió en el dev vivo (`localhost:5173`) con Chrome headless. Las capturas viven en
> `shots/` y las métricas en `metrics/`, al lado de este archivo
> (`/private/tmp/claude-501/-Users-esteban-andres-altamura-kit-digital-Desktop-plataforma-educativa/7a572f1b-a01c-423c-9e13-1bc82caa4a0e/scratchpad/responsive-spec/`).
> Cuando el dueño lo apruebe, este documento puede pasar a `docs/RESPONSIVE.md`. Lo mueve Claude, no un agente de tanda.

## 0. En una línea

La app tiene **una sola disposición**: barra lateral fija de 240 px + columna con 40 px de aire por lado. No hay ninguna
media query del *shell*. A 375 px quedan **55 px de columna útil** (70 a 390, 110 a 430). Además el `overflow:hidden` del
`.app` **recorta sin scroll** la barra superior: en el teléfono el switch de usuario y la campana quedan fuera de alcance.
A 768 px la app ya funciona (448 px de columna) con dos desbordes puntuales (Premios y la fila de acciones del video).
**La buena noticia, medida con un prototipo inyectado (§2.8): arreglado solo el shell, 55 de 61 casos a 375 quedan sin
desbordes.** Lo grueso del trabajo es el shell y el dock, no las secciones.

---

## Método (cómo se midió, para poder repetirlo)

- **Navegador**: `playwright-core@1.48.2` local (`node_modules/` de esta carpeta), `channel:'chrome'`, headless.
  Scripts:
  - `capture.mjs`: captura + métricas.
  - `check.mjs`: verificación C1–C7, §4.8.
  - `proto.mjs` + `proto-shell.css`: prototipo inyectado, §2.8.
  - `sheet.mjs`: hojas de contacto en `sheets/`.
  - `probe-*.mjs`: mediciones puntuales de la hoja de avatar, el encabezado de Familia, la TopBar y la causa de Premios.
- **Solo lectura**: `context.route` aborta todo método distinto de GET, salvo `POST /api/demo/reset` (lo hace cada carga
  de página). Lo único que se bloqueó en toda la corrida fueron POSTs del iframe de YouTube (`/youtubei/v1/*`), que no
  tocan nuestro server. Los popovers y el dock se abren con `element.click()` y abrirlos no escribe nada.
- **Usuarios**: `andres` (adulto: Familia y Mentores) e `ian` (chico: dock de Mensajes, campana y ciclo del día), elegidos con
  `localStorage['innerith.user']`.
- **Viewports**: 375×812 y 768×1024 en todas las vistas. 390×844 y 430×932 como muestreo. 1280×800 como **línea de base
  "antes"**, para verificar que no haya regresión en escritorio (`shots/*-1280-*.png`, `metrics/run2-andres1280.json`).
- **Métricas por vista**: rectángulos de `.side`, `.main` y `.view`; ancho del *content box* (`contentW`); desborde lateral de
  la vista (`viewHOver = scrollWidth − clientWidth`); desborde y piezas recortadas de la TopBar; rectángulos del dock; los 6
  peores "ofensores" (elementos que pasan el borde derecho de la columna, con cuántos px); y los targets táctiles de menos
  de 44 px.
- **Reuso del intento anterior**: de sus 122 capturas quedaron **103 válidas**. Se descartaron 19 y se rehicieron
  (están en `shots/_descartadas/` como rastro). Motivos:
  - Ian a 375: Buscar, Páginas, Aprender, camino, After Day, Tienda y Calendario salieron como "sección descansando" (el ciclo
    del día del otro QA).
  - Lector a 375 y 768: se capturó mientras seguía "Moderando…".
  - Solapas de Ligas a 375: las 4 eran el mismo archivo, porque el contenido de la solapa quedaba abajo del pliegue.
  - "Luna": la URL mezclaba `member=luna&m=ian` y mostraba a Ian.

  Se sumaron versiones scrolleadas a las tablas y paneles de Familia (`*-fam-*-tabla`, `*-cont`), la hoja "Tu avatar", el
  muestreo 390/430 y la base de 1280.

### Estado del server durante la auditoría (otro QA corriendo en paralelo; anotado, no se tocó)

| Hora (CET) | Qué se vio | Efecto en las capturas |
|---|---|---|
| ~15:39 | Ciclo de Ian con rangos que cerraban casi todo y menú de Ian cambiante (unas capturas sin Buscar/Aprender/Mi espacio, otras con el selector en "Rango 2 · 20:00–23:00") | 7 capturas de Ian a 375 inválidas (descartadas) |
| 20:15 | `GET /api/schedules` (ian): `ranges: []`, todo abierto | se rehicieron las de Ian a 375 |
| 20:26 | `ranges`: Mañana 06–12 (buscar, aprender, espacio) y Tarde 14–20 (chat, mytube, tienda, calendario, afterday). A esa hora solo queda el Feed | `ian-430-mytube` y casi toda la base `ian-1280-*` salieron "cerradas". La base de escritorio vale con Andrés |
| ~20:20 | After Day de la familia vacío (`/api/afterday` → `tracks: []`); a las 15:40 tenía 2 pistas | `ian-375-afterday` muestra el estado vacío (sirve igual como evidencia de layout) |
| 21:18 | Ciclo de Ian otra vez sin rangos (`ranges: []`) | el SKIP de `ian-375-ligas-familia` del prototipo se re-corrió: PASS |

---

## 1. Auditoría con evidencia

### 1.1 Causa raíz (lo que rompe TODAS las vistas a la vez)

| # | Qué | Dónde | Evidencia medida |
|---|---|---|---|
| R1 | La grilla del shell es fija: `grid-template-columns:240px 1fr`, sin ninguna media/container query | `src/styles/shell.css:2` | `.side` 240 px a cualquier ancho. `.main`: 135 px a 375, 150 a 390, 190 a 430, 528 a 768 |
| R2 | El aire lateral de `.view` es `max(40px,…)` por lado (token `--view-px`), pensado para escritorio | `base.css:9`, `shell.css:206` | columna útil (`contentW`): **55 px** a 375, **70** a 390, **110** a 430, 448 a 768, 960 a 1280 |
| R3 | `.app{overflow:hidden}`: lo que no entra **no scrollea, se corta** | `shell.css:2` | TopBar: 470–497 px de chips en 135 px. Quedan recortados y sin alcance `⚡`, reloj, **switch de usuario** y **campana** (375/390/430) |
| R4 | `.view` tiene `overflow-y:auto`, y eso deja el eje x en `auto`: lo que desborda **scrollea de costado adentro de la vista** | `shell.css:206` | `viewHOver` a 375: 104 (Feed), 219 (Buscar), 177 (Mi espacio), 137 (Ligas), **505 (Familia → Premios)** |
| R5 | El dock asume la barra de 240: `.fdk{left:256px}` + barra «Mensajes» de 280 px fija | `friends.css:68`, `lib/chatDock.ts` (`DOCK.bar`) | a 375 la caja `.fdk` mide 103 px y la barra se sale hacia la izquierda **tapando el menú** (x=79). La ventana de chat abierta queda en **x=−191 (fuera de pantalla)**; a 430, en x=−136 |
| R6 | `height:100vh` en `.app` | `shell.css:2` (también `.fdk-win`, `.fdk-list.open`, `.ln-vid-frame`) | en iOS Safari 100vh es el viewport "grande": la barra del navegador tapa el pie de la app (perfil, mini-reproductor y, a futuro, una barra inferior). No se puede medir en Chrome headless: es riesgo conocido |
| R7 | Las media queries que existen son de sección. La mayoría (`max-width` 480/560/620/760/820/900/980/1100) se escribieron para ventanas de escritorio angostas, contando con la barra de 240. Solo afterday, learn y learn-engine son mobile-first (`min-width` 640/1024) | 19 `@media` en 11 archivos (fuera del shell) | ninguna salva el teléfono, porque el problema es el shell |

**Lo que YA funciona en el teléfono (verificado, no hay que tocarlo):**
- **Overlays de Learn**: portal `position:fixed; inset:0` sobre `<body>`, con z ≥ 100. A 375 miden **375×812 exactos** y tapan
  el menú, la TopBar y el dock (`ian-375-overlay`, `andres-375-overlay`). El motor de Learn ya es mobile-first (`@media (min-width:640px)`).
- **Visor de After Day** (`.adw`, fixed, z 120) y las **hojas `.shov`** (`min(440px,94vw)`). La hoja "Tu avatar" vive dentro
  de `.side` pero igual cubre todo el viewport: tarjeta de 353 px a 375 (`andres-375-pop-avatar`).
- El **panel del mini-reproductor** (286 px) se abre sobre el menú y entra (`*-375-pop-player`).

### 1.2 Vista por vista (captura + una línea por viewport)

Las capturas son de viewport (lo que ve el usuario sin scrollear). Las rutas son relativas a `shots/`. "+N" es cuánto pasa
el borde derecho de la columna el peor elemento.
**La TopBar es igual en todas las vistas:** a 375 solo se ve la liga; ⚡, reloj, usuario y campana quedan cortados (R3). Esa
falla no se repite en cada fila.

| Vista (ruta) | Capturas 375 / 768 | 375 px | 768 px |
|---|---|---|---|
| **Feed** (`/`) | `andres-375-feed`, `ian-375-feed` / `andres-768-feed`, `ian-768-feed` | columna de 55 px: saludo y tarjetas a 1–2 palabras por renglón; CTA del destacado (`.hf-cta` +109) y Aceptar/Ahora no de la solicitud (`.fpin-acts` +128) desbordan → la vista scrollea de costado | OK |
| **Buscar · Videos** (`/buscar?q=volcanes&tab=videos`) | `andres-375-buscar`, `ian-375-buscar` / `*-768-buscar` | caja de búsqueda cortada; solapas (`.tab`, gap 26) +219; resultados de 1 palabra por renglón con miniatura de ~30 px | OK |
| **Buscar · Páginas** (`/buscar?q=volcanes`) | `andres-375-buscar-pages`, `ian-375-buscar-pages` / `*-768-buscar-pages` | mismo patrón; el aviso "solo fuentes verificadas" ocupa 8 renglones | OK |
| **Buscar · Mentores** (adulto) | `andres-375-buscar-mentores` / `andres-768-buscar-mentores` | ficha del mentor ilegible (descripción a 1 palabra por renglón); solapas +220 | OK (precio + Contratar entran) |
| **Lector** (`/buscar/articulo/…Apolo_11`) | `andres-375-lector`, `ian-375-lector` / `andres-768-lector`, `ian-768-lector` | la vista sin padding da 135 px; la ficha con la imagen (`.mcard`) desborda **+305** y tapa el texto; la barra Resultados/Guardar queda cortada | OK (528 px, ficha flotando a la derecha) |
| **Reproductor** (`/buscar/video/:id`) | `andres-375-video`, `ian-375-video` / `*-768-video` | reproductor de ~55 px de ancho; título a 1 palabra por renglón; acciones (`.yt-actions`) hasta **+470** | player OK; la fila de acciones desborda **+37** |
| **Chat** (`/chat`) | `andres-375-chat`, `ian-375-chat` / `*-768-chat` | encabezado a 1 palabra por renglón; del campo de pregunta solo se ve el botón enviar | OK |
| **MyTube** (`/mytube`) | `andres-375-mytube`, `ian-375-mytube` / `*-768-mytube` | tarjetas de canal (`.mt-chcard`) +77; solapas Canales/Mis listas cortadas | OK (2 columnas) |
| **MyTube · canal** | `andres-375-canal`, `ian-375-canal` / `*-768-canal` | cabecera del canal (nombre, @handle, Seguir) +116–121; los videos quedan solo como miniatura | OK |
| **Aprender** (`/aprender`) | `andres-375-aprender`, `ian-375-aprender` / `*-768-aprender` | botón Crear y tarjetas de ruta (`.ln-card`) +65–105; Active Recall queda como una barra azul vertical | OK |
| **Aprender · camino** | `andres-375-camino`, `ian-375-camino` / `*-768-camino` | vista con padding propio (135 px): los nodos entran, las etiquetas se cortan (+20–24) | OK |
| **Aprender · overlay** | `andres-375-overlay`, `ian-375-overlay` / `*-768-overlay` | **OK**: pantalla completa (375×812), arriba de todo | OK |
| **Crear ruta** (`/crear`) | `andres-375-crear`, `ian-375-crear` / `*-768-crear` | formulario a 55 px: portada (`.cr-cover-box`) y "Generar módulo" +92–94; la ayuda ocupa ~25 renglones | OK |
| **After Day** (`/afterday`) | `andres-375-afterday`, `ian-375-afterday` (vacío, ver estado) / `*-768-afterday` | texto a 1–2 palabras por renglón; la grilla ya es de 1 columna (su media query es mobile-first) | OK (3 columnas) |
| **Tienda** (`/tienda`) | `andres-375-tienda`, `ian-375-tienda` / `*-768-tienda` | billetera (`.st-bal`) +59 (adulto) / **+141** (Ian); premios ilegibles | OK |
| **Calendario** (`/calendario`) | `andres-375-calendario`, `ian-375-calendario` / `*-768-calendario` | tarjeta "Próxima clase" (`.cal-hero`) **+184** (Ian); estado vacío +32 (adulto) | OK |
| **Mi espacio** (`/espacio/carpetas`) | `andres-375-espacio`, `ian-375-espacio` / `*-768-espacio` | acciones del encabezado (Papelera / Carpeta nueva, `.sphead-acts`) **+177**; descripción a 1 palabra por renglón | OK |
| **Ligas · Mi liga** (`/ligas`) | `andres-375-ligas`, `ian-375-ligas` / `*-768-ligas` | solapas (`.ltab`, gap 26, sin scroll propio) +137–177; filas sin nombre (solo puesto y avatar) y XP partido en 2 renglones | OK |
| **Ligas · Tu zona** | `*-375-ligas-zona` / `*-768-ligas-zona` | idem | OK |
| **Ligas · País** | `*-375-ligas-pais` / `*-768-ligas-pais` | idem; los puntajes de 5 cifras se parten ("9.488 / XP") | OK |
| **Ligas · Familia** | `*-375-ligas-familia` / `*-768-ligas-familia` | idem; llevar la solapa activa a la vista corre todo de costado y solo se ven los XP | OK |
| **Familia: encabezado común** (11 solapas) | cualquier `andres-375-fam-*` | título, selector de integrante y **11 solapas apiladas en columna** (la container query `pz-head` < 1240 las envuelve; ocupan y=285–727): **el primer panel arranca en y=747 de 812** | las solapas envuelven en 3 filas (146–273); el panel arranca en y=293: OK |
| Familia · **Funcionalidades** (`/familia?m=ian`) | `andres-375-fam-funcionalidades`, `-cont` / `andres-768-fam-funcionalidades` | presets ilegibles; switches (`.pz-feat-ctl`) +139 | OK |
| Familia · **Temas y palabras** | `andres-375-fam-temas` / `andres-768-fam-temas` | listas blanca/negra +56; los campos de "Agregar" no se pueden usar | OK |
| Familia · **MyTube** | `andres-375-fam-mytube` / `andres-768-fam-mytube` | encabezado de panel +94; el textarea de URLs queda ilegible | OK |
| Familia · **MyTube · canal** | `andres-375-fam-canal` / `andres-768-fam-canal` | cabecera del canal +116 | OK |
| Familia · **After Day** | `andres-375-fam-afterday` / `andres-768-fam-afterday` | +94 | OK |
| Familia · **Límites** | `andres-375-fam-limites` / `andres-768-fam-limites` | sliders de volumen y bloque de zona horaria **+150** | OK |
| Familia · **Ciclo del día** | `andres-375-fam-ciclo`, `-cont` / `andres-768-fam-ciclo` | editor de rangos (desde/hasta + secciones) +77–117 | OK |
| Familia · **Avisos** | `andres-375-fam-avisos` / `andres-768-fam-avisos` | +51 (cabecera) | OK |
| Familia · **Premios** | `andres-375-fam-premios`, `-tabla` / `andres-768-fam-premios`, `-tabla` | la VISTA entera scrollea **505 px** de costado. **No es grid blowout** (verificado: `.pz-table-wrap` mide lo que la columna, tiene `overflow-x:auto` y sus grids ya tienen `min-width:0`). La causa es **`.pz-sr`** (el texto para lectores de pantalla "Acciones"/"Energy Coins", `position:absolute`): como el wrap es `static`, se escapa del scroller y queda en x=880. Con `.pz-table-wrap{position:relative}` el desborde baja a 71 (el resto es la columna de 55 px) | **misma causa: la vista scrollea 112 px**. Con `position:relative` en el wrap: **0** (medido) |
| Familia · **Mentorías** | `andres-375-fam-mentorias` / `andres-768-fam-mentorias` | "Buscar mentores" / "Cancelar" +89 | OK |
| Familia · **Actividad** | `andres-375-fam-actividad`, `-tabla` / `andres-768-fam-actividad`, `-tabla` | la tabla de guardados (`min-width:600px`) queda recortada dentro de su wrap, que sí scrollea; la vista desborda 53 px por la cabecera | la tabla scrollea adentro de su wrap sin mover la vista: OK |
| Familia · **Protecciones** | `andres-375-fam-protecciones` / `andres-768-fam-protecciones` | +51 | OK |
| Familia · **otro integrante** (`?m=luna`) | `andres-375-fam-luna` / `andres-768-fam-luna` | igual que Funcionalidades | OK |
| **Popover de usuario** (switch de demo) | `andres-375-pop-user`, `ian-375-pop-user` / `*-768-pop-user` | el chip está fuera de la TopBar recortada: **inalcanzable al tacto**. Abierto por script, el popover sale cortado arriba a la derecha | OK |
| **Campana** (Ian) | `ian-375-pop-bell` / `ian-768-pop-bell` | **inalcanzable** (recortada); el popover queda cortado (se ven Aceptar / Ahora no) | OK |
| **Sonido de fondo** (mini-reproductor) | `*-375-pop-player` / `*-768-pop-player` | el panel de 286 px se abre sobre el menú: usable | OK |
| **Hoja "Tu avatar"** | `andres-375-pop-avatar` / (a 1280: `andres-1280-pop-avatar`) | OK (fixed a pantalla completa, tarjeta de 353 px) | OK (por CSS; medida a 1280) |
| **Dock · lista** (Ian) | `ian-375-dock-list` / `ian-768-dock-list` | la barra de 280 px se sale de su caja de 103 px y **tapa el menú** (x=79–359) | OK |
| **Dock · ventana** (Ian) | `ian-375-dock-win`, `ian-430-dock-win` / `ian-768-dock-win` | la ventana de chat queda **fuera de pantalla** (x=−191 a 375, −136 a 430); solo asoman sus botones ⌄ × | OK (lista 280 + ventana 260 entran en 496) |

**Muestreo 390 / 430** (`andres-390-*`, `andres-430-*`, `ian-430-*`): el patrón es el mismo, con columna de 70 y 110 px.
Buscar desborda 204/164 y Ligas 122/82. La TopBar sigue recortando ⚡, reloj, usuario y campana. Un teléfono "grande" no se salva.

### 1.3 Hallazgos transversales (no son del shell, pero las tandas tienen que cerrarlos)

- **Solapas sin scroll propio**: `.tabs` (Buscar, gap 26), `.ltabs` (Ligas) y `.mt-tab` (MyTube) desbordan. Las de Familia sí
  tienen fila scrolleable (`.pz-tabs{overflow-x:auto}`), pero la container query las pasa a "envolver" debajo de 1240 px. En
  el teléfono conviene la fila scrolleable.
- **Texto *visually-hidden* que se escapa de un scroller**: `.pz-sr` (`position:absolute`) dentro de `.pz-table-wrap` (`overflow-x:auto` pero `position:static`) toma como referencia un ancestro de afuera y estira la vista: es todo el desborde de Premios a 768. **Regla para todas las tandas**: un scroller horizontal que contiene algo `position:absolute` lleva `position:relative`. Incluye las etiquetas ocultas del rail de T0 (`.nav-item{position:relative}`).
- **Hover-only**: `.it:hover .gsave` (Guardar en los resultados de Buscar) y `.ln-band:hover .ln-band-see` solo aparecen con
  el mouse. Con el tacto no se ven: falta `@media (hover:none)`.
- **Targets táctiles**: con el shell nuevo (prototipo a 375, `metrics/check-proto-andres375-c4.txt`) quedan pocos de
  menos de 24 px: `.hf-why` del Feed (74×22), la × de limpiar Buscar (22×22), los links `.back` (19 de alto), botones del
  reproductor (22×22) y los 3 sliders de ruidos del mini-reproductor (148×16). Los "checkbox de 13×13" de Familia que
  marcaban las métricas viejas son **falsos positivos**: radios ocultos (`opacity:0; pointer-events:none`) del selector de
  integrante, cuyo target es la etiqueta. Objetivo: ≥ 24 px en todo (WCAG 2.5.8) y ≥ 44 px en la navegación principal.
- **`100vh`** en `.app`, `.fdk-win`, `.fdk-list.open` y `.ln-vid-frame` → pasar a `100dvh`, con `100vh` como fallback.
- **Viewport meta**: `width=device-width, initial-scale=1`, sin `viewport-fit=cover`. Sin eso no hay `env(safe-area-inset-*)`
  para una barra inferior en iPhone.

---

## 2. Arquitectura responsive propuesta (sin framework nuevo, sin dependencias nuevas)

### 2.1 Tres modos del shell y dónde se deciden

| Modo | Ancho del contenedor `app` | Navegación | `--side-w` | `--view-px` | Barra inferior |
|---|---|---|---|---|---|
| **Escritorio** | ≥ 1024 px | barra lateral de hoy (240 px), **sin un solo cambio** | 240px | 40px | no |
| **Tablet** | 640–1023 px | **rail de íconos** de 80 px (la misma `.side` con las etiquetas ocultas visualmente) | 80px | 24px | no |
| **Teléfono** | < 640 px | **barra inferior** de 5 + **cajón** con el menú completo (la misma `.side`, deslizable) | 0px | 16px | 64px + safe-area |

- **Se decide con container queries, no con media queries**: `#root, .stage{container: app / inline-size}` y las reglas del
  shell van en `@container app (max-width:639.98px)` y `@container app (max-width:1023.98px)`. Motivo: el modo `?stage`
  monta la app en un escenario de 1280 px escalado (`main.tsx`). Con `@media`, una ventana angosta en modo stage pasaría a
  tablet o teléfono. Es el mismo criterio que ya usa la densidad del menú (`@container side`, `shell.css:7-9`). Verificado en
  Chrome: un contenedor `size` (`.side`) NO atrapa a sus descendientes `position:fixed` (la hoja "Tu avatar" cubre el
  viewport entero), así que `#root` como contenedor no rompe hojas ni dock. **Antes de mergear T0 hay que verificarlo en Safari**.
- **Escritorio queda intacto**: todas las reglas nuevas viven DENTRO de rangos < 1024. A 1280 la geometría tiene que
  coincidir con la base medida (`metrics/run2-andres1280.json`: `.side` 240×800, TopBar 46, `contentW` 960).
- Breakpoints: **solo dos números, 640 y 1024**, documentados en `base.css` junto a los tokens. Las secciones nuevas
  responden con `@container app (…)` y esos mismos dos cortes. Las `@media` sueltas que ya existen (560/620/760/820/900/980/1100)
  las revisa cada tanda en sus propios archivos. No se suman cortes nuevos.

### 2.2 Barra lateral → rail (tablet) / barra inferior + cajón (teléfono)

**Una sola propuesta: barra inferior de 5 en el teléfono, con un 5º botón «Menú» que abre la barra lateral completa como
cajón, y rail de íconos en la tablet.**

Razones:
1. **El usuario principal del teléfono es un chico de ~9 años.** Con la barra inferior, las secciones centrales están siempre a la vista y a un toque, en la zona del pulgar.
   Una hamburguesa sola esconde la navegación: la tasa de descubrimiento baja y cada cambio de sección cuesta 2 toques.
2. **Coincide con la estética ya elegida** (la barra lateral es "estética Duolingo"; Duolingo en el teléfono es barra inferior).
3. **El cajón hace falta igual**: el menú tiene 9–10 puntos más el selector «Ciclo (demo)», «Sonido de fondo» y el perfil
   (avatar). No entra todo en una barra. El cajón ES la `.side` de hoy, sin reestilar: mismo componente, misma densidad por
   altura (`@container side`) y mismos candados. La barra inferior es un agregado chico encima del cajón.
4. **La TopBar conserva su identidad GT7**: no tiene que hacer lugar para una ☰ y sus chips funcionales siguen entrando a 360 px (§2.3).

Detalle:
- **Cajón (teléfono)**: `.side` pasa a `position:fixed; inset:0 auto 0 0; width:min(300px,86vw); z-index:90`, desplazada
  con `translate:-100% 0` + `visibility:hidden` cuando está cerrado. Abierto: **`translate:none`**. No puede quedar ningún
  transform activo ni `will-change`, porque la hoja "Tu avatar" vivía dentro de `.side` y un transform la confinaría al cajón.
  (Así quedó en `shell.css`: cerrado con `left` negativo + `visibility:hidden`, sin transform ni `will-change`. Y desde
  SHELL-FIX las dos hojas del perfil ya NO viven en `.side`: `ProfileCard.tsx` las monta en `.app` con un portal, porque en
  WebKit el `container-type` de `.side` las confinaba aunque no hubiera transform; ver §2.6.)
  Velo `<button class="nav-scrim" aria-label="Cerrar menú">` (z 85). Se cierra al navegar (efecto sobre `pathname`), con
  Esc o tocando el velo. Mientras está abierto, `inert` en `.main` y foco al primer ítem; al cerrar, el foco vuelve a «Menú».
- **Barra inferior (teléfono)**: componente nuevo `src/shared/components/BottomNav.tsx`, prefijo CSS `bnav-` (grepeado:
  libre). Es la 2ª fila de la grilla de `.app` (**en el flujo, no `fixed`**: la vista termina arriba de la barra y no se
  tapan), con alto `64px + env(safe-area-inset-bottom)`. Lleva 4 secciones + «☰ Menú»: íconos de 26 px con etiqueta de
  10,5 px en mayúsculas (Baloo) y la misma píldora activa por sección (`--sec-bg/--sec-bd/--sec-fg`): los selectores
  `.nav-item[data-sec=…]` pasan a `:is(.nav-item,.bnav-item)[data-sec=…]`. Si la sección activa no está entre las 4,
  «Menú» se marca como activo.
- **Cuáles 4**: lista de preferencia en una constante, `BAR = ['home','search','mytube','learn']` (Feed · Buscar · MyTube ·
  Aprender: las 4 de consumo y aprendizaje; Chat, After Day, Tienda, Calendario y Mi espacio quedan en el cajón). Respeta el
  orden relativo del menú (regla 8). Si un candado o el ciclo apagan alguna, se completa con la siguiente visible en el
  orden del menú. Para el adulto, ver la decisión D2.
- **Una sola fuente para el menú**: `Sidebar.tsx` exporta `useNavItems(user)` con la lista ya filtrada por
  `featureAllows` / `cycleAllows` / `adultOnly`. Sidebar y BottomNav renderizan desde ahí, así los candados no se duplican.
- **Rail (tablet)**: solo CSS sobre la misma `.side`:
  - `width:80px`.
  - Etiquetas `.nav-item span` **ocultas visualmente** (patrón *visually-hidden*, NO `display:none`, que borra el nombre
    accesible) + `title` y `aria-label` con la etiqueta en el botón (1 línea en `Sidebar.tsx`).
  - Marca sin texto (`.brand{font-size:0}`).
  - `.mp-toggle` y `.profile` solo con el ícono o el avatar.
  - `.cyd-sel` compacto de 56 px con un ícono de reloj como fondo y `color:transparent`: el selector nativo sigue
    funcionando al tocarlo.
  - El panel del mini-reproductor (286 px, z 60) se abre hacia la derecha, encima del contenido.

### 2.3 TopBar compacta (teléfono)

| Pieza | Hoy a 375 | Propuesta < 640 |
|---|---|---|
| Liga (`.tb-league`) | única visible | queda (`4º/12`; el «/12» sale debajo de 400 px); `min-width:0` con elipsis como válvula |
| ⚡ Energy Coins | recortada | queda |
| Reloj + fecha | recortado | queda **solo `hh:mm`** (`.tb-date` oculta; la hora es la de la familia y rige el ciclo) |
| Switch de usuario | **recortado, inalcanzable** | queda **solo el avatar** (`.tb-uname` y `.tb-uswap` ocultos; el `aria-label` ya existe) |
| Campana (chico) | **recortada, inalcanzable** | queda |

- Presupuesto **medido** (anchos reales de hoy, Ian): liga sin nombre ≈ 89, ⚡ 88, `hh:mm` 47, chip de usuario solo con
  avatar ≈ 38, campana 34, más padding 12+12 y 5 huecos de 8. Total **≈ 360 px**: entra a 375, pero a 360 (el Android más
  angosto común) queda en cero. Por eso, debajo de 400 px: huecos de 6 px y sin el «/12» de la liga (`.tb-dim`). Baja a
  **≈ 325 px**. Además, el grupo derecho (usuario + campana) va `flex:none` y la liga es la que se achica primero
  (`min-width:0`). Lo funcional nunca se recorta.
- Popovers (`.tb-pop`, `.tb-upop`) en el teléfono: `position:fixed; top:calc(46px + 8px); left:8px; right:8px; width:auto;
  max-height:70dvh`. Hoy cuelgan de `right:0` del chip y se salen.
- **Sin cambios de TSX**: todo es CSS sobre clases que ya existen. Lo verifica T0.

### 2.4 `.view` y anchos especiales

- **Tokens**: no cambia `.view` en sí. En los modos tablet y teléfono, `--view-px` vale 24 y 16 px, sobrescrito en `.app`
  dentro de la container query; `.view` y todos sus hijos lo heredan, incluido `--view-pad-x`. A 375: columna de
  **343 px** (hoy 55). A 768: **640 px** (hoy 448).
- `padding-top` de `.view` en el teléfono: 32 → 20 px. `padding-bottom:76px` queda: alcanza para el botón redondo del dock (56 + 12).
- **Anchos especiales** (regla 5: video 760, lector 900, feed 780, ejercicio 780): **no se tocan**. Son `max-width` centrados
  y en el teléfono quedan al 100% de la columna. Lo que falla adentro (la ficha `.mcard` del lector, `.yt-actions`) es de
  sección (T2).
- **La regla 5 sigue igual**: ninguna sección pone max-width o margin de página. Se agrega una regla gemela: **ninguna sección
  agrega `@media` de layout nuevas**. Usa `@container app` con los cortes 640/1024. **No se pone `container-type` en `.view`**:
  no hace falta y sería un contenedor más para razonar.
- Recetas para las tandas de sección (todas CSS):
  - **solapas** → fila con `overflow-x:auto; scrollbar-width:none; flex-wrap:nowrap`, con la activa llevada a la vista;
  - **grids de filas** → `minmax(0,1fr)`, y a todo hijo de grid/flex que contenga una tabla o una fila scrolleable,
    `min-width:0` (regla 5);
  - **scrollers con algo `position:absolute` adentro** (texto para lectores de pantalla, indicadores) → `position:relative`
    en el scroller (es la causa real del desborde de Premios: §1.3);
  - **cabeceras con acciones** (`.sphead-acts`, `.st-bal`, `.cal-hero`, `.mt-chcard`, `.hf-cta`) → `flex-wrap:wrap` y
    botones a ancho completo;
  - **hover-only** → `@media (hover:none){…{opacity:1}}`;
  - **targets** ≥ 24 px en todo y ≥ 44 px en la navegación;
  - **`100vh` → `100dvh`**, con fallback.

### 2.5 El dock de Mensajes en el teléfono (chico)

- Base, en todos los modos: `.fdk{left:calc(var(--side-w) + 16px); bottom:var(--bnav-h)}`. Hoy es `left:256px` fijo. Con eso,
  la tablet ya queda bien con el rail.
- **Teléfono**:
  - La barra «Mensajes» cerrada pasa a **botón redondo de 56 px** abajo a la derecha, apoyado sobre la barra inferior
    (avatar + insignia; se ocultan nombre y chevron).
  - **La lista abierta** y **la conversación abierta** pasan a **pantalla completa** (`position:fixed; inset:0`). Ojo con
    las capas: son hijas de `.fdk` (z 55, un contexto de apilamiento propio) y un z-index en ellas no las saca de ahí. El
    que sube es el `.fdk` entero, a z 95, mientras haya algo abierto
    (`.fdk:has(.fdk-list.open, .fdk-win:not(.min):not([hidden]))`, solo en el teléfono). Así quedan arriba de la barra
    inferior, la TopBar y el cajón, y debajo de los overlays de Learn.
  - **Las ventanas minimizadas no se dibujan** en el teléfono. Sus no leídos ya llegan a la campana (`TopBar` lista
    `dock.wins` con `unread>0`) y conviene que el botón redondo muestre el total (prop chica en `ChatListBar`).
- **El store no cambia**: `fitDock` mide el ancho (`setDockWidth`). Con un ancho de teléfono, `rowWidth(1 expandida)` =
  328 + 280 + 10 = 618 > 375, así que ya hoy minimiza todas menos la última abierta. El comportamiento "una conversación a la vez"
  sale solo del algoritmo existente. Solo cambia la presentación (CSS) y, quizás, la insignia.
- **Riesgo del teclado en iOS**: un `fixed` a pantalla completa con el campo abajo puede quedar tapado por el teclado. Se
  mitiga con `height:100dvh` + un hook chico sobre `visualViewport` que ajuste `--vvh`, solo si la prueba en un iPhone real
  lo pide. Agregar `interactive-widget=resizes-content` al meta de viewport resuelve Chrome Android, no iOS.

### 2.6 Overlays, hojas y capas (z-index)

- **Overlays de Learn: verificados a pantalla completa** a 375 y 768 (`.ln-ov` 375×812 y 768×1024; portal en `<body>`, z ≥ 100,
  arriba del dock). No se tocan, salvo `.ln-vid-frame`: `100vh` → `100dvh`.
- **Visor de After Day** (`.adw`, fixed inset 0, z 120): por CSS es pantalla completa. No se pudo abrir en vivo porque After
  Day estaba vacío (estado del otro QA); T3 lo verifica.
- **Hojas `.shov`** (z 80, `min(440px,94vw)`, `max-height:84vh` → `84dvh`): funcionan (hoja de avatar medida a 375).
- **Las dos hojas del perfil** ("Tu avatar" y "Tus medallas"; así quedó tras SHELL-FIX) no viven en `.side` ni en la vista:
  `ProfileCard.tsx` las monta con `createPortal` en `.app` (el `.app` más cercano a la tarjeta; `<body>` solo si no lo
  encuentra). En `.app` y NO en `<body>` (los overlays de Learn sí van a `<body>`): así siguen dentro del contenedor `app`
  —valen las `@container app` de `space.css` y `medals.css` para el teléfono— y, con `?stage`, dentro del escenario escalado.
  Con el cajón abierto (teléfono), `shell.css` las sube a z 91 (`.app.is-nav-open > .shov`): arriba del cajón y de su velo.
- **Escalera de capas propuesta**: los valores existentes, más los nuevos (barra inferior, velo, cajón y `.fdk` elevado). Son
  z del nivel raíz: `.app` no es contexto de apilamiento, y las `.shov` que viven dentro de `.view` quedan al nivel de la
  vista (0). Por eso existe la regla que oculta el dock cuando hay una hoja abierta. Así quedó en `shell.css` (tanda T0 +
  SHELL-FIX), con dos cambios sobre la propuesta: la barra inferior va SIN z y se suma la fila de las hojas del perfil con el
  cajón abierto (91).

  | Capa | z |
  |---|---|
  | contenido | 0 |
  | barra inferior | sin z (propuesta: 50): va en el flujo, 2ª fila de la grilla, debajo de todo lo posicionado |
  | dock cerrado | 55 |
  | mini-reproductor | 60 |
  | toast y popovers de la TopBar | 70 |
  | `.shov` | 80 |
  | velo del cajón | 85 |
  | cajón | 90 |
  | hojas del perfil (portal en `.app`) con el cajón abierto | 91 |
  | `.fdk` con lista o conversación abierta (teléfono, vía `:has`) | 95 |
  | overlays de Learn | 100+ |
  | `.ln-pend` y `.adw` | 120 |

- `.st-toast{bottom:24px}` → `bottom:calc(var(--bnav-h) + 16px)` (T4).

### 2.7 Tokens nuevos (solo los imprescindibles)

| Token | Dónde se define | Valores (escritorio / tablet / teléfono) | Quién lo usa |
|---|---|---|---|
| `--side-w` | `.app` (+ container queries) | 240px / 80px / 0px | columnas de `.app`, `left` del dock |
| `--bnav-h` | `.app` (+ container query de teléfono) | 0 / 0 / `calc(64px + env(safe-area-inset-bottom))` | `bottom` del dock, toast de la Tienda |
| `--view-px` (existe) | `:root` 40px; sobrescrito en `.app` | 40px / 24px / 16px | `.view` (ya lo usa) |

Más: `index.html` → `viewport-fit=cover` (sin eso `env(safe-area-inset-*)` vale 0 en iPhone) y `.app{height:100vh;
height:100dvh}`. No hace falta ningún token de breakpoint en JS: la barra inferior se oculta por CSS ≥ 640, la clase
`is-nav-open` no hace nada fuera del teléfono y el dock se adapta midiendo su ancho, como hoy.

### 2.8 Validación: prototipo del shell inyectado (sin tocar el repo)

Para no proponer a ciegas, se inyectó en la página del navegador headless un `<style>` con ~25 líneas que imitan lo
esencial de T0: contenedor `app` en `#root`, columna única y `--view-px:16px` en el teléfono, cajón cerrado, TopBar
compacta, y rail de 80 px en la tablet. Es `proto-shell.css` en esta carpeta, aplicado con `proto.mjs` o
`check.mjs --inject`. **No es la implementación** (no hay barra inferior ni dock), pero mide el efecto de la grilla:

| Caso | `.side` | Columna | Scroll lateral de la vista | TopBar (borde derecho) |
|---|---|---|---|---|
| Andrés 375 · Feed / Buscar / Familia | cajón oculto | **343** (hoy 55) | **0 / 0 / 0** (hoy 104 / 219 / 75) | 363 ≤ 375: entera |
| Ian 375 · Feed (con campana) | cajón oculto | 343 | 0 | 363: entera |
| Ian 360 · Feed | cajón oculto | 328 | 0 | 348 ≤ 360: entera |
| Andrés 768 · Feed / Premios (rail) | 80 | **640** (hoy 448) | 0 / 0 | 754: entera |
| Andrés 1280 · Feed / Premios | 240 | 960 (= base) | 0 / 0 | igual que hoy |

Capturas en `shots/proto/` (hoja: `sheets/proto.png`). A 375 el Feed, los resultados de Buscar y Familia se leen bien: las
11 solapas envuelven en 4 filas y el panel arranca arriba. **Conclusión: la mayor parte de lo "roto" por vista era la
columna de 55 px; arreglado el shell, a las tandas de sección les queda pulido** (ver §5).

**Medición completa con el prototipo** (`check.mjs --inject proto-shell.css --only C1,C2,C3`, 375×812;
`metrics/check-proto-andres375.txt` y `check-proto-ian375.txt`):

| | Casos | PASS | Fallas reales que quedan | No medidos |
|---|---|---|---|---|
| Andrés (todas las vistas, incluida Familia) | 36 | **33** | Familia · Premios (241 px: el `.pz-sr`, §1.3) | `pop-player` (el panel vive en el cajón cerrado: esperable), `fam-mytube` (timeout del server) |
| Ian (shell, T2, T3, T4) | 25 | **22** | reproductor (`.yt-actions` +182); dock · ventana (x=−191, es T1) | `pop-player` (ídem). `ligas-familia` salió SKIP por el estado de la demo; re-corrida a las 21:18: PASS |

Total: **55 de 61 PASS**. Fallas reales: 3 (reproductor, Premios, dock). Las otras 3 no se pudieron medir.

---

## 3. Qué NO se toca

- **Funcionalidad**: ninguna pantalla gana ni pierde funciones. Todo lo que hoy se puede hacer se sigue pudiendo hacer en el
  teléfono, incluido lo de demo: «Ciclo (demo)», «Simular…», el switch de usuario. Solo cambia dónde está y cómo se acomoda.
- **Server** (`server/**`), **contratos** (`src/api/types.ts`, `src/api/index.ts`), endpoints, el reset de la demo y lo que
  persiste.
- **Reglas de negocio de la UI**: `featureAllows`, `cycleAllows`, `adultOnly`, los candados del chico y el store del dock
  (`fitDock`, ventanas, no leídos). La barra inferior **lee** esas reglas, no las reimplementa.
- **Orden y contenido del menú** (regla 8): la barra inferior es un subconjunto en el mismo orden relativo y el cajón es el menú completo.
- **Escritorio ≥ 1024 px**: ni un píxel. Todo lo nuevo vive dentro de container queries < 1024.
- **Estética**: colores, tipografías, la píldora con borde por sección y la TopBar GT7.
- **Learn por dentro**: overlays, motor (`src/learn/**`) y `innerith-ui/route-lab/` (copia literal del POC: no se edita). Solo `100vh`→`100dvh` en `.ln-vid-frame`.
- **Sin framework ni dependencias nuevas**: nada de Tailwind ni de librerías de UI o de media queries en JS. CSS propio con
  los prefijos de cada sección (regla 5) y un componente nuevo (`BottomNav.tsx`).

---

## 4. Plan de tandas

Cuando un brief dice `RESPONSIVE.md` o `check.mjs`, son los archivos de
`/private/tmp/claude-501/-Users-esteban-andres-altamura-kit-digital-Desktop-plataforma-educativa/7a572f1b-a01c-423c-9e13-1bc82caa4a0e/scratchpad/responsive-spec/`
(o `docs/RESPONSIVE.md`, si Claude ya lo movió). Las capturas `shots/…` y las métricas `metrics/…` están en esa misma carpeta.

Orden: **T0 primero y solo** (define tokens, grilla y navegación). Después **T1, T2, T3, T4 y T5 en paralelo**: tocan
archivos disjuntos. Cierra **T6**. Si una tanda de sección necesita tocar un archivo de T0 (`base.css`, `shell.css`,
`avatar.css`, `Sidebar.tsx`, `BottomNav.tsx`, `ProfileCard.tsx`, `App.tsx`, `main.tsx`, `index.html`), **frena y lo reporta**: no lo edita.

### Verificación común (la usan todas las tandas)

Script listo, de **solo lectura**, en esta carpeta: `check.mjs` (ver §4.8). Corre las vistas de un grupo con los dos usuarios
en **375×812, 390×844, 430×932, 768×1024, 1024×768 y 1280×800** y falla si:
- **C1**: hay scroll lateral del documento o de `.view` (`scrollWidth − clientWidth > 1`);
- **C2**: algún elemento visible de la vista pasa el borde derecho de la columna, salvo que viva dentro de un scroller
  horizontal (fila de solapas, wrap de tabla);
- **C3**: alguna pieza de la TopBar, la lista del dock o una ventana del dock queda fuera del viewport;
- **C4**: en el teléfono hay un target interactivo visible de menos de 24×24;
- **C5**: a **1280** la geometría (`.side`, TopBar, `contentW`, `padX`) o la lista de ofensores difiere de la base
  `metrics/run2-andres1280.json` / `run2-ian1280.json`;
- **C6**: hay errores de consola o `pageerror` (sin contar los del iframe de YouTube, cuyos POST se bloquean);
- **C7**: el shell no está en el modo que le toca a ese ancho (teléfono: barra inferior de 5, `.side` oculta, columna ≥
  vw−32; tablet: `.side` de 80, o de 240 si D3 = sin rail; escritorio: 240).

Además de eso, cada tanda: `npx tsc -b --force`, `npx tsc -p tsconfig.server.json --noEmit` y `npm run build` limpios.
Capturas propias a 375 y a 1280 de cada vista tocada, **miradas con sus propios ojos** junto a las de `shots/` (antes).
Reporte honesto de lo que no cerró.

### 4.1 T0 — Shell: modos, rail, cajón, barra inferior, TopBar compacta

**Brief (autocontenido):**
> Sos el agente de la tanda T0 de la deuda "Innerith no tiene diseño de teléfono" (repo `plataforma-educativa`). Leé
> ENTEROS `docs/AGENTS.md` (regla 5, regla 8, verificación) y `RESPONSIVE.md` §1.1, §2 y §3 (ruta al principio de §4).
> **Objetivo**: que el shell tenga tres modos (escritorio ≥1024 sin cambios, tablet 640–1023 con rail de 80 px, teléfono
> <640 con barra inferior + cajón) decididos con `@container app`.
> **Archivos tuyos (exclusivos)**: `src/styles/base.css`, `src/styles/shell.css`, `src/shared/components/avatar.css`,
> `src/shared/components/Sidebar.tsx`, `src/shared/components/BottomNav.tsx` (nuevo), `src/App.tsx` (solo `Layout`),
> `index.html` (meta viewport), `src/main.tsx` (solo si hace falta el contenedor en `.stage`) y
> `src/shared/components/ProfileCard.tsx` (solo si la hoja "Tu avatar" necesita un `createPortal` a `body`; ver §5 R-shell).
> **Hacer**:
> 1. `#root, .stage{container:app / inline-size}`. Tokens `--side-w` y `--bnav-h` en `.app`, y `--view-px` 24/16 en tablet y teléfono (§2.7).
> 2. `.app{height:100vh;height:100dvh; grid-template-columns:var(--side-w) minmax(0,1fr)}`. En el teléfono, 1 columna y
>    2 filas (`minmax(0,1fr) auto`) con la barra inferior en la 2ª fila (en el flujo).
> 3. `useNavItems(user)` exportado de `Sidebar.tsx` (mismo filtrado de hoy) + `title`/`aria-label` en cada `.nav-item`.
> 4. `BottomNav.tsx` (prefijo `bnav-`): 4 secciones según `BAR=['home','search','mytube','learn']` (completa con la siguiente
>    visible), y para el adulto lo que diga la decisión D2. Más «☰ Menú», que abre el cajón y se marca activo si la sección actual no está en la barra.
> 5. Cajón: §2.2 al pie de la letra. `translate:none` abierto, velo, Esc, cierre al navegar, `inert` en `.main` y foco.
>    **Probá abrir "Tu avatar" desde el cajón**: la hoja tiene que cubrir todo el viewport.
> 6. Rail (§2.2): CSS sobre `.side`, etiquetas *visually-hidden* (no `display:none`) con `.nav-item{position:relative}`
>    (si no, el span absoluto se escapa: es la falla de Premios, §1.3); «Ciclo (demo)» y mini-reproductor usables a 80 px.
> 7. TopBar compacta (§2.3): solo CSS, popovers `fixed` en el teléfono.
> 8. `index.html`: `viewport-fit=cover`.
>
> **No tocar**: §3 de RESPONSIVE.md; ninguna regla nueva fuera de los rangos <1024; nada de server ni contratos.
> **Aceptación**:
> - `node check.mjs --group shell --only C3,C5,C6,C7` verde en los 6 viewports. C1/C2 del Feed son contenido de T2, y
>   el C3 de `dock-list`/`dock-win` lo cierra T1: esos dos casos pueden seguir rojos solo por el dock;
> - `node check.mjs --group all --only C5,C7` verde: todas las vistas en el modo correcto y 1280 idéntico a la base;
> - a 375 el `contentW` de `/` es ≥ 343;
> - la barra inferior y su ☰ se ven y navegan; el cajón muestra los 9 (Ian) / 10 (Andrés) puntos + «Ciclo (demo)» +
>   «Sonido de fondo» + perfil;
> - a 1280, C5 en verde (geometría idéntica a la base);
> - `?stage` en una ventana de 900 px sigue viéndose como escritorio;
> - tsc y build limpios.
>
> Prohibido commitear.

### 4.2 T1 — Dock de Mensajes (depende de T0; en paralelo con T2–T5)

**Brief:**
> Sos el agente de la tanda T1. Leé `docs/AGENTS.md`, `RESPONSIVE.md` §1.1 (R5) y §2.5–§2.6, y el comentario de cabecera
> de `src/sections/friends/lib/chatDock.ts` (cómo se reparte el lugar).
> **Objetivo**: el dock del chico usable en el teléfono y alineado al rail en la tablet.
> **Archivos tuyos**: `src/sections/friends/friends.css`, `src/sections/friends/containers/ChatDock.tsx` (solo presentación)
> y, únicamente si hace falta la insignia total, el componente de la barra de la lista.
> **Hacer**:
> 1. `.fdk{left:calc(var(--side-w) + 16px); bottom:var(--bnav-h)}`.
> 2. Teléfono: botón redondo de 56 px con insignia; lista y conversación abiertas a pantalla completa (el `.fdk` entero
>    sube a z 95 con `:has` mientras haya algo abierto: §2.5); ventanas minimizadas sin dibujar.
> 3. `height:100dvh` en lugar de `min(480px, calc(100vh − 96px))`.
>
> **NO cambiar** `fitDock` ni la forma del store.
> **Aceptación**:
> - a 375, 390 y 430: abrir la lista y una conversación deja la conversación entera dentro del viewport (rect x ≥ 0,
>   right ≤ vw);
> - escribir en el campo no se tapa en Chrome Android emulado;
> - a 1280 el dock se ve idéntico a la base (`shots/ian-1280-dock-*`); a 768 se ve como `shots/ian-768-dock-*`, pero
>   alineado al rail (`left` = 80 + 16);
> - la campana sigue listando los no leídos;
> - `node check.mjs --group shell --users ian --only C3,C5,C6,C7` verde.
>
> Anotá para T6 lo que solo se puede probar en un iPhone (teclado).

### 4.3 T2 — Feed, Buscar (Videos, Páginas, Personas, Mentores), Lector, Reproductor y Chat

**Brief:**
> Sos el agente de la tanda T2. Leé `docs/AGENTS.md` (regla 5), `RESPONSIVE.md` §1.2 (filas Feed, Buscar, Mentores,
> Lector, Reproductor, Chat), §1.3 y §2.4. Mirá las capturas `shots/*-375-{feed,buscar*,lector,video,chat}.png`.
> **Archivos tuyos**: `src/sections/home/home.css` y `src/sections/discover/discover.css` (Chat vive acá).
> **Contexto medido** (§2.8): con solo el shell arreglado, a 375 Feed, Buscar (las 3 solapas + Mentores), Lector y Chat ya
> pasan C1–C3 (`shots/proto-all/`). Lo que queda es poco y concreto.
> **Hacer** con `@container app (max-width:639.98px)` y las recetas de §2.4:
> - **`.yt-actions` que envuelva**: es lo único que sigue desbordando: +182 a 375 con el shell nuevo, y +37/77 a 768 HOY.
> - `.gsave` visible con `@media (hover:none)`.
> - Targets < 24 px medidos con el shell nuevo: `.hf-why` (74×22), la × de limpiar Buscar (22×22), `.back` (19 de alto) y
>   los botones chicos del reproductor (22×22). Agrandar el área táctil (padding o `min-height`), no la tipografía.
> - Robustez a 320 px (iPhone SE de 1ª gen.): `.tabs` en fila scrolleable. Hoy entran a 343, pero sin margen.
>
> **No tocar** los anchos especiales (780/900/760) ni `space.css` (el patrón global `.shov` es de T4).
> **Aceptación**: `node check.mjs --group t2` verde en los 6 viewports (incluye C5 a 1280).

### 4.4 T3 — MyTube (+canal), Aprender (camino), Crear y After Day

**Brief:**
> Sos el agente de la tanda T3. Leé `docs/AGENTS.md` (reglas 5 y "Porte Smarty": `innerith-ui/route-lab/` NO se edita) y
> `RESPONSIVE.md` §1.2 (filas MyTube, canal, Aprender, camino, overlay, Crear, After Day), §2.4 y §2.6.
> **Archivos tuyos**: `src/sections/mytube/mytube.css`, `src/sections/learn/learn.css`, `src/sections/create/create.css`,
> `src/sections/afterday/afterday.css`.
> **Contexto medido** (§2.8): con solo el shell arreglado, MyTube, canal, Aprender, camino, Crear y After Day ya pasan
> C1–C3 a 375. Es la tanda más chica.
> **Hacer**:
> - `.ln-vid-frame` con `100dvh` (fallback `100vh`);
> - target `.back` del canal (19 de alto) ≥ 24;
> - `.mt-tab` en fila scrolleable (robustez a 320);
> - pasada visual a 375 de las capturas `shots/proto-all/andres-375-{mytube,canal,aprender,camino,crear,afterday}.png`
>   y arreglar lo que se vea mal aunque no lo marque `check.mjs`;
> - abrir el visor de After Day (`.adw`) en el teléfono y confirmar que es pantalla completa. Si After Day está vacío por la
>   demo, anotalo.
>
> Los overlays de Learn ya están bien (§2.6): no los toques.
> **Aceptación**: `node check.mjs --group t3` verde en los 6 viewports.

### 4.5 T4 — Tienda, Calendario, Mi espacio y Ligas (4 solapas)

**Brief:**
> Sos el agente de la tanda T4. Leé `docs/AGENTS.md` (reglas 5–7) y `RESPONSIVE.md` §1.2 (filas Tienda, Calendario, Mi
> espacio, Ligas ×4), §2.4 y §2.6.
> **Archivos tuyos**: `src/sections/store/store.css`, `src/sections/calendar/calendar.css`, `src/sections/space/space.css`
> (incluye el patrón GLOBAL `.shov/.shcard`: cualquier cambio ahí afecta todas las hojas; si lo tocás, probá las hojas de
> Buscar, MyTube y Tienda), `src/sections/leagues/leagues.css`.
> **Contexto medido** (§2.8): con solo el shell arreglado, Tienda, Calendario, Mi espacio y las 4 solapas de Ligas ya pasan
> C1–C3 a 375. En Ligas se leen nombre y XP (`shots/proto-all/andres-375-ligas-pais.png`).
> **Hacer**:
> - `.st-toast{bottom:calc(var(--bnav-h) + 16px)}` (si no, queda debajo de la barra inferior);
> - `.shcard{max-height:84dvh}`;
> - `.ltabs` en fila scrolleable (robustez a 320);
> - pasada visual a 375 y arreglo de lo que se vea apretado (`.st-bal`, `.cal-hero`, `.sphead-acts`).
>
> **Aceptación**: `node check.mjs --group t4` verde en los 6 viewports. A 375, en las 4 solapas de Ligas se lee nombre y XP de las 12 filas.

### 4.6 T5 — Familia (11 solapas + integrante)

**Brief:**
> Sos el agente de la tanda T5. Leé `docs/AGENTS.md`, `docs/USUARIOS.md` §9–§11 y `RESPONSIVE.md` §1.2 (filas Familia), §1.3
> y §2.4. Mirá `shots/andres-375-fam-*.png` y `andres-768-fam-premios-tabla.png`. **Ojo**: `src/sections/parent/` está en
> desarrollo activo (tandas F1/F2): partí del último estado y no pises lo de otros.
> **Archivos tuyos**: `src/sections/parent/parent.css` (solo CSS; si una tabla necesita `data-label` en el TSX, frená y
> proponelo).
> **Hacer**:
> 1. **Premios**: `.pz-table-wrap{position:relative}`. El `.pz-sr` absoluto deja de escaparse del scroller y la vista no
>    scrollea de costado: a 768 pasa de 112 a 0 px (medido inyectando la regla). No es grid blowout: los grids ya tienen
>    `min-width:0`. Revisá si hay otros `.pz-sr` o absolutos dentro de scrollers (Actividad, solapas).
> 2. Primera columna `position:sticky; left:0` para no perder qué fila es.
> 3. `.pz-tabs`: con el shell nuevo, a 343 px las 11 solapas envuelven en 4 filas y el panel arranca arriba (medido en el
>    prototipo). Alcanza; la fila scrolleable queda como opción si el dueño la prefiere.
> 4. Pasada visual a 375 de las 12 vistas (`shots/proto-all/andres-375-fam-*.png`): presets, switches, Límites y el editor
>    del Ciclo del día. Hoy pasan C1–C3 con el shell nuevo; arreglar lo que se vea apretado.
> (Los "checkbox de 13×13" que marcaban las métricas viejas son los radios ocultos del selector de integrante, con
> `opacity:0` y `pointer-events:none`: su target es la etiqueta. No hay que tocarlos.)
>
> **Aceptación**:
> - `node check.mjs --group t5` verde en los 6 viewports;
> - a 375 el primer panel arranca antes de y=300 (en el prototipo ya arranca arriba);
> - a 768 Premios muestra su columna de acciones scrolleando la tabla, no la vista.

### 4.7 T6 — QA integral + dispositivo real

**Brief:**
> Sos el QA de la deuda. Corré `node check.mjs --group all` (6 viewports × 2 usuarios). Recorré a mano, con las capturas, una
> pasada a 375 y una a 1280 contra `shots/` (antes). Con un **iPhone real** (Safari) y un Android (Chrome) probá:
> - el teclado en Chat y en una conversación del dock;
> - las áreas seguras (barra inferior, notch);
> - el cajón y la hoja "Tu avatar" abierta desde el cajón;
> - `100dvh` con la barra de Safari visible y oculta;
> - container queries en `#root` sin efectos en hojas fijas (§2.1).
>
> Esta parte la tiene que hacer una persona: Chrome headless no reproduce iOS. Reporte honesto: lo que no pasó, con captura.

### 4.8 `check.mjs` (ya escrito, en esta carpeta)

Ruta: `/private/tmp/claude-501/-Users-esteban-andres-altamura-kit-digital-Desktop-plataforma-educativa/7a572f1b-a01c-423c-9e13-1bc82caa4a0e/scratchpad/responsive-spec/check.mjs`.
`playwright-core` ya está instalado al lado. Se corre con `node check.mjs …` desde esa carpeta.

`node check.mjs --group <shell|t2|t3|t4|t5|all> [--users ian,andres] [--vps 375x812,…] [--base http://localhost:5173]
[--shots dir] [--tablet-side 80|240] [--only C3,C5,C6,C7]`. Con `--only` cuentan solo esos chequeos: T0 lo usa para
no responder por el contenido de las secciones.

- **Solo lectura**: aborta todo lo que no sea GET, salvo `POST /api/demo/reset`.
- **Chequeos**: C1–C7. C3 incluye que la lista y las ventanas del dock queden enteras en el viewport. **C7** valida el modo
  del shell: en el teléfono, barra inferior de 5, `.side` oculta y columna ≥ vw−32; en la tablet, `.side` de
  `--tablet-side` px (80 con el rail, 240 si D3 = sin rail); en escritorio, 240.
- **Contra la base**: a 1280 compara con `metrics/run2-<usuario>1280.json`. Las vistas de Ian que salieron "cerradas" en
  la base se saltean.
- **Secciones cerradas**: una vista "cerrada por el ciclo" se informa como SKIP, no como FAIL. El ciclo del chico depende
  de la demo y del otro QA.
- **Salida**: tabla PASS/FAIL y código ≠ 0 si algo falla. Con `--shots` deja una captura por caso.

**Probado hoy, antes de T0**:
- 375: falla a propósito. Ejemplo: `ian-375-dock-win` → `C3 dock fuera de pantalla: fdk-win(x=-191,r=69)`, C1, C2 y C7.
- 768: además de C7 (`.side` 240 ≠ 80, esperado hasta T0), fallan el reproductor (C1 +37, `.yt-actions` +77) y
  `andres-768-buscar` por C6: **dos 500 del server** en la búsqueda. Es del server o del proveedor, no de layout; lo dejo anotado.
  `andres-768-fam-premios` dio timeout de carga (flake).
- 1280: **PASS en las 7 vistas de T4 y en las 6 del shell** contra la base.

El registro completo del "antes" (375 y 768, todos los grupos: **0 PASS · 122 FAIL**, como se esperaba) queda en
`metrics/check-antes.txt`. Con `--inject proto-shell.css` el mismo script mide un prototipo antes de escribir código (§2.8).

---

## 5. Esfuerzo estimado (honesto) y riesgos

Horas de agente para implementar y verificar con `check.mjs`, sin contar la revisión del dueño. Son **estimaciones**,
corregidas a la baja después de medir el prototipo del shell (§2.8): las secciones quedan casi sanas solo con el shell. La
incertidumbre grande está en T0 y T1. Si D1 = cajón solo, T0 baja ~3 h. Si D2 = sin Familia en el teléfono, T5 sale
del plan, aunque igual conviene la línea de Premios (`.pz-table-wrap{position:relative}`), que arregla 768.

| Tanda | Archivos (exclusivos) | Horas agente | Riesgo | Por qué |
|---|---|---|---|---|
| **T0** Shell | `base.css`, `shell.css`, `avatar.css`, `Sidebar.tsx`, `BottomNav.tsx` (nuevo), `App.tsx` (Layout), `index.html` (+ `main.tsx`, `ProfileCard.tsx` si hace falta) | **6–9** | **alto** | es la raíz de todo (ver R-shell) |
| **T1** Dock | `friends.css`, `ChatDock.tsx` | **4–6** | **alto** | R-dock |
| **T2** Feed + Buscar + Lector + Video + Chat | `home.css`, `discover.css` | 2–3 | bajo | con el shell nuevo solo desborda `.yt-actions`; el resto son targets y `hover:none` |
| **T3** MyTube + Learn + Crear + After Day | `mytube.css`, `learn.css`, `create.css`, `afterday.css` | 1–2 | bajo | pasa C1–C3 con el shell nuevo; falta ver el visor de After Day |
| **T4** Tienda + Calendario + Mi espacio + Ligas | `store.css`, `calendar.css`, `space.css`, `leagues.css` | 1–2 | bajo-medio | pasa C1–C3 con el shell nuevo; `space.css` tiene el patrón global `.shov` |
| **T5** Familia | `parent.css` (524 líneas) | 2–4 | medio | Premios es una línea; el resto es pulido, en un archivo con desarrollo activo (R-tablas) |
| **T6** QA integral | — | 2–3 + **30–45 min de una persona con un iPhone y un Android** | — | lo de iOS no se reproduce en headless |
| **Total** | | **18–29 h de agente** | | |

**Calendario**: T0 (≈1 día) → T1, T2, T3, T4 y T5 en paralelo (≈½–1 día; manda T1) → T6 (≈½ día). **≈2–2,5 días
hábiles** con agentes en paralelo, más las idas y vueltas de revisión. Como T2–T5 son chicas, si se prefieren menos
agentes, **T2 + T3 + T4 pueden ir juntas** (4–7 h, archivos disjuntos igual).

**Riesgos principales:**
- **R-shell (T0)**. Toca la raíz: grilla, altura, contenedor `#root` y cajón.
  - **Regresión en escritorio**: se mitiga con todas las reglas nuevas dentro de rangos < 1024 y el C5 contra la base.
  - **Container query en `#root`**: verificado en Chrome que no atrapa `fixed`. **No verificado en Safari.** Si Safari
    confinara los `fixed`, el efecto sería nulo igual, porque `#root` cubre el viewport exacto; aun así, que T6 lo confirme.
  - **Cajón con `transform`**: si queda un `translate` distinto de `none` con la hoja "Tu avatar" abierta, la hoja queda
    presa en el cajón. Alternativa robusta: un `createPortal` de esa hoja a `body` (`ProfileCard.tsx`, archivo de T0).
    (Pasó en WebKit aun sin transform —el `container-type` de `.side` confina sus `fixed`— y SHELL-FIX lo resolvió con un
    portal de las dos hojas del perfil a `.app`, NO a `body`, para que sigan valiendo las `@container app` del teléfono y
    `?stage`: §2.6.)
  - **Container queries sin nombre** (`home.css:205`, `friends.css:83`): toman el contenedor más cercano. Con `#root` como
    contenedor nuevo, verificar que sigan apuntando al suyo.
  - **`100dvh`**: cambia la altura en móviles. Bien hecho, el pie ya no queda tapado por la barra de Safari.
- **R-dock (T1)**.
  - El teclado de iOS sobre un `fixed` a pantalla completa con el campo abajo: solo se sabe con un iPhone real; puede pedir
    un hook sobre `visualViewport`.
  - La convivencia de capas: barra inferior, cajón, hojas `.shov` (la regla `.app:has(.main .shov) .fdk{visibility:hidden}`
    sigue) y los overlays de Learn.
  - El store y `fitDock` no se tocan: el riesgo es de presentación, no de lógica.
- **R-tablas (T5)**.
  - Las tablas de Premios (`min-width:720`) y Actividad (600) usan `colgroup` fijos para alinear tablas hermanas.
    Recomendación: no convertirlas en tarjetas (eso pide `data-label` en el TSX y cambia el diseño), sino dejar que
    scrolleen dentro de su wrap (ya lo hacen, una vez corregido el `.pz-sr` que se escapa) con la primera columna `sticky`.
  - Las 11 solapas: con el shell nuevo envuelven en 4 filas y alcanza (prototipo); la fila scrolleable queda opcional.
  - `src/sections/parent/` está en desarrollo activo (F1/F2 en `git status`): hay riesgo real de choques de merge en `parent.css`.
- **R-estado de la demo**: el ciclo del chico y After Day cambian mientras otro QA trabaja (§Método). `check.mjs` informa
  esas vistas como SKIP, pero una tanda que necesite ver una sección de Ian abierta depende del estado. Para cobertura
  estable, Andrés (adulto) ve todas las secciones.
- **R-ritmo**: el cambio es transversal. Si T0 se demora, las otras 5 tandas esperan. Por eso T0 no lleva nada de secciones.

---

## 6. Decisiones para el dueño (máximo 3)

**D1 — Navegación en el teléfono.** *Recomiendo (A).*
- **(A)** Barra inferior **Feed · Buscar · MyTube · Aprender · ☰ Menú**. «Menú» abre el menú completo de hoy como cajón
  (también Chat, After Day, Tienda, Calendario, Mi espacio, Familia, «Ciclo (demo)», «Sonido de fondo» y el avatar).
- **(B)** Solo cajón: un ☰ en la barra superior y nada abajo.

(B) es ~3 h más barato y deja más alto para el contenido. (A) es mejor para el chico: las 4 secciones centrales siempre a
la vista y a un toque, al alcance del pulgar, como Duolingo, que es la estética que ya elegimos. Las 4 de la barra son una
constante: se cambian en un minuto.

**D2 — ¿El teléfono es también para Familia (el adulto)?** *Recomiendo (A).*
- **(A)** Sí, a nivel **"operable"**, sin rediseño: solapas en fila deslizable, tablas que se deslizan adentro de su
  recuadro, formularios apilados (tanda T5, 2–4 h, en paralelo). Para el adulto, **Familia entra en la barra inferior en
  lugar de MyTube**, al final por la regla 8: **Feed · Buscar · Aprender · Familia · ☰**.
- **(B)** Solo el chico. Familia queda como está en el teléfono (se usa con scroll de costado). Ahorra T5. La línea
  que arregla Premios a 768 conviene hacerla igual.

Un papá que configura desde el celular es lo esperable en una app de control parental.

**D3 — Tablet.** *Recomiendo (A).*
- **(A)** **Rail de íconos de 80 px entre 640 y 1023 px**; desde 1024 (iPad horizontal y cualquier compu), la barra de
  hoy. A 768 la columna pasa de 448 a 640 px.
- **(B)** Sin rail: barra de 240 desde 640 px para arriba. Dos modos en lugar de tres: menos CSS y menos QA, pero a 768 el
  menú se come el 31% del ancho.

En (B), `check.mjs` se corre con `--tablet-side 240`.

---

## 7. Resumen para Esteban

1. Hoy Innerith en un celular no se puede usar: el menú ocupa 240 de los 375 píxeles y cada pantalla queda en una tira de 55 px, con una o dos palabras por renglón.
2. Peor todavía: en el celu no se llega al cambio de usuario ni a la campana (quedan cortados) y la ventanita del chat con amigos se abre fuera de la pantalla.
3. En tablet (768) ya anda bien, salvo tres detalles: la tabla de Premios de Familia, la fila de botones del video y que el menú se come un tercio de la pantalla.
4. Lo que ya está bien en el celu: los ejercicios de Aprender, el visor de After Day y las ventanas emergentes ocupan toda la pantalla.
5. Propuesta: en el celu, una barra abajo con Feed, Buscar, MyTube, Aprender y «Menú» (que abre el menú completo de hoy); en tablet, el menú queda como columna de íconos; en la compu no cambia nada.
6. Arriba siguen la liga, los ⚡, la hora, tu avatar (para cambiar de usuario) y la campana. El chat con amigos pasa a un botón redondo que abre la charla a pantalla completa.
7. No cambia ninguna funcionalidad ni el server: es solo cómo se acomoda la pantalla. Todo lo que hoy se puede hacer, se puede hacer en el celu.
8. Se hace en 7 tandas: primero la estructura (≈1 día), después 5 en paralelo (≈½–1 día) y al final la prueba con un iPhone y un Android de verdad (≈½ día). Unos 2–2,5 días hábiles. Lo medí con un prototipo: arreglando solo la estructura, 55 de 61 pantallas a 375 ya quedan bien.
9. Lo más delicado: el chat con el teclado del iPhone, las tablas de Familia y no romper la versión de compu. Para eso dejé medida la versión actual y un chequeo automático que lo compara.
10. Necesito que decidas 3 cosas (§6): barra abajo o menú hamburguesa; si Familia también tiene que andar en el celu; y si la tablet lleva columna de íconos.
