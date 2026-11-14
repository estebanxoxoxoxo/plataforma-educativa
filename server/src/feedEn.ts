// i18n (pedido 9-nov): los textos del FEED en inglés, resueltos AL SERVIR. Las fuentes castellanas (friendsFake.NEWS,
// feedMix.NPC_NEWS/NPC_MEDALS, los "por qué" de feedFake, lo que entra en vivo) QUEDAN COMO ESTÁN: los tests las afirman y
// los pools/lo vivo (RAM) las guardan así. GOTCHA: esas constantes se evalúan al importar (fuera de todo pedido), así que
// un L() ahí quedaría clavado en 'es'; por eso la traducción vive acá, como tabla es→en (exactas + plantillas), y feedFake
// la aplica en el punto donde cada ítem sale hacia la respuesta (localizeFeedItem). Lo que no está en la tabla sale como
// vino (castellano): nunca se rompe nada. Nombres propios que NO se traducen: nicks de NPCs, títulos de rutas del catálogo
// y temas que escribió la familia (data). Regla del 9-nov (Esteban: «títulos, subtítulos, descripciones de cualquier card…
// hay que traducirlo»): los NOMBRES DE LIGAS («Liga Cometa» → «Comet League») y el pool de LECTURAS de feedFake (título y
// bajada) también se traducen al servir; los links siguen yendo a donde iban.
import { requestLang } from './requestContext'

