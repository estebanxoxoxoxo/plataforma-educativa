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
   chico se suscribió, sus playlists. (Existe en la POC de Smarty; no está en la UI nueva.)
3. **Feed de descubrimiento** (la home): recomendaciones de contenido según el algoritmo
   configurado por el padre + los intereses del chico, **y además** las noticias sociales (logros de
   amigos, cierres de liga, rutas compartidas) con reacciones por emoji, estilo LinkedIn. **No
   existe todavía en ningún lado y es la pieza de UX central.**
4. **Chat de IA seguro** (súper prompteado, con herramientas de búsqueda) — existe y ya corre con el
   pipeline real de moderación.

## 4. Conservar y volver al contenido

- **Drive**: carpetas y subcarpetas para investigaciones escolares; todo lo encontrado (por feed,
  chat, buscador o índices) se puede guardar ahí. (Hecho en Smarty.)
- **Suscripciones a canales** y **playlists propias**. (Hecho en Smarty: MyTube y "Mis listas".)
- **Reproductor en segundo plano**: la plataforma es también el reproductor de música del chico
  (la música vive en YouTube), más ruido blanco/rosa/marrón y lluvia para concentrarse. (Hecho en
  Smarty.)

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
| 4. Competencia | **Ligas**: se **asignan según los resultados del chico** (no se eligen), 10–15 puestos, cierre semanal, medallas (1º/2º/3º) que aparecen en el feed de tus amigos. Además, con el puntaje el chico tiene un **puesto nacional y uno de su zona**. Desafío matemático ya analizado alguna vez: **todo chico debe tener siempre una liga donde pueda ser competitivo**. Las ligas son la puerta por la que el chico descubre que hay otra gente en la plataforma. *(Precisión de Esteban, 8-oct-2026.)* |
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
| MyTube (suscripciones, canales) | ✔ | ✖ (solo búsqueda en catálogo) |
| Playlists del chico | ✔ ("Mis listas") | ✖ |
| Drive (carpetas) | ✔ | ✖ |
| Música de fondo + ruidos | ✔ | ✖ |
| Feed (descubrir + social) | ✖ | ✖ — **pieza central faltante** |
| Rutas desde contenido + facts verificados | parcial (learnRoutes en el backup; el generador "route lab" no está en el snapshot) | parcial (cursos con contenido real + temario generado por tema) |
| Active Recall | ✖ | ✖ |
| Simulaciones integradoras | ✖ | ✖ |
| Matemática determinista | ✖ | ✖ |
| Música adaptativa | ✔ prototipo (`audio-lab`) | ✖ |
| Energy Coin + billetera + marketplace | ✖ | ✖ (solo XP visual) |
| Ligas semanales por coin + equipos | ✖ | parcial (liga asignada por resultados + tablas de zona y país, con datos fake; sin ciclos reales ni equipos) |
| Amigos + feed de logros + DMs moderados | ✖ | maqueta (la moderación en tiempo real ya existe en el backend) |
| Avatar + guardarropas | prototipo (`avatar-lab`, `voice-server`) | ✖ |
| Admin parental (listas, reglas, modo prueba) | ✔ completo (el "motor intermedio") | ✖ (se importa su config por backup) |
| Presets / wizard parental | ✖ | ✖ |
| Wrapper desktop + VPN | ✖ | ✖ |
| NPCs agénticos | ✖ | ✖ |
| Corpus de currículas escaneadas | ✖ | ✖ |
