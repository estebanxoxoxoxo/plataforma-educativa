# Innerith — Visión de la plataforma

> Fuente: transcripciones de audio de Esteban (`transcripciones_completas (2).txt`, 68 notas, oct-2026).
> Este documento es el mapa completo de la plataforma. El prototipo visual, la POC de Smarty y la UI
> actual implementan partes de esto; acá está el todo y cómo se conecta.

## 1. Origen y tesis

La idea nace de una observación con Ian a los ~3 años: **los videos le rendían como canal de
aprendizaje mucho antes de saber leer**. Un chico que todavía no lee puede entender y memorizar
temas complejos por video; eso adelanta años de aprendizaje y lo capitaliza de forma compuesta
("cuanto antes se desarrollan ciertas partes, la capitalización compuesta del aprendizaje hace la
diferencia").

De ahí la distinción central que ordena todo el producto:

- **Mundo digital virtuoso**: documentales, ciencia, tecnología, vocabulario, música, conceptos —
  contenido que enriquece el pensamiento.
- **Mundo digital nocivo**: "chupetes electrónicos" — color, ruido, movimiento, dopamina barata
  (TikTok, videos de gatitos), contenido ideológico o desinformante.

**La promesa: todo lo bueno de lo digital sin nada de lo malo, a demanda, según los intereses del
chico, desde los 3 años.** No existe nada en el mercado que lo cumpla (YouTube Kids mezcla todo y no
permite listas blancas; combinando plataformas y mucho trabajo del padre apenas te acercás). La
primera prueba fue un servidor casero con miles de videos curados: funcionó.

Hay una segunda tesis, política-cultural: **devolverle al padre el control de la educación**, hoy
repartido entre el adoctrinamiento escolar (estados) y los algoritmos de recomendación (empresas).
El padre pasa a configurar el algoritmo que guía a su hijo. Y una tesis de mercado: la IA va a
dejar a muchos padres desempleados estudiando "lo mismo que estudiaron ellos", lo que va a producir
una reacción fuerte contra la educación tradicional y a agrandar el mercado de alternativas.

**Público objetivo**: homeschooling estadounidense, conservador (cristianos católicos y
protestantes, judíos), libertario, ingresos > USD 50k/año. Precio USD 30–70/mes (posible modelo
progresivo). Uso esperado: 4–6 h/día, porque además de estudiar ahí viven su música, sus videos y
sus amigos. "Las escuelas tienen el mejor pago recurrente que existe."

## 2. El contenido: mega listas blancas con costo de moderación que tiende a cero

- Todo lo que el chico puede ver sale de **listas blancas enormes** (cientos de miles de videos y
  artículos). Las listas negras solas no sirven.
- La lista blanca **crece con el uso**: lo ya analizado queda cacheado; si el chico pide algo que
  todavía no se estudió, **se analiza en el momento** y se decide si entra o se rechaza. La caché
  *es* la lista blanca.
- **Imágenes** (lo más difícil de filtrar): lo que funcionó en la POC es relevancia de Google +
  análisis por imagen con IA (más de un método) + caché del veredicto. Lo que falta se analiza en
  tiempo real.
- **Economía**: el subconjunto de internet virtuoso para chicos es chico; los usuarios circulan
  alrededor de los mismos contenidos → con el tiempo todo queda cacheado y **el costo de moderación
  tiende a cero**. Los modelos necesarios no son de frontera. Hay cuotas por suscripción.
- A futuro: **bibliotecas propias** de imágenes y artículos (calidad ↑, costo ↓, latencia ↓), y un
  **corpus escaneado de currículas oficiales y libros escolares** por país y grado, para generar
  masivamente rutas/cursos que cubran la currícula oficial (ej.: "Ciencias Naturales 4º grado,
  Dinamarca") y poblar la plataforma de rutas recomendables sin trabajo del padre.

## 3. Las cuatro puertas de acceso al contenido

Como "si no sabés que algo existe, no sabés buscarlo", hacen falta las cuatro:

1. **Buscador semántico** (tipo Google, con solapas) — existe en la UI actual.
2. **Índices**: recorrer canales, playlists, directorios. Es **MyTube**: los canales a los que el
   chico se suscribió, sus playlists. (Hecho en la UI nueva: la sección "MyTube", porte exacto del POC, con Canales y Mis listas en solapas; 12-oct-2026.)
3. **Feed de descubrimiento** (la home): recomendaciones de contenido según el algoritmo
   configurado por el padre + los intereses del chico, **y además** las noticias sociales (logros de
   amigos, cierres de liga, rutas compartidas) con reacciones por emoji, estilo LinkedIn. **No
   existe todavía en ningún lado y es la pieza de UX central.**
4. **Chat de IA seguro** (súper prompteado, con herramientas de búsqueda) — existe y ya corre con el
   pipeline real de moderación.

## 4. Conservar y volver al contenido

- **Drive**: carpetas y subcarpetas para investigaciones escolares; todo lo encontrado (por feed,
  chat, buscador o índices) se puede guardar ahí. (Hecho en la UI nueva: "Mi espacio → Carpetas",
  con papelera restaurable; 8-oct-2026.)
- **Suscripciones a canales** y **playlists propias**. (Hecho en la UI nueva: "MyTube →
  Canales / Mis listas"; 8-oct-2026, porte exacto del POC 12-oct-2026.)
- **Reproductor en segundo plano**: la plataforma es también el reproductor de música del chico
  (la música vive en YouTube), más ruido blanco/rosa/marrón y lluvia para concentrarse. (Hecho en
  la UI nueva: MiniPlayer en la barra lateral, ruidos sintetizados blanco/marrón/rosa; falta
  "lluvia"; 8-oct-2026. Topes parentales de volumen hechos en la Zona de padres v2; 9-oct-2026.)

## 5. Rutas de aprendizaje — el corazón de la plataforma

"Es lo que desbloquea todo": sin esto, un padre puede querer marcar el rumbo pero no tiene recursos
(tiempo, material didáctico) para crear actividades entretenidas. La generación por IA reduce ese
costo a casi nada.

- **Qué es una ruta**: consumo de contenido + postas de ejercicios (multiple choice y otros tipos).
- **Cómo se crea**: a partir de contenido existente — video, imágenes, libros, texto, PDFs. La IA
  extrae **facts** del contenido y arma las preguntas.
- **Verificación adversarial**: cada fact extraído se puede mandar a verificar contra referencias
  externas (buscar confirmaciones o refutaciones). Edición fluida: sacar facts, agregar o reducir
  preguntas.
- **Quién crea**: el padre (se la publica al hijo), la comunidad (rutas publicadas que otros usan),
  o el chico mismo si el padre le dio el permiso.
- **Compartir**: una ruta compartida aparece en el feed de los amigos y es encontrable por los
  buscadores/índices.
- **Matemática y lógica**: caso especial — los ejercicios se **generan de forma determinista**
  (sin contenido de origen), según dónde está la dificultad del chico.
- **Casos de uso**: reforzar una materia floja; **preparar un examen** (subís libros/videos del
  examen → ruta → practicás con active recall y gamificación); adolescente que arma su propia
  currícula. Adultos: explícitamente **no** son target.

## 6. Practicar y repasar

- La plataforma **contabiliza por fact** cómo le va al chico en cada posta.
- **Active Recall**: sesión diaria aparte que combina las cards de todo lo que tiene flojo entre
  todas sus rutas.
- **Simulaciones integradoras**: desafíos que cruzan facts de varias rutas (física + matemática +
  literatura…) en historias tipo "elegí tu propia aventura", armadas de historias template + perfil
  del chico + facts a reforzar. Equivocarse en un fact te manda por un camino errado del que hay que
  volver: el error "se encarna", duele más que dar vuelta una carta. Evolución: imagen/video/música
  generativos → casi videojuegos educativos.
- Ninguna de estas ideas es un desafío técnico real con los LLMs actuales.

## 7. Gamificación por capas (cada capa se puede apagar)

| Capa | Qué es |
|---|---|
| 1. Experiencia | Efectos visuales/sonoros al ganar o perder puntos + **música adaptativa**: multitrack por stems cuyos volúmenes, tempo, densidad de orquestación y efectos reaccionan a los estados cognitivos detectados (velocidad de respuesta, racha buena/mala); un track de reloj aparece en ejercicios con tiempo; queda solo el pad cuando se busca sensación de tiempo detenido. "Se siente como un videojuego." (Esto es exactamente lo que prototipa `audio-lab/` en smarty-poc.) |
| 2. Acumulación | **Energy Coin**: los puntos de cualquier ruta/ejercicio van a una **billetera**. |
| 3. Utilidad | **Marketplace**: el padre publica recompensas a su medida (horas de videojuego, salidas, una bici, una consola, o cosas humildes); además hay ítems de plataforma (ropa de avatar, regalos para otros usuarios). Sin marketplace no hay razón de ser para la coin: van juntos. |
| 4. Competencia | **Ligas**: se **asignan según los resultados del chico** (no se eligen), **12 participantes**, cierre semanal, medallas (1º/2º/3º) que aparecen en el feed de tus amigos. El **puntaje semanal es UNO solo** (lo que el chico cosechó en la semana): el mismo número ordena su liga, su puesto de **zona** y el **nacional** — no hay un puntaje por tabla. Desafío matemático ya analizado alguna vez: **todo chico debe tener siempre una liga donde pueda ser competitivo**. Las ligas son la puerta por la que el chico descubre que hay otra gente en la plataforma. *(Precisiones de Esteban, 8-oct-2026.)* |
| 5. Colaboración | **Equipos/clanes** para ligas por equipos. Clave para homeschoolers (están solos en casa): conocen a otros chicos y se empujan entre ellos cuando uno se queda atrás. |
| 6. Reputación | Emblemas/estandartes en el avatar (ej. "1º de su liga la semana pasada"), ropa del avatar como estatus (la default es "soviética"; con coin te comprás ropa con onda). El prestigio se gana **generando**: aprendiendo lo que vos mismo dijiste que ibas a aprender. |
| + Altruismo | Ayudar, responder preguntas, regalar ítems comprados con tu coin ("noviecitos" regalándose ropa de avatar = enganche). |
| + Mentores | Chicos que se ofrecen de mentores y chicos que buscan mentoría; posible pago en coin (riesgo de crear un mercado — analizar); insignia de mentor como prestigio. |

## 8. Lo social: la red de los homeschoolers

- Los chicos que hacen homeschooling comparten ideología, búsqueda y exceso de tiempo: necesitan
  conectarse. "La red social de los homeschoolers."
- Red de amigos; sus logros aparecen en el feed y se reacciona con íconos fijos.
- **Mensajes directos con moderación de IA en tiempo real**: un mensaje de bullying nunca llega;
  el moderador le responde al emisor ("fijate si podés no usar esta palabra"). La tecnología es el
  mismo pipeline de moderación del chat (ya construido).
- Con permisos por edad: a los 3 años no hay red social; a los 12 sí.

## 9. Avatar y pertenencias

- Avatar diseñable + **guardarropas** de assets comprados en el marketplace.
- Problema técnico: las empresas de tecnología de avatar fueron desapareciendo; la apuesta es IA
  generativa de imágenes con aplicación estable de assets. (En smarty-poc, `avatar-lab/` +
  `voice-server/` son los bancos de prueba del personaje.)
- **Retención por activos acumulados**: playlists, canales, carpetas de investigación, amigos,
  ligas, prestigio, emblemas, avatar y su ropa. Irse = perder todo eso.

## 10. Control parental: el padre programa el algoritmo

- **Todo es configurable y apagable** por funcionalidad (coin, marketplace, social, avatar, estilos
  por edad…), respetando dependencias.
- **Temas de lista blanca** (lo que el padre quiere promover: tienen prioridad en recomendaciones,
  búsquedas y chat, sin guiar al 100% — "las sugerencias del padre"), **temas de lista negra**,
  **lista negra de palabras**, y **checks de temas enteros** (ej. "ideología de género" apagado con
  un clic).
- El filtro del padre define el subconjunto de la mega lista blanca que ve *su* hijo.
- La configuración actual (la POC) es "un infierno, un motor intermedio": el producto final necesita
  **presets y un wizard inicial** (quiénes son como familia, qué creen, ideología, edad del chico →
  todo queda configurado).
- **Escala por edad**: de un nene de 3 años con *solo videos y una lista blanca de 5 videos*, hasta
  un adolescente con todo el stack creando sus propias rutas.

## 11. Dispositivo seguro y arranque

- Es una app web, pero **se envuelve en apps de escritorio** para poder desinstalar/bloquear los
  navegadores, **más una VPN** provista. En iPad: instalar un perfil = VPN + navegadores bloqueados
  en un solo acto.
- **Arranque en frío**: poblar la plataforma con **usuarios agénticos (NPCs)** — algunos con
  actividad simple, otros agénticos de verdad que responden mensajes y mandan solicitudes de
  amistad — para que desde el día cero se sienta viva.
- **Onboarding**: wizard corto (ideología, intereses, toggles). Se puede empezar sin crear ninguna
  ruta: las rutas llegan como recomendaciones del feed según los temas blancos.
- **Puertas de entrada** según el caso: el chat, la biblioteca de videos/música, o "subí tus
  materiales y practicá para el examen". La gamificación se descubre después; las ligas revelan que
  hay otros usuarios. Ojo: un chico "quemado" por TikTok no lo vive como beneficio hasta
  desintoxicarse; uno que no tenía internet libre lo vive como un regalo.

## 12. Negocio y riesgos anotados

- Suscripción USD 30–70/mes (< 0,5 % del ingreso familiar objetivo). B2B posible: lotes para
  escuelas y gobiernos.
- Streaming de video viene de YouTube; se cree que no viola ToS; analizar consumo/fan-out.
- Modelo alternativo con **mentores humanos entrenados** (grupos, 2-3 sesiones semanales de ~1 h,
  USD 100–200/chico/mes, 100–300 chicos): ingresos más rápidos pero no escalable — revisar si
  tiene sentido.
- Pregunta abierta: ¿una sola aplicación o un ecosistema? La respuesta provisoria: **una plataforma
  que prende y apaga funcionalidades**.

## 13. Mapa: visión ↔ smarty-poc ↔ innerith-ui (oct-2026)

| Pieza de la visión | smarty-poc (POC) | innerith-ui (actual) |
|---|---|---|
| Buscador whitelisted (páginas/imágenes/videos) | ✔ completo | ✔ real (backend propio con lógica de Smarty) |
| Vista de lectura moderada | ✔ | ✔ real |
| Chat seguro con tools | ✔ | ✔ real |
| MyTube (suscripciones, canales) | ✔ | ✔ real, PORTE EXACTO del POC (W5, 12-oct): sección **MyTube** en el menú con solapas Canales \| Mis listas. Canales = SOLO los seguidos con contenido (16 de arranque), sin buscador ni "Para descubrir" (se retiraron, decisión 6 del mapa); vista de canal con @handle, descripción CURADA por IA (editable por el padre) y solapas Videos (40 + «Ver más») y Playlists del canal (las propias en YouTube, filtradas a lo aprobado), enriquecida on-demand con la key del server y cacheada en `server/data/mytube.json`. El padre suma videos/playlists/canales por URL en Zona de padres → **YouTube** (reingestar, completar canales, quitar duplicados, tope por entrada, borrar en cascada). Quirks del POC portados tal cual. Consolidación F2+W5 (12-oct): los videos que suma la familia los ven también Buscar → Videos, el reproductor, el chat, Mis listas y Drive (`videos.ts` enchufa la capa `familyCatalog`: mismo índice de búsqueda y mismas palabras bloqueadas; borrar la entrada los saca de todos lados) y el **chip del canal** del reproductor abre su vista en MyTube (la única puerta a un canal no seguido, como el POC). **Deudas saldadas (14-oct)**: el reproductor quedó EXACTO al POC —relacionados del server (mismo canal y después similares por tema, 12, ya filtrados) al costado en apaisado o debajo; cola de una lista circular que saltea los videos no disponibles y se frena si todos fallan; «Escuchar de fondo» desde el reproductor manda solo el video que suena; «＋ Lista» marca con ✓ las listas que ya lo tienen— y la ingesta del padre (`/api/mytube/admin/*`) va con la sesión del portón (401 sin ella) |
| Playlists del chico | ✔ ("Mis listas") | ✔ real (MyTube → Mis listas: «Nueva lista» primero, portada y conteo solo con lo aprobado, orden propio con ↑/↓, reproducir todo con auto-avance —circular, saltando los no disponibles, con el panel «En la lista»—, escuchar de fondo la cola entera desde la vista de la lista; tocar un video lo reproduce suelto, como el POC; «＋ Lista» desde el reproductor marca las que ya lo tienen) |
| Drive (carpetas) | ✔ | ✔ real (carpetas anidadas, raíz solo-carpetas tipo nube con "General" por defecto, papelera restaurable, "Guardar en…" desde video/lectura/imagen; `server/data/space.json`) |
| Música de fondo + ruidos | ✔ | ✔ real (MiniPlayer en la barra: cola + repeat + seek + duck; ruidos blanco/marrón/rosa por Web Audio; topes parentales de volumen vivos desde la Zona de padres → Límites) |
| After Day (audio para trabajar o estudiar, curado por el padre) | ✔ (sección `/afterday` + `musicWhitelist`; HORARIOS.md, Feature B) | ✔ real, PORTE EXACTO del POC (W6, 12-oct): punto de menú **After Day** (la luna, después de MyTube) con la lista de audio que arma el padre en Zona de padres → YouTube → «Música de After Day» (link de un video de YouTube + nombre opcional; sin repetidos; playlists, canales y @handles rechazados con el texto del POC; sin edición ni reorden). El chico la escucha SOLO como audio de fondo: tocar una tarjeta = cola de UN track en el MiniPlayer, sin "Abrir el video", y sigue sonando al cambiar de sección; la que suena va resaltada. Persistida en `server/data/music.json` (config del padre), sin key de YouTube (título por noembed si el padre no le pone nombre). Quirks del POC portados tal cual: no filtra palabras bloqueadas, y si su franja horaria se cierra la sección se va pero el audio que sonaba sigue. Pensada para tener su propia franja (Horarios por sección: puede quedar abierta cuando lo demás cerró). Falta: decidir si el demo arranca con una lista sembrada (hoy nace vacía) |
| Feed (descubrir + social) | ✖ (solo mocks: `docs/feed-mocks/`; el v6 "un hilo, muchos estilos" es la referencia) | parcial-fuerte en UX, FAKE en algoritmo (**modelo v6 del POC, tanda Feed v6, 12-oct**; pedido de Esteban: funcionalidad y diseño del mock, colores de Innerith): UN hilo central finito donde se intercalan cinco estilos de bloque — el hero "Fijado · tu siguiente paso" (SIEMPRE aprendizaje, jamás comercio: la ruta en curso con el progreso real), cards estándar con su "por qué" en lenguaje de chico y "ver menos" reversible, noticias de ligas que atraviesan el hilo (con el avatar de quien la protagoniza y reacciones de emoji: desvío decidido), la grilla de videos y el resumen que CONFIESA la mezcla y cómo cambia con la hora del día; títulos editoriales en serif, sin sombras. Termina en "Estás al día": "Ver más de antes" lo pide el chico (nada de scroll infinito). Lo nuevo (ráfaga "Simular NPCs", cierre de liga) espera en la píldora "N novedades ↑" y entra arriba solo cuando el chico la toca. Racha sin presión junto al saludo. El padre fija la animación (calma / normal / viva) en Zona de padres → Protecciones y el movimiento reducido del sistema fuerza calma. La mezcla la arma el server fake por franja del día (mañana/tarde/noche) con contenido real del catálogo y la lista blanca y la config del padre en serio (temas, palabras, on-off de Amigos/Ligas/Tienda); los intereses ya no salen de los temas blancos de fábrica del chat. **Zona pinneada** de notificaciones destacadas arriba del hilo (tanda F2, 12-oct): una lista pensada para crecer; hoy, "X quiere contactarse con vos" con Aceptar / "Ahora no" ahí mismo, y sin destacados no existe. Falta: el algoritmo de recomendación real (intereses aprendidos, un "ver menos" que aprenda de verdad), eventos sociales reales y —deuda de esta tanda— cablear `POST /api/feed/less` en `server/src/index.ts` |
| Rutas desde contenido + facts verificados | parcial (learnRoutes en el backup; y el generador SÍ está: `smarty-poc/route-lab/` en la rama develop —servicio Python con pipeline por etapas (`stages/`, `jobs/`, `cli.py`, `server.py`)— + los docs `RUTAS_GENERADAS.md` y `AUDITORIA_FACTS.md`. Corregido 12-oct: antes decía "no está en el snapshot") | parcial-fuerte → PORTE EN CURSO: **/crear REAL (W1, 12-oct)** — port exacto del creador por módulos del POC contra route-lab (copiado al repo y corriendo), con inventario de facts, curaduría, AUDITORÍA de veracidad server-side (gpt-5.5 + Serper + Wikipedia, con fuentes) e import de bundles al catálogo del server (seed poc-solar). El motor de actividades ya está portado (W2). **Learn colapsado REAL (W3, 12-oct)**: Aprender ES Learn — el mosaico muestra las rutas generadas del catálogo (por categoría, con portada/emoji y "N/M postas"); cada ruta es un camino estilo Duolingo (zig-zag, bandas sticky por módulo con los 6 colores del POC, guidebook del contenido) y cada posta abre un overlay a pantalla completa: lectura (lector real de Innerith) o video → "Empezar preguntas →" → lobby, cuenta 3-2-1, juego (los 5 Tipos del motor) y resultado; el progreso es 100% derivado de los resultados por target (persistidos en el server, sobreviven a F5) con `resolveRoute` exacto y sus quirks; música por escena (SceneDirector) dueña del fondo del MiniPlayer; economía Innerith: +30 ⚡/XP la primera vez que se completa cada objetivo. **Practicar se retiró** (los 5 cursos viejos y su práctica generada: código borrado, `/practicar*` y `/aprender/:id` redirigen a Aprender) y el Feed apunta a las rutas reales ("Seguí con <ruta>"). **Deudas saldadas (14-oct)**: el import hace el ACUÑADO SECO COMPLETO del POC (generador + portero de cada Tipo con el mismo motor del cliente, que el server importa sin los tableros) y las rutas de ARTÍCULO toman de portada la imagen de su artículo de Wikipedia (la pide el server y la guarda en la ruta); el guardado de resultados reintenta si falla (cola en orden). Falta: convertir a rutas los 5 cursos viejos si Esteban los quiere de vuelta (decisión 2 del mapa) |
| Active Recall | ✖ (en develop: integrado en Learn — raíz sin fin + postas de repaso, urgencia 0.6·(1−lastPct)+0.4·min(1,Δt/3d)) | ✔ real, EXACTO del POC (W4, 12-oct; el Repasar propio se había retirado: /repasar redirige a Aprender), DENTRO de Learn: botón raíz "Active recall · N temas" (todo lo jugado con definición hoja) que abre un repaso SIN FIN entre todas las rutas —orden por urgencia `0.6·(1−lastPct) + 0.4·min(1, Δt/3 días)` fijado UNA vez al tocar, cicla hasta Rendirse o cerrar— y postas de repaso en el camino (lo previo del módulo o de la ruta, ya jugado, K = min(5, n)). Cada hijo graba a SU objetivo (mueve las postas reales: puede destrabar una comprensión) y el repaso no vuelve a pagar ⚡. Quirks del POC portados tal cual (entra todo lo jugado aunque esté dominado, mismo set barajado, targets de rutas borradas hasta recargar, sin fechas ni SRS por ítem). Falta: la sesión diaria y la contabilidad por fact de la visión (§6) — el POC no las tiene |
| Simulaciones integradoras | ✖ | ✖ |
| Matemática determinista | ✖ | ✖ |
| Música adaptativa | ✔ prototipo (`audio-lab`) | ✖ |
| Energy Coin + billetera + marketplace | ✖ | ✔ real en demo ("Tienda": billetera en RAM con reset por carga de página, premios del padre, canjes pendientes de entrega, lista de deseos persistida; ítems de plataforma: la ropa del avatar, que se compra o se regala a un amigo —ver "Avatar + guardarropas"—, 11-oct-2026) |
| Ligas semanales por coin + equipos | ✖ | parcial-fuerte (liga asignada con XP real, solapas Mi liga/Tu zona/País, cuenta regresiva real al cierre del domingo y medalla de la semana pasada visible en Ligas y en el feed (la noticia de la liga de la semana). **Cierre de semana SIMULADO** (botón de demo "Simular cierre de semana" al pie de Ligas): la tabla real se congela, medalla al podio, re-asignación por resultados en una escalera de 5 ligas —Chispa → Cometa → Estrella → Supernova → Galaxia: podio sube, 10º-12º baja, las puntas no desbordan—, semana nueva con la XP en 0 (la Energy Coin, la racha y el total no se tocan), tabla fresca y zona/país recién arrancados, y las noticias del cierre en el feed (tu medalla con los festejos de tus amigos, el podio de tu tabla); varios cierres = varias semanas; 11-oct-2026. Falta: el cierre REAL del domingo con chicos reales, emblemas de liga más allá de la medallita y los equipos/clanes) |
| Mentores / profesores (audios 30 y 67) | ✖ | parcial: marketplace de profes + calendario del chico (demo). Zona de padres → **Profesores** (`/padres/profesores`): 8 profes particulares del demo con su precio por hora; "Contactar" → día y hora de la clase semanal (las horas que el chico ya tiene, tachadas) → las próximas 4 clases aparecen en el **Calendario** del chico (`/calendario`, último punto del menú: próxima clase con cuánto falta, la semana de lunes a domingo con hoy marcado y las que siguen; sin precios ni gestión). Contrataciones persistidas en `server/data/teachers.json` (config del padre); las clases se derivan al leer y la serie corre sola. Desde el 14-oct lo del padre va con la sesión del portón (el calendario del chico sigue público). Falta: contacto/mensajería real con el profe, pagos, la agenda real del profe (disponibilidad, reprogramar), la clase en sí (video) y la mentoría ENTRE chicos del audio 30 (prestigio, pago en coin); 11-oct-2026 |
| Amigos + feed de logros + DMs moderados | ✖ | ✔ real en demo (NPCs con modelo + moderación de ida y salida, solicitudes; aviso al padre de crisis (con el texto del chico: decisión 11-oct), contacto e "insistió". Mensajería en un **dock estilo LinkedIn en toda la app**: barra «Mensajes» con la lista de conversaciones y varias ventanas persistentes entre secciones —la más nueva pegada a la barra—, cada una con minimizar/cerrar, no leídos al estar minimizada y reparto del ancho sin scroll lateral; 9-oct-2026). **Modelo nuevo (tanda F2, 12-oct; pedido de Esteban: "Amigos no tiene que estar")**: Amigos dejó de ser sección (`/amigos` → Feed) y los amigos VIVEN en el dock —el perfil de cada uno (racha, liga, cursos en común, su ropa y "Regalale ropa") se abre desde su ventana (ⓘ o su nombre)—; las solicitudes entrantes llegan como **destacado en la zona pinneada del Feed** ("X quiere contactarse con vos", Aceptar / "Ahora no" ahí mismo; aceptar abre su conversación) y a la gente se la **busca por nombre de usuario** en **Buscar → Personas** (parcial, sin mayúsculas ni acentos; de cada chico solo nick y estado) con "Quiero contactarlo" → solicitud saliente que en el demo el NPC acepta solo a los segundos (su conversación llega minimizada con su saludo). Falta: solicitudes reales entre familias (con aprobación del padre según la edad), que el padre vea a quién le pidió contacto el chico y los permisos por edad del §8 |
| Avatar + guardarropas | prototipo (`avatar-lab`, `voice-server`) | parcial-fuerte (look ELEGIBLE: 16 personajes dibujados en SVG propio —sin assets externos— × 8 colores, o iniciales; lo elige el chico desde su tarjeta de perfil y persiste en `server/data/identity.json`. Avatares en todo el demo —amigos, solicitud, dock de mensajes, detalle, ligas/zona/país, feed—: el look de los demás sale de un hash estable del nick, ~80% personaje y ~20% iniciales. **Guardarropas** (audios 26, 29, 41-42; 11-oct-2026): 6 prendas DIBUJADAS que calzan en los 16 personajes (gorra, vincha deportiva, moño, anteojos de sol, auriculares, corona; 80–300 ⚡) que se compran con Energy Coin en la Tienda ("Ropa para tu avatar", ítems de plataforma: entrega instantánea, sin canje pendiente) y se eligen desde "Tu avatar" (las no compradas, con candado → Tienda) o con "Ponérsela"; la puesta se ve en la barra, la fila "Vos" de Ligas y el dock. **Regalos**: "🎁 Regalar" a un amigo (también "Regalale ropa" desde su perfil, que desde el 12-oct se abre en el dock) → el NPC se la pone (en el dock y en su perfil) y agradece en su hilo. **Emblema de liga**: la medallita de la semana pasada sobre el avatar de la tarjeta de perfil ("tu prestigio se nota"). FLAG para Esteban: compras y regalos viven en RAM (recargar = guardarropas vacío y NPCs sin regalo) pero el look EQUIPADO persiste en identity.json — tras recargar Ian puede seguir con la gorra puesta sin tenerla en el guardarropas (decisión del coordinador: confirmar o cambiar). Con la Tienda cerrada por horario, "Tu avatar" lo dice con un aviso suave ("tu ropa te espera ✨") en vez de un error (14-oct). Falta: estilos por edad que habilite el padre, ropa por IA generativa (la apuesta del §9), la ropa de los amigos en el feed y en Ligas, que los NPCs se vistan solos y la lista de deseos para ropa) |
| Admin parental (listas, reglas, modo prueba) | ✔ completo (el "motor intermedio") | parcial-fuerte (Zona de padres v2 — config VIVA en el server: portón con sesión de API de 15 min, grandes on-off con 403 en Tienda/Chat/Amigos/Ligas, temas blancos (feed 1 de cada 3 + chat) y negros (jueces + feed + frase exacta) de la familia, palabras de la familia sumadas a las de fábrica, topes de volumen del MiniPlayer, avisos (crisis con el texto del chico —decisión 11-oct—, contacto, "insistió"), premios, actividad y protecciones; la zona horaria de la familia (14-oct) y la misma sesión del portón para la ingesta de YouTube y Profesores. Falta: sitios/reglas de dominio/prompts de la familia, límites de sesión (los horarios por sección ya están: ver su fila), temas "críticos", cambiar el PIN, modo prueba) |
| Horarios por sección (el "candado por reloj") | ✔ (HORARIOS.md, Feature A: en localStorage, que el chico podía editar) | ✔ real, PORTE EXACTO + el server como candado (W7, 12-oct): Zona de padres → Límites → «Horarios por sección»: por sección (Chat, Buscar, MyTube, Aprender, Tienda, Calendario, Mi espacio, After Day) "Restringir … por horario" y, para cada día de lunes a domingo, abierto/cerrado y la franja desde–hasta (cruza la medianoche si hace falta; desde = hasta son las 24 h). Fuera de franja la sección sale del menú y su ruta muestra "Esta parte está descansando ahora. Probá otra opción del menú 🙂" (+ "Se abre de nuevo a las HH:MM." si hoy abre más tarde) con "Ir al Feed"; además el SERVER responde 403 en la API de esa sección (el POC solo la escondía). La franja se evalúa con la hora del server y un tick de 30 s abre y cierra sin recargar. El Feed, el lector y el reproductor no se cierran nunca, y la Zona de padres siempre es alcanzable. Capa independiente del on-off: lo apagado gana. Persistido en `server/data/schedules.json`. Quirk fiel: cerrar la franja no corta el audio de fondo que ya sonaba. **Zona horaria de la familia (14-oct)**: en Límites, arriba de los horarios, el padre elige Automática (la del server) o la de la familia (Argentina, Este/Centro/Montaña/Pacífico de EE.UU., España): las franjas —y la franja del día del Feed— se calculan con esa hora, en el server y en la pantalla del chico. Falta: límites de SESIÓN (los descanso/preaviso/cierre del chat del POC), varias franjas por día (v1 del POC: una) y que el subtítulo del Feed y el reloj de la barra superior usen también la zona de la familia |
| Presets / wizard parental | ✖ | parcial (3 presets honestos que aplican on-off + temas + palabras + topes de una vez —Primeros pasos 3-6, Clásico conservador, Explorador completo— con confirmación de qué cambia; falta el wizard inicial) |
| Wrapper desktop + VPN | ✖ | ✖ |
| NPCs agénticos | ✖ | parcial (14 NPCs con persona, memoria del hilo y respuestas reales: 6 amigos, 1 solicitud entrante y —tanda F2, 12-oct— un pool de 7 chicos que todavía no son amigos de Ian, para encontrar en Buscar → Personas; aceptan solos la solicitud de Ian y saludan con su voz. Botón de demo "Simular NPCs" en Home: los NPCs "viven" un rato —logros coherentes con su perfil (textos de demo de los cursos viejos), rutas compartidas del catálogo real de Learn, y los compañeros de tu tabla suman XP de verdad en Ligas—; falta que vivan solos, sin botón, y que inicien conversaciones) |
| Corpus de currículas escaneadas | ✖ | ✖ |