/** Frases fijas: noticias de los NPCs (seed y ráfaga), "por qué", rótulos de tiempo y títulos. Clave = el castellano EXACTO. */
const EXACT = new Map<string, string>([
  /* ---- friendsFake.NEWS (las noticias sembradas de los amigos) ---- */
  ['ganó la medalla de oro 🥇 en la Liga Cometa', 'won the gold medal 🥇 in Liga Cometa'],
  ['llegó a una racha de 12 días seguidos practicando', 'hit a 12-day practice streak'],
  ['se ganó la insignia «Placas Tectónicas»', 'earned the “Tectonic Plates” badge'],
  ['compartió la ruta «Cómo funciona el corazón»', 'shared the route “How the heart works”'],
  ['subió a la Liga Estrella ⭐', 'moved up to Liga Estrella ⭐'],
  ['terminó la unidad 1 de Álgebra', 'finished unit 1 of Algebra'],
  ['completó 40 pasos este mes', 'completed 40 steps this month'],
  ['ganó la medalla de bronce 🥉 en la Liga Cometa', 'won the bronze medal 🥉 in Liga Cometa'],
  ['compartió la ruta «Volcanes de Argentina»', 'shared the route “Volcanoes of Argentina”'],
  ['llegó a una racha de 7 días seguidos practicando', 'hit a 7-day practice streak'],
  ['se ganó la insignia «Progresión de Acordes»', 'earned the “Chord Progression” badge'],
  ['se ganó la insignia «Datación por Carbono» en Paleontología 🦴', 'earned the “Carbon Dating” badge in Paleontology 🦴'],
  ['terminó la unidad «Phrasal verbs» de Inglés intermedio', 'finished the “Phrasal verbs” unit of Intermediate English'],
  ['volvió a practicar y arrancó una racha nueva ⚡', 'got back to practicing and started a new streak ⚡'],
  ['se ganó la insignia «Mate en Dos» en Álgebra ♟️', 'earned the “Mate in Two” badge in Algebra ♟️'],
  ['terminó la unidad «Ciclo solar y manchas» de El sistema solar ☀️', 'finished the “Solar cycle and sunspots” unit of The solar system ☀️'],
  ['terminó la unidad «Los planetas gigantes» de El sistema solar 🪐', 'finished the “The giant planets” unit of The solar system 🪐'],
  ['se ganó la insignia «Sistema Circulatorio» en Anatomía 🔬', 'earned the “Circulatory System” badge in Anatomy 🔬'],
  ['terminó la unidad «Song lyrics» de Inglés intermedio 🎧', 'finished the “Song lyrics” unit of Intermediate English 🎧'],
  ['completó 35 pasos este mes ♟️', 'completed 35 steps this month ♟️'],
  ['terminó la unidad «Ecuaciones lineales» de Álgebra 🤖', 'finished the “Linear equations” unit of Algebra 🤖'],
  ['se ganó la insignia «Fases y Eclipses» en El sistema solar 🌕', 'earned the “Phases and Eclipses” badge in The solar system 🌕'],
  ['terminó la unidad «El sistema nervioso» de Anatomía 🧠', 'finished the “The nervous system” unit of Anatomy 🧠'],
  ['practicó con un beat lofi de fondo y no cortó su racha 🎶', 'practiced with a lofi beat in the background and kept the streak going 🎶'],
  ['se ganó la insignia «Conversación Fluida» en Inglés intermedio 🌠', 'earned the “Fluent Conversation” badge in Intermediate English 🌠'],
  ['ganó la medalla de oro 🥇 en la Liga Cometa y subió a la Liga Estrella ⭐', 'won the gold medal 🥇 in Liga Cometa and moved up to Liga Estrella ⭐'],
  ['ganó la medalla de bronce 🥉 en la Liga Chispa y subió a la Liga Cometa ☄️', 'won the bronze medal 🥉 in Liga Chispa and moved up to Liga Cometa ☄️'],

  /* ---- feedMix.NPC_NEWS (la ráfaga de "Simular NPCs") ---- */
  ['se ganó la insignia «Órbita de Transferencia» en El sistema solar 🚀', 'earned the “Transfer Orbit” badge in The solar system 🚀'],
  ['terminó la unidad «Cometas y asteroides» de El sistema solar ☄️', 'finished the “Comets and asteroids” unit of The solar system ☄️'],
  ['completó 25 pasos esta semana', 'completed 25 steps this week'],
  ['se ganó la insignia «Anillos de Saturno» en El sistema solar 🪐', 'earned the “Rings of Saturn” badge in The solar system 🪐'],
  ['terminó la unidad «Icnitas: leer huellas fósiles» de Paleontología 🦕', 'finished the “Ichnites: reading fossil footprints” unit of Paleontology 🦕'],
  ['practicó antes del desayuno y no cortó su racha 🌅', 'practiced before breakfast and kept the streak going 🌅'],
  ['se ganó la insignia «Ecolocalización» en Biología marina 🐋', 'earned the “Echolocation” badge in Marine biology 🐋'],
  ['terminó la unidad «Cefalópodos» de Biología marina 🐙', 'finished the “Cephalopods” unit of Marine biology 🐙'],
  ['llegó a 8 días seguidos practicando 🔥', 'hit 8 days of practice in a row 🔥'],
  ['se ganó la insignia «Magma y Placas» en Geología 🌋', 'earned the “Magma and Plates” badge in Geology 🌋'],
  ['terminó la unidad «Migración de las tortugas marinas» de Biología marina 🐢', 'finished the “Sea turtle migration” unit of Marine biology 🐢'],
  ['completó 30 pasos esta semana', 'completed 30 steps this week'],
  ['llegó a 3 semanas de racha: 21 días seguidos 🔥', 'hit a 3-week streak: 21 days in a row 🔥'],
  ['se ganó la insignia «Despeje Perfecto» en Álgebra 🔑', 'earned the “Perfect Solve” badge in Algebra 🔑'],
  ['terminó la unidad «Inecuaciones» de Álgebra', 'finished the “Inequalities” unit of Algebra'],
  ['se ganó la insignia «Estratigrafía» en Paleontología 🦴', 'earned the “Stratigraphy” badge in Paleontology 🦴'],
  ['terminó la unidad «El Cretácico» de Paleontología 🦖', 'finished the “The Cretaceous” unit of Paleontology 🦖'],
  ['practicó todos los días de la semana, otra vez 📅', 'practiced every day of the week, again 📅'],
  ['se ganó la insignia «Past Perfect» en Inglés intermedio 📘', 'earned the “Past Perfect” badge in Intermediate English 📘'],
  ['terminó la unidad «Conditionals» de Inglés intermedio: if I were you…', 'finished the “Conditionals” unit of Intermediate English: if I were you…'],
  ['arrancó una racha: 3 días seguidos practicando ✨', 'started a streak: 3 days of practice in a row ✨'],
  ['se ganó la insignia «Storyteller» en Inglés intermedio ✍️', 'earned the “Storyteller” badge in Intermediate English ✍️'],
  ['terminó la unidad «Movies & Series» de Inglés intermedio 🎬', 'finished the “Movies & Series” unit of Intermediate English 🎬'],
  ['completó 12 pasos esta semana 🌟', 'completed 12 steps this week 🌟'],
  ['terminó la unidad «Expresiones algebraicas» de Álgebra ⚡', 'finished the “Algebraic expressions” unit of Algebra ⚡'],
  ['ya lleva 2 días seguidos practicando', 'has practiced 2 days in a row now'],
  ['se ganó la insignia «Rayo Algebraico» en Álgebra ⚡', 'earned the “Algebra Lightning” badge in Algebra ⚡'],
  ['completó 10 pasos esta semana ⚽', 'completed 10 steps this week ⚽'],
  ['se ganó la insignia «Ritmo Cardíaco» en Anatomía ❤️', 'earned the “Heart Rate” badge in Anatomy ❤️'],
  ['terminó la unidad «La Luna» de El sistema solar 🌙', 'finished the “The Moon” unit of The solar system 🌙'],
  ['llegó a 5 días seguidos practicando 🔥', 'hit 5 days of practice in a row 🔥'],
  ['terminó la unidad «El sistema óseo» de Anatomía 🦴', 'finished the “The skeletal system” unit of Anatomy 🦴'],
  ['se ganó la insignia «Estetoscopio de Oro» en Anatomía 🩺', 'earned the “Golden Stethoscope” badge in Anatomy 🩺'],
  ['completó 18 pasos esta semana', 'completed 18 steps this week'],
  ['se ganó la insignia «Sistemas de Ecuaciones» en Álgebra 🤖', 'earned the “Systems of Equations” badge in Algebra 🤖'],
  ['terminó la unidad «Sondas y satélites» de El sistema solar 🛰️', 'finished the “Probes and satellites” unit of The solar system 🛰️'],
  ['llegó a 4 días seguidos practicando 🔧', 'hit 4 days of practice in a row 🔧'],
  ['terminó la unidad «Funciones lineales» de Álgebra 📏', 'finished the “Linear functions” unit of Algebra 📏'],
  ['se ganó la insignia «Rover Explorador» en El sistema solar 🛰️', 'earned the “Explorer Rover” badge in The solar system 🛰️'],
  ['se ganó la insignia «Cazadora de Planetas» en El sistema solar 🪐', 'earned the “Planet Hunter” badge in The solar system 🪐'],
  ['observó con su telescopio y no cortó su racha 🔭', 'stargazed with her telescope and kept the streak going 🔭'],
  ['terminó la unidad «Las constelaciones» de El sistema solar ✨', 'finished the “The constellations” unit of The solar system ✨'],
  ['completó 22 pasos esta semana 💫', 'completed 22 steps this week 💫'],
  ['se ganó la insignia «Lyrics Translator» en Inglés intermedio 🎼', 'earned the “Lyrics Translator” badge in Intermediate English 🎼'],
  ['completó 20 pasos esta semana', 'completed 20 steps this week'],
  ['terminó la unidad «Listening: podcasts» de Inglés intermedio 🎧', 'finished the “Listening: podcasts” unit of Intermediate English 🎧'],
  ['llegó a 6 días seguidos practicando 🎶', 'hit 6 days of practice in a row 🎶'],
  ['se ganó la insignia «Jaque al Álgebra» en Álgebra ♟️', 'earned the “Check on Algebra” badge in Algebra ♟️'],
  ['llegó a 9 días seguidos practicando ♟️', 'hit 9 days of practice in a row ♟️'],
  ['terminó la unidad «Factorización» de Álgebra 🧩', 'finished the “Factoring” unit of Algebra 🧩'],
  ['se ganó la insignia «Ilustración Científica» en Biología marina 🐢', 'earned the “Scientific Illustration” badge in Marine biology 🐢'],
  ['terminó la unidad «Arrecifes de coral» de Biología marina 🐠', 'finished the “Coral reefs” unit of Marine biology 🐠'],
  ['llegó a 4 días seguidos practicando 🎨', 'hit 4 days of practice in a row 🎨'],
  ['terminó la unidad «Dinosaurios con plumas» de Paleontología 🐦', 'finished the “Feathered dinosaurs” unit of Paleontology 🐦'],
  ['llegó a 11 días seguidos practicando 🔥', 'hit 11 days of practice in a row 🔥'],
  ['se ganó la insignia «Ojo de Halcón» en Paleontología 🦅', 'earned the “Hawk Eye” badge in Paleontology 🦅'],
  ['se ganó la insignia «Golazo Algebraico» en Álgebra ⚽', 'earned the “Algebra Golazo” badge in Algebra ⚽'],
  ['terminó la unidad «Sports commentary» de Inglés intermedio ⚽', 'finished the “Sports commentary” unit of Intermediate English ⚽'],
  ['llegó a 3 días seguidos practicando', 'hit 3 days of practice in a row'],
  ['se ganó la insignia «Bioquímica» en Anatomía 🧪', 'earned the “Biochemistry” badge in Anatomy 🧪'],
  ['terminó la unidad «El sistema respiratorio» de Anatomía 🌬️', 'finished the “The respiratory system” unit of Anatomy 🌬️'],
  ['llegó a 5 días seguidos practicando 🧪', 'hit 5 days of practice in a row 🧪'],

  /* ---- feedMix.NPC_MEDALS (medallas de liga de la ráfaga) ---- */
  ['festeja su medalla de bronce 🥉 de la Liga Cometa: esta semana va por más 🚀', 'is celebrating the bronze medal 🥉 from Liga Cometa: going for more this week 🚀'],
  ['colgó en su perfil la medalla de plata 🥈 de la Liga Chispa: ya compite en la Liga Cometa ☄️', 'pinned the silver medal 🥈 from Liga Chispa on their profile: now competing in Liga Cometa ☄️'],
  ['ya compite en la Liga Estrella ⭐ con la medalla de oro 🥇 que ganó en la Liga Cometa 🦴', 'is now competing in Liga Estrella ⭐ with the gold medal 🥇 won in Liga Cometa 🦴'],
  ['estrena la Liga Cometa ☄️ con la medalla de plata 🥈 que ganó en la Liga Chispa 🌙', 'is starting out in Liga Cometa ☄️ with the silver medal 🥈 won in Liga Chispa 🌙'],
  ['festeja su medalla de oro 🥇 de la Liga Chispa con un beat nuevo: ya está en la Liga Cometa ☄️ 🎹', 'is celebrating the gold medal 🥇 from Liga Chispa with a new beat: now in Liga Cometa ☄️ 🎹'],
  ['anotó en su registro de observación la medalla de bronce 🥉 de la Liga Chispa: ya practica en la Liga Cometa ☄️ 🔭', 'logged the bronze medal 🥉 from Liga Chispa in their stargazing journal: now practicing in Liga Cometa ☄️ 🔭'],
  ['estrena la Liga Estrella ⭐ con su medalla de oro 🥇 de la Liga Cometa ♟️', 'is starting out in Liga Estrella ⭐ with the gold medal 🥇 from Liga Cometa ♟️'],
  ['ya compite en la Liga Cometa ☄️ con la medalla de bronce 🥉 que ganó en la Liga Chispa 🦅', 'is now competing in Liga Cometa ☄️ with the bronze medal 🥉 won in Liga Chispa 🦅'],
  ['festeja su medalla de plata 🥈 de la Liga Chispa: ya compite en la Liga Cometa ☄️ 🧪', 'is celebrating the silver medal 🥈 from Liga Chispa: now competing in Liga Cometa ☄️ 🧪'],

  /* ---- los "por qué" (feedFake: TOPIC_WHY, ARTICLES.why y los fijos) ---- */
  ['Porque te interesa el espacio', 'Because you’re into space'],
  ['Porque te gusta programar', 'Because you like coding'],
  ['Porque jugás al ajedrez', 'Because you play chess'],
  ['Porque estás aprendiendo música', 'Because you’re learning music'],
  ['Porque te interesa la robótica', 'Because you’re into robotics'],
  ['Porque te gusta entender cómo funcionan las cosas', 'Because you like understanding how things work'],
  ['Porque te interesa la historia', 'Because you’re into history'],
  ['Para practicar álgebra mirando', 'To practice algebra by watching'],
  ['Porque te interesa la paleontología', 'Because you’re into paleontology'],
  ['Porque te interesa cómo funciona la Tierra', 'Because you’re into how the Earth works'],
  ['Porque te interesa la biología marina', 'Because you’re into marine biology'],
  ['Porque te gusta saber cómo se inventaron las cosas', 'Because you like knowing how things were invented'],
  ['Porque te gusta experimentar', 'Because you like experimenting'],
  ['Para repasar la base del álgebra leyendo', 'To review the basics of algebra by reading'],
  ['NicoServo hace Álgebra como vos', 'NicoServo is doing Algebra like you'],
  ['Es de tus amigos', 'One of your friends'],
  ['Es una ruta para arrancar algo nuevo', 'A route to start something new'],
  ['Ya la terminaste: podés repasarla', 'You already finished it: you can review it'],
  ['Te la asignaron por tus resultados', 'Assigned to you based on your results'],
  ['Es tu medalla: la ven tus amigos en su feed', 'It’s your medal: your friends see it in their feed'],
  ['Es tu medalla de la semana', 'It’s your medal of the week'],
  ['Sube de liga con vos', 'Moving up a league with you'],
  ['Compitió en tu liga la semana pasada', 'Competed in your league last week'],
  ['Compite en tu liga esta semana', 'Competing in your league this week'],
  ['Es tu medalla nueva', 'It’s your new medal'],
  ['Es tu medalla más reciente', 'It’s your most recent medal'],

  /* ---- títulos y rótulos de tiempo fijos ---- */
  ['Videos para vos', 'Videos for you'],
  ['ahora', 'now'], ['recién', 'just now'], ['hoy', 'today'], ['ayer', 'yesterday'], ['esta semana', 'this week'],
  ['anoche', 'last night'], ['el domingo', 'on Sunday'], ['el domingo pasado', 'last Sunday'], ['la semana pasada', 'last week'],
])

