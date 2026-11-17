# Videos de flujo de usuario (Smarty)

Guiones Playwright que graban el recorrido chat → artículo → video → /crear → ruta → preguntas → Tienda → canjes,
con cursor falso, tipeo humano, recuadro de mensajes (#vmsg) y una tira de sincronía que `cut.mjs` usa para recortar
las esperas (LLM, route-lab, arranque del player).

- `flow-mcd.mjs` — versión castellana («Máximo común divisor»), tal cual se usó para `smarty-flujo-mcd-final.webm`
  (BASE por defecto 5188: pasá `BASE=http://localhost:5173`).
- `flow-gcd-en.mjs` — porte al inglés («Greatest common divisor»): fuerza `innerith.lang=en`, route-lab en 5204,
  `X-Smarty-Lang: en` en los fetch, navegador en `en-US` (sin eso YouTube muestra el título traducido al castellano),
  y aborta si la app no está en inglés, si el artículo es corto/no inglés, si el video no es `ui5yjN1riQA`
  o si la ruta guardada no quedó con `"lang": "en"`.
- `flow-apollo.mjs` — video «Apollo 11» (14-nov), UN guion para los dos idiomas (`LANG=es|en`, o `FLOW_LANG`, que pisa
  al `LANG` de la shell): carátula SMARTY al empezar y al terminar → Feed: aceptar la solicitud de amistad de Destacados →
  chat con el amigo (2 mensajes) → lectura «Apolo 11» del Feed → leer → guardarla en una carpeta NUEVA en la raíz →
  chat IA: canal de YouTube → player: suscribirse + guardar el video en esa carpeta → /crear → Aprender: primer hito
  completo → volver a la lista. Sin Tienda. Recuadro #vmsg implementado pero con la tabla `MSG` vacía (video sin recuadros).
  Detalles abajo («flow-apollo»).
- `cut.mjs` — aplica los cortes de `cuts*.json` al crudo y escribe el webm final. Usa VP8 (libvpx) si el ffmpeg
  lo trae; el de Playwright 1.65 (build 1013) sólo trae libvpx-vp9 → sale VP9 (o forzá `VCODEC=`). Única diferencia
  con el `cut.mjs` del video castellano, que salió en VP8 con un ffmpeg de Playwright más viejo.
- `frames.mjs` — saca cuadros de un webm con Chrome (sirve para VP8): `node frames.mjs <video> <dir> <paso_s>`.
- `sheet.mjs` — hojas de contacto PNG (~1920 px) de un directorio de cuadros:
  `node sheet.mjs <dir> <prefijoSalida> <seg_por_cuadro> [cols=5] [filas=4] [título]`.

## Requisitos
App corriendo (vite 5173 + API 8787) y, para el inglés, un route-lab con el código nuevo en 5204.
Copiá los guiones a un directorio de trabajo fuera del repo (graban en `./rec/` y escriben `cuts*.json` al lado):

```sh
npm init -y && npm i playwright-core
PLAYWRIGHT_BROWSERS_PATH=$PWD/ms-playwright npx playwright-core install ffmpeg
export PLAYWRIGHT_BROWSERS_PATH=$PWD/ms-playwright   # también al GRABAR (Playwright busca su ffmpeg ahí)
FF=$(ls $PWD/ms-playwright/ffmpeg-*/ffmpeg-mac)
```
El navegador es el Chrome del sistema (`channel: 'chrome'`).

## Variables de entorno
- `MODE=full` (toma completa: 4 turnos de chat + 1 generación) · `MODE=rehearsal` (saltea escenas 2–6: sin artículo).
- `DSF` escala de pixeles (layout siempre 1440×900 CSS): 2 para ensayos rápidos, 3 para tomas (4320×2700).
- `NORETRY=1` aborta si el chat no trae cards al primer pedido (antes de generar: no gasta generación).
- `SHOP=1` sólo Tienda · `VIDEO=<id>` salta el chat y abre el player directo · `STOP=player|form` corta ahí.
- `BASE` URL de la app.

## Comandos
```sh
DSF=2 MODE=rehearsal SHOP=1 node flow-gcd-en.mjs                          # ensayo Tienda
DSF=2 MODE=rehearsal VIDEO=ui5yjN1riQA STOP=form node flow-gcd-en.mjs     # player + formulario
DSF=2 MODE=rehearsal node flow-gcd-en.mjs                                 # punta a punta sin artículo
DSF=3 MODE=full NORETRY=1 node flow-gcd-en.mjs                            # toma (deja cuts.json si sale ok)
OUT_W=3840 OUT_H=2400 BITRATE=14M FF=$FF node cut.mjs cuts.json smarty-flow-gcd-en.webm
```

## Gotchas
- NO reiniciar el `npm run dev` del usuario (`concurrently -k`: matar uno tira todos).
- Cada carga de página dispara `/api/demo/reset` (mercado y progreso al seed); el guion verifica que no queden canjes.
- La limpieza borra SÓLO rutas con el título exacto del guion. `/api/learn-routes` sólo devuelve las rutas del
  idioma del pedido: sin `X-Smarty-Lang: en` la limpieza no ve la ruta inglesa.
- El ffmpeg de Playwright es mínimo: sin filtro `fps` (usar `-r 1`), sin concat. El build 1013 codifica y decodifica
  sólo VP9 (ni encoder ni decoder VP8): para sacar cuadros de un webm VP8 (p. ej. el castellano) usar `frames.mjs`.
  Codificar 4K en VP9 (`-cpu-used 2 -row-mt 1`) tarda ~3× el largo del video.
- El screencast deriva respecto del reloj real: los cortes se ubican leyendo la tira binaria de abajo a la izquierda
  (que `cut.mjs` recorta del cuadro final).
- Locale: el navegador de grabación va en `en-US` (`--lang` + `locale`). La app no pasa `hl=` al embed de YouTube,
  así que con el Chrome en castellano YouTube traduce el título del video y «More videos».
- Subtítulos: con locale inglés YouTube enciende subtítulos automáticos. El guion los apaga mandando al iframe
  `unloadModule('captions')` por postMessage (IFrame API, `enablejsapi=1`), al aparecer el iframe y de nuevo
  después del arranque (reintentos con setTimeout dentro de la página: no cambian los tiempos del guion).
- Un ensayo punta a punta deja la ruta creada en el catálogo: borrala (misma limpieza) si no es la toma final.

## flow-apollo
- Idioma: `LANG=es` (navegador por defecto, `innerith.lang='es'`, route-lab por defecto 5203) · `LANG=en` (`--lang=en-US` +
  `locale`, `innerith.lang='en'`, `innerith.routeLabUrl=http://localhost:5204`). Todos los fetch del guion van con
  `X-Innerith-User: ian` y `X-Smarty-Lang: <lang>`. La tabla `T` tiene textos y selectores por idioma.
- Tramos para ensayar barato: `START=<escena> STOP=<escena>` con las escenas
  `caratula-inicio amigo chat-amigo apolo-feed articulo carpeta chat-ia player form generar guardar-ruta aprender
  hito-video lobby preguntas resultado salir caratula-fin`. `START=player` necesita `VIDEO=<id>` y que la carpeta exista
  (corré antes el tramo `apolo-feed…carpeta`); `START=form` con `VIDEO` abre `/crear?video=` directo.
- Limpieza al arrancar (desde la página, sólo lo que el tramo va a crear; `CLEAN=all` fuerza todo): rutas con el título
  EXACTO (`Apolo 11` / `Apollo 11`, la lista se sirve por idioma), la carpeta de la RAÍZ con ese nombre exacto (papelera +
  purge) y la suscripción al canal del video objetivo (`/api/space/follow` con `value:false`, sólo si estaba seguida).
  OJO EN: Ian ya seguía Veritasium antes del guion; la limpieza lo des-sigue.
- La hoja de carpetas arranca en la «última carpeta usada» (`localStorage innerith.lastFolder:<user>`): el guion la borra
  antes de abrir cada hoja para que arranque en la raíz (en el player, entra a la carpeta con un click a `.shfolder`).
- La carga de página dispara `/api/demo/reset` (vuelve la solicitud de amistad y se borran los hilos): si alguien usa la
  app como Ian durante una toma, el hilo del amigo desaparece y la toma se rompe sola.
- Abortos: app en otro idioma, sin solicitud, amigo sin responder (60 s saludo / 90 s respuestas), lectura de Apollo 11
  ausente del Feed, artículo bloqueado/corto/en otro idioma, tarjeta del video objetivo ausente, ruta guardada sin el
  `lang` correcto o en otro idioma (lee `server/data/learn-routes.json`, sólo lectura).
- Videos objetivo: ES `h-Z1bTGi5Qs` (Date un Vlog), EN `E7uGvsT_nnM` (Veritasium). `CHAT_ES2=1` usa la frase alternativa.
- Toma: `LANG=es DSF=3 MODE=full NORETRY=1 node flow-apollo.mjs` → `cuts-es.json`; recorte:
  `OUT_W=3840 OUT_H=2400 BITRATE=14M FF=$FF node cut.mjs cuts-es.json smarty-flujo-apolo11.webm`.
- `cut.mjs` acepta `KEEP_HEAD=<s>` (default 0.3, como antes): con `KEEP_HEAD=0` el recorte arranca directo en la carátula,
  sin el primer cuadro del crudo (banda gris del screencast). Así se cortó `smarty-flujo-apolo11.webm`.
- Chat IA: el corte de la espera arranca a 1,8 s del envío (el molde usaba 3 s; con respuestas de ~5 s el corte quedaba
  por debajo de 1,5 s y se veían 4–5 s de «Pensando…»). En la toma ES (hecha con 3 s) ese corte se agregó a mano en
  `cuts-es-v2.json` (67.4 → 69.7).
- `syncstat.mjs` — variante de `cut.mjs` que sólo lee la tira y muestra el % de cuadros congelados por ventana de 10 s
  (`SYNC_ONLY=1 FF=$FF node syncstat.mjs cuts-x.json <salida-ficticia.webm>`): sirve para elegir entre tomas. Con la máquina
  cargada (load ~9) las tomas inglesas salieron con ~21–24 % de cuadros repetidos (≈19 fps efectivos) contra ~6 % de la
  castellana.
- Toma inglesa (14-nov): `FLOW_LANG=en DSF=3 MODE=full NORETRY=1`; recorte `KEEP_HEAD=0 OUT_W=3840 OUT_H=2400 BITRATE=14M`
  con `cuts-en-v2.json` (cortes agregados a mano: respuesta 1 del amigo 17.9→19.7 y chat IA 65.6→67.3). El artículo del Feed
  en inglés es el de Smithsonian Air and Space (airandspace.si.edu, ~3.900 caracteres).
- OJO: una toma nueva BORRA la ruta de la toma anterior con el mismo título (limpieza): si te quedás con el video de una
  toma vieja, la ruta del catálogo es la de la última toma (mismo título, postas distintas).
- Abortos nuevos (14-nov): `ABORT-PLAYER` si el reproductor (escena del player) o el video del hito (escucha los
  `infoDelivery` del iframe por postMessage) no avanza en 25 s — antes la toma seguía con el video congelado en 0:00.
- Fluidez: grabar con la máquina tranquila. `take-en.sh <n>` espera a que el promedio de carga de 1 min baje de 4,5
  (reintenta cada minuto, hasta 15 min), graba la toma inglesa y mide los cuadros repetidos con `syncstat.mjs`
  (objetivo ≤10 %; >15 % → repetir). La toma inglesa final (toma 3) dio 9,9 % (la 1 había dado 24 % con
  `BDUpdDaemon` de Bitdefender comiendo CPU).
- Arranque (14-nov, continuidad): cargar → limpieza por API → RECARGAR → esperar el Feed → carátula. Sin la recarga el Feed
  ya pintado conservaba el destacado «Review Apollo 11» de la ruta de la toma anterior. Chequeo nuevo con aborto
  (`ABORT-DESTACADO`): el texto de `section.fpin` (destacados) no puede contener el título de la ruta de la toma (la tarjeta
  de LECTURA del hilo sí lo contiene y está bien). Ensayo barato del arranque: `CLEAN=all STOP=caratula-inicio`.
- Toma inglesa final: toma 5 (6,7 % de cuadros repetidos; la 4 abortó por `ABORT-PLAYER`, YouTube no arrancó).
- Recuadros (14-nov, pedido del dueño): la tabla `MSG` trae los 13 textos por idioma (feed, friendChat, why, articulo,
  carpeta, chat, player, suscripcion, ruta, crear, aprender, hito, preguntas); `NOMSG=1` graba sin recuadros. `msg()` y
  `msgOff()` esperan lo que falte para que cada recuadro quede ≥3,5 s (3 s enteros + fundido) antes de cambiar o apagarse.
  El chequeo `ABORT-DESTACADO` sólo corre cuando la toma borra la ruta (toma completa o `CLEAN=all`).
- Arranque del video del hito: además del `infoDelivery` del iframe, mira el `<video>` adentro del iframe de YouTube
  (en un ensayo castellano el video corría pero no llegó ningún `infoDelivery` y abortaba en falso).
- `take.sh <es|en> <n>`: como `take-en.sh` pero para los dos idiomas.
- Fluidez vs. recuadros: medido en un tramo sin LLM a DSF=3, con y sin recuadros (16 % / 19 % / 16 %): los recuadros no
  cuestan cuadros; lo que cuenta es la carga de la máquina, que la propia toma sube a 10–16.
- `campaign.py <es|en>` (reemplaza a la compuerta por load de `take.sh`): antes de cada arranque mide la CPU con
  `top -l 2 -s 5` (2.ª muestra) y exige, en dos mediciones seguidas a 30 s: load 1 min < 4, ningún proceso ajeno
  > 25 % (ajeno = todo menos kernel_task, top, WindowServer, la app de Claude, com.apple.Virtualization y lo de la
  grabación) y WindowServer ≤ 60 %; si no, reintenta cada 60 s hasta 3 h. (Un primer umbral, WindowServer < 20 %, no
  pasaba nunca: la app de Claude dibujando la sesión lo tiene en 20–45 %, también durante las tomas buenas.) Hasta 8 arranques y 3 tomas completas (las que llegaron a generar); un aborto antes de generar no cuenta como toma.
  En castellano, los arranques pares usan `CHAT_ES2=1`. Fluidez: ≤10 % buena (fin), 10–15 % candidata, >15 % descartada.
  Todo queda en `campaign-<lang>.log` (cada medición, cada arranque y su resultado).
- Tomas finales con recuadros (14-nov, `campaign.py`): castellano `c1` (7,1 % de repetidos en la toma, 6,6 % en el recorte,
  espera de compuerta 0,7 min) → `smarty-flujo-apolo11-msg.webm`; inglés `c3` (6,9 % / 7,2 %, espera 13,3 min; `c1` abortó
  sin la tarjeta objetivo y `c2` por `ABORT-PLAYER`) → `smarty-flow-apollo11-en-msg.webm`. Recortes con `KEEP_HEAD=0` y los
  cortes de las respuestas del amigo adelantados a mano (`cuts-<lang>-msg-final.json`).
- Carpetas (14-nov): la limpieza previa borra las carpetas RAÍZ «Apolo 11» Y «Apollo 11» (los dos idiomas, en cualquier
  orden de grabación; la toma inglesa con recuadros mostraba en la hoja de carpetas la «Apolo 11» que dejó la castellana).
  Nada más: ni otras carpetas raíz ni la «Apollo 11» vieja dentro de «Favoritos». Aborto nuevo `ABORT-CARPETAS` antes de la
  carátula si queda alguna de esas dos en la raíz. Las rutas siguen limpiándose sólo en el idioma de la toma.
- Toma inglesa final con recuadros: `c1` de la campaña del 14-nov a la noche (6,0 % / 6,1 % en el recorte), con la limpieza de carpetas de los dos idiomas; la anterior queda como `smarty-flow-apollo11-en-msg-c3.webm`.