/** Los temas de chico de feedFake.INTERESTS (para "Porque te interesa: …" si alguno cae sin su motivo propio). */
const TOPIC_EN: Record<string, string> = {
  'agujeros negros': 'black holes', 'exploración espacial': 'space exploration', programación: 'programming', ajedrez: 'chess',
  acordes: 'chords', robots: 'robots', 'cómo funciona un motor': 'how an engine works', 'mitología griega': 'Greek mythology',
  álgebra: 'algebra', 'el espacio': 'space', 'la luna': 'the Moon', paleontología: 'paleontology', geología: 'geology',
  'biología marina': 'marine biology', inventos: 'inventions', 'el método científico': 'the scientific method',
}
const MEDAL_EN: Record<string, string> = { oro: 'gold', plata: 'silver', bronce: 'bronze' }
const plural = (n: string, one: string, many: string) => (n === '1' ? one : many)

/** Plantillas (el castellano que arman feedFake, leaguesFake y la ráfaga con datos adentro). Se prueban en orden; la
 *  primera que calza con el texto ENTERO gana. */
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  // "por qué" con dato
  [/^Porque te interesa: (.+)$/, (t) => `Because you’re into: ${TOPIC_EN[t] ?? t}`],
  [/^Porque a tu familia le interesa: (.+)$/, (t) => `Because your family is into: ${t}`],
  [/^Porque estás aprendiendo (.+)$/, (t) => `Because you’re learning ${t}`],
  [/^(.+) quiere ser tu (?:amiga|amigo)$/, (n) => `${n} wants to be your friend`],
  [/^(.+) es tu (?:amiga|amigo)$/, (n) => `${n} is your friend`],
  [/^La empezaste y te (?:queda|quedan) (\d+) postas?$/, (n) => `You started it and have ${n} ${plural(n, 'step', 'steps')} left`],
  [/^La compartió (.+)$/, (n) => `Shared by ${n}`],
  // cierre de liga (feedFake.injectLeagueClose)
  [/^ganó la medalla de (oro|plata|bronce) (\S+) en la (.+?) y subió a la (.+)$/, (m, e, from, to) => `won the ${MEDAL_EN[m]} medal ${e} in ${from} and moved up to ${to}`],
  [/^ganó la medalla de (oro|plata|bronce) (\S+) en tu (.+?) y sube con vos a la (.+)$/, (m, e, from, to) => `won the ${MEDAL_EN[m]} medal ${e} in your ${from} and is moving up with you to ${to}`],
  [/^ganó la medalla de (oro|plata|bronce) (\S+) en tu (.+?) y subió a la (.+)$/, (m, e, from, to) => `won the ${MEDAL_EN[m]} medal ${e} in your ${from} and moved up to ${to}`],
  [/^ganó la medalla de (oro|plata|bronce) (\S+) en tu (.+)$/, (m, e, from) => `won the ${MEDAL_EN[m]} medal ${e} in your ${from}`],
  [/^ganó la medalla de (oro|plata|bronce) (\S+) en la (.+)$/, (m, e, from) => `won the ${MEDAL_EN[m]} medal ${e} in ${from}`],
  // la carrera de tu liga (feedFake.raceText)
  [/^te pasó en la (.+): sumó (\d+) XP y ahora va (\d+)º$/, (l, g, p) => `passed you in ${l}: earned ${g} XP and is now #${p}`],
  [/^sumó (\d+) XP y subió al (\d+)º puesto de tu (.+)$/, (g, p, l) => `earned ${g} XP and climbed to #${p} in your ${l}`],
  [/^metió \+(\d+) XP en tu (.+) esta semana$/, (g, l) => `scored +${g} XP in your ${l} this week`],
  // rótulos de tiempo (feedFake.timeOf y los de leaguesFake si vinieran ya armados)
  [/^hace (\d+) min$/, (n) => `${n} min ago`],
  [/^hace (\d+) h$/, (n) => `${n} h ago`],
  [/^hace (\d+) días$/, (n) => `${n} days ago`],
  [/^hace (\d+) semanas$/, (n) => `${n} weeks ago`],
]

/* ---------- nombres de ligas (leaguesFake.LADDER) ---------- */
export const LEAGUE_EN: Record<string, string> = {
  'Liga Chispa': 'Spark League', 'Liga Cometa': 'Comet League', 'Liga Estrella': 'Star League',
  'Liga Supernova': 'Supernova League', 'Liga Galaxia': 'Galaxy League',
}
const LEAGUE_RE = /\b(in|to|from|of) Liga (Chispa|Cometa|Estrella|Supernova|Galaxia)\b|Liga (Chispa|Cometa|Estrella|Supernova|Galaxia)\b/g
/** Los nombres de liga dentro de un texto YA en inglés ("in Liga Cometa" → "in the Comet League"). */
export const leaguesInEn = (s: string): string =>
  s.replace(LEAGUE_RE, (_m, prep: string | undefined, a: string | undefined, b: string | undefined) =>
    prep ? `${prep} the ${LEAGUE_EN[`Liga ${a}`]}` : LEAGUE_EN[`Liga ${b}`])
/** Un nombre de liga suelto en el idioma del pedido (el campo `name` de una card o un perfil). */
export const leagueName = (name: string): string => (requestLang() === 'en' ? LEAGUE_EN[name] ?? name : name)

/* ---------- el pool de LECTURAS de feedFake.ARTICLES (por URL: título y bajada) ---------- */
export const ARTICLE_EN: Record<string, { title: string; snippet: string }> = {
  'https://es.wikipedia.org/wiki/Apolo_11': { title: 'Apollo 11: the journey to the Moon', snippet: 'The mission that took the first humans to walk on the Moon, in July 1969.' },
  'https://spaceplace.nasa.gov/sun-compare/sp/': { title: 'How our Sun compares to other stars', snippet: 'Our Sun is impressive, but how does it compare to the other stars in the galaxy?' },
  'https://www.esa.int/kids/es/Aprende/Nuestro_Universo/Cometas_y_meteoritos/Estrellas_fugaces': { title: 'Shooting stars', snippet: 'What are shooting stars really, and why do they come in showers?' },
  'https://es.wikipedia.org/wiki/Cintur%C3%B3n_de_asteroides': { title: 'The asteroid belt', snippet: 'Between Mars and Jupiter there are millions of rocks orbiting the Sun.' },
  'https://concepto.de/cometas/': { title: 'What is a comet?', snippet: 'Celestial bodies with a core of ice and dust that grow a bright tail.' },
  'https://es.wikipedia.org/wiki/V%C3%ADa_L%C3%A1ctea': { title: 'The Milky Way', snippet: 'The spiral galaxy where the solar system lives, with hundreds of billions of stars.' },
  'https://es.wikipedia.org/wiki/Tyrannosaurus_rex': { title: 'Tyrannosaurus rex, king of the dinosaurs', snippet: 'One of the biggest meat-eaters ever to walk the Earth: it lived at the end of the Cretaceous.' },
  'https://concepto.de/volcan/': { title: 'What is a volcano?', snippet: 'How they form, what kinds there are, and why some stay asleep for centuries.' },
  'https://concepto.de/tiburon/': { title: 'The great white shark', snippet: 'Where it lives, what it eats, and what one of the ocean’s great hunters is like.' },
  'https://es.wikipedia.org/wiki/Arduino': { title: 'Arduino: the board for building robots', snippet: 'The programmable board used to build robots, lights and sensors: open hardware since 2005.' },
  'https://es.wikipedia.org/wiki/Imprenta': { title: 'The printing press', snippet: 'The invention that made it possible to copy books in large numbers and changed how the world learns.' },
  'https://concepto.de/metodo-cientifico/': { title: 'The scientific method', snippet: 'Observe, ask, test and draw conclusions: the steps of every good experiment.' },
  'https://www.disfrutalasmatematicas.com/fracciones.html': { title: 'Fractions', snippet: 'Numerator, denominator and operations: the foundation all of algebra builds on.' },
  'https://es.wikipedia.org/wiki/Triceratops': { title: 'Triceratops', snippet: 'The three-horned ceratopsian: what its fossils tell us about how it lived.' },
  'https://es.wikipedia.org/wiki/Fase_lunar': { title: 'The phases of the Moon', snippet: 'Why the Moon looks full, half or new over the course of the month.' },
}
/** Título y bajada de una lectura del pool en el idioma del pedido (las que no están en la tabla, tal cual). */
export function articleText<T extends { url: string; title: string; snippet?: string }>(a: T): T {
  const e = requestLang() === 'en' ? ARTICLE_EN[a.url] : undefined
  return e ? { ...a, title: e.title, ...(a.snippet !== undefined ? { snippet: e.snippet } : {}) } : a
}

/** El espacio duro que feedFake.glue pone antes de cada emoji (para buscar en la tabla se vuelve espacio común). */
const NBSP = / /g
const glue = (text: string) => text.replace(/ (?=\p{Extended_Pictographic})/gu, ' ')

/** El texto en inglés si el pedido es en inglés y la tabla lo conoce; si no, el mismo texto. */
export function feedText(s: string): string
export function feedText(s: string | undefined): string | undefined
export function feedText(s: string | undefined): string | undefined {
  if (!s || requestLang() !== 'en') return s
  const glued = s.includes(' ')
  const key = glued ? s.replace(NBSP, ' ') : s
  let out = EXACT.get(key)
  if (out === undefined) {
    for (const [re, fn] of PATTERNS) {
      const m = re.exec(key)
      if (m) { out = fn(...m.slice(1)); break }
    }
  }
  if (out === undefined) out = key
  out = leaguesInEn(out)
  if (out === key) return s
  return glued ? glue(out) : out
}
