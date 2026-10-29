# U5 — La liga de la familia completa + las medallas de la plataforma

> Spec del arquitecto (28-oct-2026). SOLO LECTURA del repo: al escribirla, nada de esto estaba implementado (hoy lo está: lo
> HECHO, con sus desvíos, vive en `docs/USUARIOS.md` §12). Contratos ADITIVOS sobre lo que
> dejaron U3/U4/F1/F2 (ninguna forma HTTP existente cambia de significado). Sigue el patrón del demo: fake en el server,
> economía en RAM por usuario (regla 9 de `docs/AGENTS.md`), el ciclo semanal con UNA sola fuente (regla 7).

## 0. Qué hay hoy, qué pide la visión, qué leí

**Hoy (U4, `docs/USUARIOS.md` §10).** `GET /api/leagues/family` → `FamilyLeague` = los integrantes de la familia de quien
mira (`familyOf`: grandes y chicos, salvo chicos con Ligas apagadas) ordenados por XP de la semana → racha → seed, con su
avatar elegido. La solapa **Familia** de `/ligas` (`FamilyRanking.tsx`) la pinta con medallita 1-3, "✨ N días" y la XP. NO es
una liga de la escalera: sin NPCs, sin cierre, sin premio; "vuelve a cero el lunes con la XP". El "Simular cierre de semana"
cierra SOLO la liga pública del activo (U4 A6) y, de rebote, le pone su XP en 0 también en la tabla de la familia. Decisión D2
de U4: "premio de la semana, retos 1 a 1 y cierre con medalla de la familia: U5". `requestContext.runAsUser(id, fn)` ya existe
"para el cierre de toda la familia en U5".

**La visión (audios 1006-1011 y 1016; no todo está en `VISION.md`).**
- 1008: "ganame la racha de esto y te compro una bicicleta… ganame la energía que generás en la semana… si el padre quiere que
  el otro empuje, va a empujar también. Esa es una forma de compañía".
- 1009: competir por rachas entre hermanos/primos (David con 1.000 días de Duolingo → Josie se pone a estudiar coreano).
- 1010-1011: "podemos estar los tres, cada uno aprendiendo lo que le toca… una liga donde competimos"; los padres se suman; "el
  que gana… al final de la semana se lleva determinada cosa especial"; es remoto ("el padre practica al mediodía, el hijo en otro
  horario") y es "una forma de comunicarse y hacer algo en familia".
- 1006: premios de dinámica familiar: elegir el programa, la pijamada, quién trae amigos, "¿a quién le toca?".
- 1016: medallas estilo GitHub por logros de USO (primera ruta agregada, primer amigo) y de DESEMPEÑO; un diccionario inicial;
  en el perfil la CANTIDAD y, al abrir el detalle, "la pila de medallas como quien muestra un diploma".
- 1013-1015 (contexto): "la visibilización del mérito es lo que nos lleva a las medallitas"; el prestigio tiene sentido si otros
  lo ven.

**La evidencia (`smarty-poc/research/gamificacion/00-sintesis.md` + `07-ligas-competencia.md` + `08-rachas-habitos.md`).** Las
piezas que tocan U5: **G2** (premio escaso d = −0,88 vs máximo alcanzable −0,15, peor en chicos), **G3** (no premiar la
participación), **G4** (lo inesperado no daña: +0,01; lo anunciado −0,36), **G6/G7** (ningún número visible baja; nada que se
pueda perder; mostrar la racha rota REDUCE la conducta futura —Silverman & Barasch—), **G9** (feedback sí, ranking no), **G10**
(cooperación con objetivo > competencia entre chicos: 0,46), eje **K** (Personal Best: 61.879 alumnos, "sin víctimas") y la
inferencia de 07 §2.6: "si la métrica del ranking es una cantidad, el que tiene más tiempo libre gana; la única salida limpia es
rankear por algo no acumulable (mejora relativa, consistencia)", eje **L** ("una colección con huecos es una pérdida latente
disfrazada de logro"), mecánica descartada **lootbox / magnitud aleatoria**, y la tensión 10 ("un padre que ata EC a las notas
recrea el peor caso"). Ojo: 07 §6 (pregunta 4) deja abierta justo nuestra pregunta ("¿un equipo de dos se puede hacer con
hermanos?") y M dice que NO hay un solo estudio sobre premios mediados por padres en un producto digital: acá diseñamos con
inferencia, no con datos. Y la síntesis §5 pone "insignias como sistema paralelo al progreso de rutas" entre las descartadas:
las medallas del §5 se diseñan para NO ser eso (§5.1).

**Código leído** (para el mapa del §7; validado el 28-oct contra el árbol de trabajo, con lo de U4/F1/F2 sin commitear):
`server/src/{leaguesFake,leaguePools,progress,market,parent,identity,users,requestContext,perUser,feedFake,learnResults,
learnRoutes,learnProgress,space,friendsFake,schedule,index}.ts`, `src/sections/leagues/**`, `src/shared/components/
{ProfileCard,Avatar,TopBar,Sidebar}.tsx` (la medallita de liga vive en `ProfileCard.tsx` —`useLastMedal` + `.idav-medal` de
`avatar.css`—, no en `Avatar.tsx`), `src/api/types.ts`, `src/api/index.ts`, `src/sections/store/{containers/StorePage,
cards/RedemptionRow}.tsx`, `src/sections/parent/{containers/RewardsPanel,cards/DeliveryRow,components/ActivityPanel}.tsx`.
Datos reales (solo lectura, 28-oct): `learn-results.json` tiene UNA fila completada de Ian (perfecta) y ninguna de Luna ni de
Andrés; `space.json`, un guardado de Ian. Lo usa el seed de medallas (§5.4).

**Qué NO cambia.** La escalera pública (Chispa…Galaxia), sus 12 por tabla, su cierre individual y sus medallas oro/plata/bronce;
el orden de la tabla de la familia (XP → racha → seed, U4 D2); la Tienda (precios, canjes, stock, wishlist); los seeds de U4
(Ian 1.240 · Luna 1.290 · Andrés 450 de XP semanal). Sin archivos persistidos nuevos ni migraciones (ver D3): lo único
persistido que cambia es un campo ADITIVO opcional, `createdBy`, en las filas nuevas de `learn-routes.json` (§7.1), y —revisión
de U5— otro igual, `createdAt` (la fecha de la PRIMERA importación, la de «Tu primera ruta»: una reimportación no la mueve;
solo en filas con autor, así la seed y las filas de antes de U5 quedan idénticas en disco; no se sirve).

---

## 1. Visión y evidencia, reconciliadas pieza por pieza

La tesis que ordena todo: **la liga de la familia no es el ranking público entre desconocidos.** Son 2-6 personas que se
conocen, conviven, y una de ellas (el adulto) media el premio en persona; la comparación ya existe en la mesa de la cocina. La
evidencia que descarta las ligas (Kloc, Deci, BFLPE) está medida sobre cohortes de desconocidos con premio de plataforma: no se
transfiere entera, pero sus MECANISMOS sí (escasez, miedo a quedar último, mostrar la rotura, la cantidad que premia al que tiene
más tiempo). Entonces: se conserva la dinámica que pide la visión y se le saca cada mecanismo dañino que la evidencia identifica,
uno por uno. Lo que se resigna queda escrito.

| La visión pide | Lo que dice la evidencia | Qué hace U5 | Qué se resigna |
|---|---|---|---|
| "El que gana la semana se lleva algo especial" (1011), "ganame… y te compro una bici" (1008) | Premio escaso = −0,88 (G2), peor en chicos; una tabla de 9, 12 años y un adulto por XP la gana casi siempre el mayor (07 §2.6: la cantidad premia al que tiene más tiempo) | El 1.º se lleva la **copa de la semana 🏆** (simbólica; no "corona": 👑 Corona es una prenda de 300 ⚡ de la Tienda y un chico podría creer que se compra) y, si el padre quiso, el premio. Pero el premio tiene DOS condiciones y el padre elige: **"el que gane la semana"** (la visión, escasa) o **"todos los que superen su propia semana"** (Personal Best: alcanzable por todos, justo entre edades). Recomendación: arrancar preseleccionada la segunda (D1) | Con "supera su semana" se pierde el "uno solo gana"; con "gana la semana" se acepta a conciencia la fila −0,88, mediada por el padre |
| "¿Y los demás?" | Lo que mueve un ranking es el miedo al último puesto (Kloc: la distancia al de abajo pesa ~5× la del de arriba, 0,275 vs 0,050); Personal Best "sin víctimas" | Al cerrar, NADIE recibe nada negativo: no hay "último", ni puesto en el resumen salvo la copa. Cada uno puede ganar marcas **alcanzables por todos**: ↑ "superó su semana" y ✨ "aprendió los 7 días". Y una línea cooperativa: "Entre todos sumaron 2.980 XP" (G10, feedback sin premio) | La tabla en vivo conserva los puestos (contrato U4); el resumen del cierre, no |
| "Competir por rachas" (1009), "ganame la racha" (1008) | La racha diaria que vuelve a 1 y se MUESTRA rota baja la conducta (G7, Silverman & Barasch: 57,9 % vs 66,2 %); Friend Streak = presión de "no fallarle al otro" (08 §2.3); Strava usa ventana SEMANAL y un día malo no cuesta nada | El reto es **"¿Quién aprende más días esta semana?"**: días con algo nuevo aprendido, de 0 a 7, que solo SUBE dentro de la semana, arranca de cero cada lunes y se dibuja como puntitos llenos SIN marcar qué día faltó. Sin premio propio (G9: es feedback); la marca ✨ al 7 de 7 | El "días seguidos" literal del audio (D2 deja la alternativa "mejor tramo de la semana", también monotónica). La racha ✨ de U4 sale de la fila de la familia (sigue en el Feed y en la API) |
| Premios de dinámica familiar (1006: pijamada, elegir el programa) | Recompensa de magnitud aleatoria = prohibida (lootbox; Brasil, UE); "nunca la moneda compra aprendizaje" (G12); el padre que ata premios a notas = coerción (tensión 10) | El premio es un TEXTO fijo del padre (los premios de la Tienda ya lo son: "Elegís la película del viernes", "Día sin tender la cama"), elegido de SUS premios o escrito; sin ⚡ de por medio, sin sorteo, sin magnitud variable; la plataforma lo REGISTRA y el padre lo ENTREGA (el "Entregado" de siempre). Solo condiciones positivas: no hay "si no…" ni quita | El padre no puede atar el premio a "notas" ni a otra cosa fuera de la semana de la familia (no le damos el instrumento) |
| "Los padres se suman" (1010-1011), "compañía" (1008) | Cooperación > competencia (G10); el equipo protege si no tiene poder de sanción (07 §2.5) | El adulto juega la tabla y puede ganar la copa; el PREMIO es solo para los chicos (si gana el adulto, el premio va al chico mejor ubicado: el padre "empuja", no le saca el premio a sus hijos). La línea "Entre todos" es el objetivo común | No hay "meta de la familia" con premio colectivo en U5 (queda como candidata U6: es lo de más evidencia, pero suma una perilla) |
| Medallas estilo GitHub (1016), "la pila como un diploma" | Insignias + leaderboard: competencia percibida η² .020, autonomía nada (Sailer); colección con huecos = pérdida latente (L); premiar participación −0,40 (G3); lo inesperado no daña (G4) | **13 medallas** de uso, aprendizaje, constancia y semana; el catálogo NO se muestra nunca: se ven SOLO las ganadas (sin "3 de 13", sin siluetas, sin barras de "te falta…") → son sorpresas (G4) y no hay huecos (L). No pagan ⚡ ni se pueden conseguir gastando ⚡ (G3/G12: por eso no hay medalla de "primer regalo"). No destraban nada ni duplican el mapa de rutas: no son un "sistema paralelo al progreso" (síntesis §5). Una vez ganada, no se pierde (G7). Texto informativo ("Completaste tu primera posta"), nunca "¡sos un genio!" (eje P) | Sin "próximas medallas" como gancho; sin ranking de medallas entre hermanos; sin "estilos de avatar por nivel de medallas" (1015: convertiría la pila en progresión con huecos; queda para después) |
| "El prestigio tiene sentido si otros lo ven" (1014-1015) | Visibilidad cruzada off por defecto en menores (eje N); NPC en superficie competitiva = Papaya (G11) | En U5 las medallas se ven en TU perfil, en TU feed (una noticia propia, sin reacciones ni festejos de NPCs: no es la medalla de liga "que ven tus amigos") y el adulto ve las de cada chico en Familia → Actividad. Los hermanos NO ven la pila del otro (no existe esa superficie; sería otra comparación) | El "mirá las medallas de tu hermano" queda para cuando haya perfil de otro usuario real |

Dos tensiones que NO se resuelven y se eligen a conciencia (síntesis §4): **(1)** el premio del padre es una recompensa ANUNCIADA
(−0,36 aunque sea alcanzable): la Tienda ya lo es por definición y la visión la quiere; lo que U5 controla es que no sea escasa
por defecto ni aleatoria. **(2)** la competencia intrafamiliar puede ser presión en casa: la mitigación es de diseño (nada se
pierde, nadie queda último en el resumen, el reto es alcanzable por todos) y de control (todo cuelga de **Ligas**, que el padre
apaga por chico). En el producto real (DSA, G15) Ligas debería nacer APAGADA para menores; en el demo sigue prendida (no es de U5).

---

## 2. El cierre semanal de la liga de la familia

### 2.1 La semana y su estado

- **Semana** = lunes 00:00 → domingo 23:59 en la ZONA HORARIA DE LA FAMILIA (`parent.json` `tz`; null = la del server): la MISMA
  que ya cortan la XP (`progress.familyWeekStart`) y el ciclo público (`leaguesFake.weekdayOf`). Nada de calendarios nuevos.
- **De quién es el estado**: de la FAMILIA, una vez. Clave = `familyKeyOf(userId)` (nuevo en `users.ts`): el id del primer
  adulto guardián en el orden del seed (para un adulto, él mismo; un chico sin guardián, él mismo). En el seed: `andres`.
- **Dónde vive**: en `leaguesFake.ts` (regla 7: el ciclo semanal tiene UNA fuente). La lógica PURA del cierre (ordenar, marcas,
  ganadores del premio, coherencia de los seeds) va aparte, en `server/src/familyWeek.ts`, sin estado ni imports de módulos con
  estado, con tests. El estado: RAM de la familia (`Map<familyKey, FamilyWeekState>`):
  `{ key, weekStart /* día del lunes de la semana ABIERTA */, week /* 0 = la del seed */, closedAt /* null = calendario real */,
  prize: FamilyWeekPrize | null, history: FamilyWeekClosed[] /* el más nuevo primero, tope 8 */,
  crowns: Record<userId, number> /* copas ganadas: contador MONOTÓNICO, no se recorta con el tope del historial */ }`.
- **Reset**: como los AVISOS al padre (USUARIOS §7: de la familia; eran RAM y desde FS-BASE-A persisten en `alerts.json`), el
  F5 de UN integrante NO toca el estado de la familia (si no, la recarga de Ian le borraría a Luna el historial y el premio
  que puso Andrés). Lo vuelven al seed `POST /api/demo/reset {scope:'all'}` (QA) y reiniciar el server. Ver el borde del §2.7.

### 2.2 Qué calcula un cierre (puro: `familyWeek.closeFamilyWeek`)

Entrada: las filas de la tabla de la semana que termina (los MISMOS integrantes que `familyLeague()`: adultos + chicos con Ligas
prendidas), cada una con `xp` (la de la semana), `days` (días con aprendizaje nuevo, §4), `prevXp` (la XP de SU semana anterior:
`progress.weekFactsOf(id).lastWeek?.xp`, null si no hay) y el premio vigente. Salida: un `FamilyWeekClosed`.

1. **Orden**: el de la tabla en vivo (XP → racha → seed, U4 D2). No se muestra como podio en el resumen.
2. **Marcas** (`FamilyWeekMark`, puede haber varias por fila):
   - `gano` 🏆 → SOLO el 1.º, y solo si sumó algo (`xp > 0`) y la tabla tiene ≥ 2 filas (si nadie sumó, no hay copa: "Nadie
     sumó esta semana").
   - `supero` ↑ → quien sumó MÁS que su semana anterior: `prevXp !== null && xp > prevXp` (sin semana anterior registrada no hay
     contra qué compararse: la primera semana fija la marca, no la supera; con `prevXp = 0` —estuvo y no sumó— cualquier XP la
     supera). Alcanzable por todos, adulto incluido.
   - `siete` ✨ → quien aprendió algo nuevo los 7 días (`days === 7`). Alcanzable por todos.
   Lo que NO existe: "último", "bajó", "perdió", diferencias negativas, puestos del 2 para abajo en el resumen.
3. **Total** = la suma de la XP de todos (la línea cooperativa "Entre todos sumaron N XP").
4. **Premio** (§3.4): ganadores según la condición, SOLO entre los CHICOS de la tabla (`kind:'child'`).
5. **Medallas** (§5): NO se "entregan" desde acá: se DERIVAN de hechos (§5.3). El cierre solo actualiza los hechos —`crowns[uid]++`
   para el de la copa; y el corte de semana de cada uno en `progress.ts` (`rollWeek`/`startNewWeek`) suma `pbWeeks` si superó su
   semana y `fullWeeks` si aprendió los 7 días— y después corre `syncMedals(uid)` de cada integrante. Como los contadores de
   `progress.ts` se mueven en TODO corte de semana, el cierre de la familia, el cierre individual de "Mi liga" y el lunes real
   dicen lo mismo.

### 2.3 Qué pasa el lunes de verdad (cierre real, perezoso)

El demo casi nunca cruza un lunes con el server prendido, pero la respuesta tiene que ser honesta y la tabla de la familia es
REAL (personas reales, sin NPCs): se cierra de verdad.

- `progress.ts` deja de PERDER la semana al cortar: `rollWeek` hoy pone `xpWeek = 0` sin guardar nada (verificado); con U5
  guarda antes `lastWeek = { weekStart: store.weekStart /* el lunes de la semana que cierra, aunque haya sido hace varias */,
  xp, days }` y mueve los contadores de medallas (`pbWeeks`, `fullWeeks`, §5.3); su `startNewWeek` (el cierre simulado), lo
  mismo. Es lo único que hacía falta para poder cerrar después.
- `leaguesFake.familyCloseIfDue(viewerId)`: si el estado de la familia NO tuvo cierre simulado (`closedAt === null`) y el lunes de
  la familia ya pasó (`thisWeek > weekStart`), cierra la semana ABIERTA de la familia (`weekStart`): fuerza el `rollWeek` de cada
  integrante (`weekXpOf(id)`) y toma su `lastWeek` si `lastWeek.weekStart === weekStart` (si no —ese integrante no había
  arrancado esa semana—, entra con 0); reparte (copa, premio) y deja `weekStart = thisWeek`. Si pasaron varias semanas sin que
  nadie abriera la app, se cierra UNA (la que estaba abierta, que es la última con datos) y las del medio no existen. Borde
  aceptado: su rótulo en el historial sale de la posición ("la semana pasada"), aunque haya sido hace más.
- Se dispara desde `index.ts`, ANTES de rutear, en los cuatro lectores de lo que el cierre produce: `/api/leagues/*` (el chip de
  liga de la barra superior lee `/api/leagues/mine` en cada carga —verificado en `TopBar.tsx`—, así que alcanza con que alguien
  abra la app), `GET /api/parent/activity` (el adulto en Premios ve el canje aunque nadie haya abierto Ligas),
  `GET /api/market/redemptions` y `GET /api/medals`. Va en `index.ts` y no en `parent.ts` porque `leaguesFake` ya importa
  `parent` (un import de vuelta armaría un ciclo nuevo). Antes del 403 de Ligas apagadas: cerrar la semana de la familia no le
  muestra nada a quien la dispara.
- Revisión de U5 ("el bug del lunes"): también lo dispara `POST /api/demo/reset` SIN `{scope:'all'}` (cada carga de página
  resetea PRIMERO al que abre), en DOS tiempos (`server/src/demoReset.ts`, que también tiene la puerta de los cuatro lectores, y
  `familyCloseIfDue(viewerId, afterPhoto)`): la FOTO de la semana que cierra ANTES de re-sembrar al que abre (si no, tomaba su
  «semana pasada» del seed, que cae justo en la semana abierta) y el REPARTO —canje del premio, copa, historial y medallas de
  cada uno— DESPUÉS, así su F5 no se come lo que el cierre le da. Lo que sale de SU progreso en RAM («Superaste tu semana»,
  «Semana completa» de ese corte) vuelve al seed con él.
- Las ligas PÚBLICAS no cierran solas el lunes: sigue igual que hoy ("el cierre real es del backend futuro"; con NPCs no hay
  nada real que cerrar). Asimetría aceptada y documentada: el lunes la familia cierra, la liga pública conserva su "semana pasada"
  del seed y la XP vuelve a 0 como siempre.

### 2.4 Cierre SIMULADO de la familia (botón de demo)

`POST /api/leagues/family/close-week` (sin cuerpo; GET → 405). Lo dispara SOLO un ADULTO de la familia (D4; un chico → `403
{error: 'El cierre de la semana de la familia lo hace un adulto.'}`). En la solapa Familia de `/ligas`, para el adulto, el chip
de demo del pie pasa a ser "Simular cierre de la semana de la familia" (en las otras solapas sigue el individual de siempre).
Orden, todo síncrono:

0. Si la tabla tiene < 2 filas → `400 {error: 'La liga de la familia necesita al menos dos integrantes.'}` (la UI no ofrece el
   botón en ese caso: no hay solapa).
1. **Foto** de la tabla de la familia de ahora (con `days` y `prevXp` de cada uno) → `closeFamilyWeek` → `FamilyWeekClosed`.
2. **Premio**: a cada ganador, un canje pendiente "de la liga" en SU slice (`market.grantFamilyPrize(uid, …)`, §3.4).
3. **Copa**: `crowns[ganador]++` (el hecho del que se deriva la medalla `semana-familia`, §5).
4. **Historial**: `history.unshift(closed)` (tope 8), `week++`, `closedAt = now`.
5. **Ligas públicas de TODOS los integrantes** (`familyOf(viewer)`, también los chicos con Ligas apagadas: el lunes le corta la
   semana a todos y la regla 7 dice que el puntaje de la semana es UNO): `runAsUser(id, closeWeek)` de cada uno, en el orden del
   seed. Cada uno cierra SU liga (medalla de podio, ascenso, su noticia en SU feed —la de un chico con Ligas apagadas queda
   filtrada al servir, como hoy—) y su `startNewWeek` pone su XP en 0, guarda su `lastWeek` y mueve `pbWeeks`/`fullWeeks`.
6. **Medallas**: `runAsUser(id, () => syncMedals(id))` de cada integrante (§5.3): la medalla nueva —copa, "superaste tu semana",
   "semana completa"— y su noticia caen en SU feed.
7. Responde `FamilyCloseResult { closed, mine }` (`mine` = el `CloseWeekResult` de la liga pública del que apretó).

Después del cierre simulado, la semana de la familia sigue el calendario corrido del demo, igual que la pública: `closesInDays`
= 7 el día del cierre y uno menos por día real (mismo cálculo que `closesInDays()` de un ciclo con `closedAt`), y el cierre real
perezoso del §2.3 queda apagado para esa familia hasta el reset (los dos calendarios no se mezclan).

### 2.5 Cómo convive con el cierre de las ligas públicas

| Disparo | Liga pública del que aprieta | Ligas públicas de los demás | Semana de la familia |
|---|---|---|---|
| "Simular cierre de semana" (Mi liga, cualquiera: U4, sin cambios) | cierra | no | NO cierra (su XP queda en 0 en la tabla, como hoy) |
| "Simular cierre de la semana de la familia" (solapa Familia, solo adulto) | cierra | cierran todas | cierra, primero (foto con la XP de todos antes del 0) |
| Lunes 00:00 de la familia (real) | no (backend futuro) | no | cierra sola (perezosa) |

Borde conocido y aceptado: el cierre individual DESINCRONIZA (Ian cerró su semana el martes; el viernes la familia cierra y en la
foto Ian tiene la XP de 3 días). El cierre de la familia los vuelve a alinear porque cierra a todos juntos. Es el costo de que
cada uno pueda probar su liga solo (U4 A6).

### 2.6 Historial y lo que se ve después

- **Historial**: hasta 8 semanas (el más nuevo primero) en `FamilyLeague.history`; la última es `history[0]` (sin campo aparte:
  una sola fuente). Cada entrada trae su rótulo armado por el server al servir (`weeksAgoLabel(i + 1)` de `leaguesFake`: "la
  semana pasada", "hace 2 semanas").
- **En la solapa Familia** (todos): arriba de la tabla, la tarjeta "La semana pasada": "🏆 Ganó Luna · 1.350 XP", las marcas de
  cada uno ("Ian ↑ superó su semana · Andrés ✨ los 7 días"), la línea "Entre todos sumaron 2.830 XP" y, si hubo, "🚲 1 hora de
  bici → para Luna (se lo da Andrés)". Un "Semanas anteriores" plegado (`<details>` nativo) con el resto. En la tabla en vivo,
  una 🏆 chiquita junto al nombre del que ganó la semana pasada (`wonLastWeek`).
- **El que apretó el cierre** (adulto) ve un aviso propio (`FamilyCloseBanner`, patrón de `CloseBanner`: festejo chico, una vez,
  foco al título): "¡Cerró la semana de la familia!" + la copa + las marcas + el premio + una línea de su propia liga ("Tu liga
  también cerró: saliste 9.º en la Liga Chispa", de `mine` con el mismo `closeCopy` de siempre).
- **Los demás** se enteran al entrar: la tarjeta "La semana pasada" en Ligas → Familia, la medalla nueva (punto en su tarjeta de
  perfil + noticia en su feed, §5) y, el ganador del premio, el canje en Tienda → Tus canjes.
- **Seed de la familia** (lo que se ve al arrancar): `history = [la semana pasada]`, armada con `closeFamilyWeek` sobre el
  `lastWeek` SEMBRADO de cada uno (`progress.seedLastWeekOf(id)`, puro sobre `PROGRESS_SEEDS`; NUNCA el progreso vivo: el
  estado de la familia nace perezoso y, si Ian ya cerró su liga, la "semana pasada" de la familia cambiaría según el orden en
  que se crean los slices): **Luna 1.350 · Ian 1.180 · Andrés 300** → 🏆 Luna (`crowns = {luna: 1}`). La
  semana ANTERIOR a esa no existe en el seed (`prevXp: null` para todos): la tarjeta sembrada no muestra ↑ de nadie (no se
  inventa una comparación), solo la copa y, si los `days` del seed dan 7, el ✨. Con la XP de la semana del seed (1.290 / 1.240
  / 450), en vivo Ian y Andrés YA superaron su semana (↑, contra 1.180 y 300) y a Luna le faltan 61 XP (3 postas de 30: 1.380):
  la tabla arranca con historia y peleada, sin tocar los seeds de U4. Los `days` del seed salen de una función pura coherente con
  la racha (§4.3).

### 2.7 Bordes del cierre

- "F5 a medias" (precedente U4): el historial es de la familia y sobrevive al F5 de un integrante; el canje del premio vive en el
  slice del chico y SE VA con su F5 (como cualquier canje pendiente de hoy: `deliverRedemption` ya devuelve false en ese caso).
  El historial seguirá diciendo "🚲 para Ian": correcto como historia, sin canje que entregar. Documentarlo, no arreglarlo.
- Un chico al que le apagan Ligas a mitad de semana sale de la tabla y del premio (no es elegible al cerrar); sus marcas de semanas
  anteriores siguen en el historial (es historia de la familia, no de él).
- Familia de 1 (el adulto con los dos chicos con Ligas apagadas): no hay solapa (regla de U4, `familyTabOn`); el cierre de demo
  no se ofrece (el endpoint responde 400); el lunes real cierra igual (historial de uno, sin copa: la copa pide ≥ 2 filas). Si
  había premio puesto, hoy queda huérfano y no se consume (comportamiento actual, decisión de producto pendiente: USUARIOS §12,
  "Bordes (U5-A)", «Premio huérfano»).
- Después de un cierre SIMULADO la familia sigue el calendario corrido del demo, como la liga pública: pasados 7 días reales
  queda en "¡Cierra hoy!" hasta otro cierre simulado o `{scope:'all'}` (el perezoso del lunes está apagado). Igual que hoy en
  "Mi liga".
- Empate en la punta: si dos integrantes empatan en XP, la copa es del 1.º de la tabla (el desempate de U4: racha → seed). Es
  la ÚNICA marca que desempata; el premio con "gana la semana" no (§3.4: empate = los dos).

---

## 3. El premio del padre (audio 1008: "si ganás la semana: la bici")

### 3.1 La regla de fondo

**El premio lo pone, lo promete y lo entrega el ADULTO; la plataforma solo lo anota y avisa.** Nada de ⚡ (no se compra, no
cuesta, no se canjea), nada de sorteo ni magnitud variable (lootbox: descartada), nada que se quite (solo condiciones positivas:
no existe "si no llegás, perdés X"), y nada fuera de la semana de la familia (el padre no puede atarlo a notas ni a tareas: no le
damos ese instrumento —tensión 10 de la síntesis—). Un premio por semana y por familia.

### 3.2 Dónde y cómo lo pone

En `/ligas?tab=familia`, con un ADULTO activo (audio 1012: "la misma vista, más o menos funcionalidad según el usuario"):

- Sin premio: tarjeta "Poné un premio para esta semana" → hoja `FamilyPrizeSheet` (chasis `.shov/.shcard`, prefijo CSS propio
  `lgp-` tras grepear).
- La hoja tiene dos maneras: **"De los premios de tus chicos"** (los premios NO archivados de cada dependiente, agrupados "De la
  Tienda de Ian" / "De la Tienda de Luna", de `GET /api/leagues/family/prize-options`) o **"Uno nuevo"** (emoji + título +
  descripción opcional, con la MISMA validación que un premio de la Tienda —`checkTitle`/`checkDesc`/`checkEmoji` de
  `parent.ts`, hoy privadas: se exportan juntas como `checkPrizeFields`—: título de 2 a 60 caracteres, descripción ≤ 140, 1 o 2
  emojis; los textos de error son los mismos).
- **Condición** (radios nativos), D1:
  - "Para todos los que superen su semana anterior" — *"Cada chico compite contra su propia semana: lo pueden ganar todos."*
  - "Para el que gane la semana" — *"Se lo lleva el chico que más sume (si empatan, los dos)."*
- Elegir de la Tienda COPIA emoji, título y descripción al premio de la semana: lo prometido no cambia si después edita o archiva
  el original, y no toca ni su stock ni sus canjes (el premio de la semana no es ese ítem).
- Con premio: la misma tarjeta muestra lo prometido con "Cambiar" (reabre la hoja) y "Quitar" (confirmación chica). Cambiar o
  quitar rige al instante para todos (es decisión del padre; no se le avisa a nadie).
- Familia → **Premios** (por integrante) muestra arriba una línea de solo lectura: "Premio de la semana de la familia: 🚲 1 hora
  de bici · para todos los que superen su semana · Se elige en Ligas → Familia" (link a `/ligas?tab=familia`).

Elegibles = los CHICOS de la tabla de la familia (dependientes con Ligas prendidas) en el momento del cierre. Si al ponerlo no
hay ninguno → 400 `'Ninguno de tus chicos está jugando la liga de la familia (tienen Ligas apagadas).'`. El adulto juega la tabla
y puede ganar la copa, pero el premio es para sus chicos: con "el que gane la semana" y un adulto 1.º, se lo lleva el chico
mejor ubicado (el adulto "empuja", no le saca el premio a nadie).

### 3.3 Dónde lo ve cada uno

- **Solapa Familia de Ligas** (todos los de la tabla): la tarjeta del premio arriba de la tabla. Para un chico: "Si superás tu
  semana anterior: 🚲 1 hora de bici · Te lo da Andrés" / "Si ganás la semana: …"; para el adulto, con Cambiar/Quitar.
- **Tienda** de un chico ELEGIBLE con la Tienda prendida: una tarjeta destacada ARRIBA de la grilla (no adentro): "Premio de la
  semana de tu familia · 🚲 1 hora de bici · Si superás tu semana anterior · Te lo da Andrés · No se canjea: se gana en la liga
  de la familia →" (link a `/ligas?tab=familia`; la condición y quién lo da los sumó U5-C, para que el chico sepa cómo se gana).
  Sin precio, sin "Canjear", sin corazón de deseos. No va en la grilla para que nadie crea que se compra con ⚡. La lee el
  container de la Tienda con `api.familyLeague()` en una lectura aparte (sin acoplar `market.ts` con `leaguesFake.ts`; un fallo
  no tumba la Tienda y deja lo último que se supo), en cada carga de la Tienda y cuando cambia el candado; con Ligas apagadas
  directamente NO se pide (ningún pedido, ningún 403) y la tarjeta no existe.
- Un chico con la Tienda APAGADA igual lo ve en la solapa Familia (no son ⚡: es lo que eligió el padre a sabiendas).

### 3.4 Quién lo cobra y cómo (el flujo honesto)

Al cerrar la semana (simulado o lunes real):

1. **Ganadores** (puro, `familyWeek.prizeWinners`), solo entre los chicos de la tabla:
   - `supera-su-semana`: cada chico con la marca `supero` (sumó más que su semana anterior).
   - `gana-la-semana`: el o los chicos con la MAYOR XP entre los chicos (empate exacto = los dos; desempatar por racha o por orden
     del seed le daría la bici a alguien por un criterio que nadie eligió). Si esa XP es 0, nadie.
2. **Sin ganadores** → el premio NO se consume: "sigue en juego" la semana que viene (que un premio prometido se evapore sería
   justo la pérdida que la evidencia desaconseja). **Con ganadores** → el premio se consume (`prize = null`) y la tarjeta del
   adulto ofrece "Repetir el de la semana pasada" (re-envía el mismo; comodidad del cliente).
3. A cada ganador, un **canje pendiente** en SU slice de la Tienda (`market.grantFamilyPrize(uid, prize, closedAt)`, con el
   acceso EXPLÍCITO `stores.of(uid)`: el usuario del pedido es el adulto):
   `Redemption { id: seq de canjes, itemId: 0, title, emoji, price: 0, ts, status: 'pendiente', origin: 'liga-familia', closedAt }`
   (desde FS-BASE-B el `id` sale de un contador del PROCESO que solo crece, no de uno por chico).
   `itemId: 0` = no es un ítem (no descuenta stock de nadie); `price: 0` = no movió ⚡ (no hay `spendEc` ni movimiento en la
   billetera).
4. **El chico** lo ve en Tienda → Tus canjes ("🏆 Lo ganaste en la liga de la familia" en lugar del precio y, como todo canje,
   el estado "Pendiente" / "Entregado") y en la tarjeta "La semana pasada" de la solapa Familia.
5. **El adulto** lo ve en Familia → Premios → Por entregar del integrante ("🏆 De la liga de la familia · cerró el 28 oct", en
   lugar del "⚡ N" de `DeliveryRow`) y lo marca con el MISMO "Ya se lo di" (`POST /api/parent/deliver?member {id}`) de siempre.
   El contador de canjes por entregar lo cuenta solo.
6. `market.listRedemptions(member)` y `deliverRedemption(id, member)` hoy filtran por `itemOwner(r.itemId) === member`; con U5,
   un canje con `origin: 'liga-familia'` pasa ese filtro (es del slice del integrante por construcción).

### 3.5 Guardarraíles (checklist para el QA)

- Ningún ⚡ entra ni sale por el premio (ni al ponerlo, ni al ganarlo, ni al entregarlo).
- El texto del premio no pasa por la moderación de contenido (como los premios de la Tienda: lo escribe el padre).
- Sin aleatoriedad en ningún punto (ni quién gana ni qué se gana).
- Ningún texto le dice a un chico que "perdió" el premio: el que no ganó ve "La semana pasada" con las marcas que sí logró.
- El premio no aparece en el Feed (F-2/F-5 del Feed: nada comercial arriba) ni genera notificaciones.

---

## 4. El reto de constancia (audios 1009-1011): "¿Quién aprende más días esta semana?"

### 4.1 Qué se cuenta

- **Un día cuenta** cuando el integrante aprendió algo NUEVO ese día del calendario de la familia: el MISMO evento que hoy mueve la
  racha (`progress.addXp` con monto > 0, que en W3+ solo dispara la PRIMERA partida completada de cada objetivo en Aprender). Un
  replay no cuenta (G1: el crédito es el aprendizaje nuevo, no el esfuerzo repetido); abrir la app tampoco (G3).
- **La medida** es `days` = cuántos días distintos de la semana ABIERTA tuvieron aprendizaje nuevo, de 0 a 7. Solo SUBE dentro de
  la semana y arranca de cero el lunes (o con el cierre simulado). Nunca baja, nunca "se rompe".
- `progress.ts` suma `weekDays: number[]` (números de día de la familia) al Store. El día se agrega en `addXp` (con `a > 0`),
  NO dentro de `touchStreak`: ese corta temprano si `lastDay === hoy`, y después de un cierre simulado el mismo día (que vacía
  `weekDays`) la próxima posta de hoy no contaría en la semana nueva. `rollWeek` y `startNewWeek` lo copian a `lastWeek.days` y
  lo vacían. Además, por si el dueño elige la variante "seguidos" (D2), se expone
  `bestRun` = el tramo de días consecutivos más largo DENTRO de la semana (también monotónico: romperlo no baja el número; se puede
  superar con un tramo nuevo). Los dos salen del mismo `weekDays`: cambiar de variante es solo de cliente.

### 4.2 Cómo se muestra (mostrar sin punir, G7)

- En cada fila de la solapa Familia, en lugar de la racha "✨ 9 días" de U4: **siete puntitos** (llenos = `days`, vacíos el resto)
  + "5 de 7 días". Los puntitos NO tienen letras de día: no se ve QUÉ día faltó (lo que baja la conducta, según Silverman &
  Barasch, es ver la rotura, no la falta). Con D2 = "seguidos", el texto pasa a "4 seguidos" y los puntitos muestran `bestRun`.
- Título chico arriba de la tabla: "Esta semana: ¿quién aprende más días?". Pie: "Un día cuenta cuando aprendés algo nuevo. Si un
  día no se pudo, no se pierde nada: la semana sigue." (reemplaza la parte de la racha del pie de U4; queda "Cuenta la XP…").
- **No es un ranking**: no se ordena por días, no hay "1.º en constancia", no hay premio propio (G9: es feedback). Al cerrar, la
  marca ✨ "los 7 días" es para TODOS los que llegaron. Tampoco hay cuenta regresiva, "te falta 1 día" ni notificación (07 §5.2:
  "sin cuenta regresiva visible"; FEED.md ya prohibió el countdown). Por lo mismo, la tabla tampoco dice "a Luna le faltan 61 XP
  para superar su semana": el ↑ aparece cuando se logra y, mientras no, no hay nada.
- La racha de U4 (`streakDays`, que sí vuelve a 1) sigue en el Feed ("✨ 5 días" junto al saludo, sin presión: de antes) y en la
  API (`FamilyLeagueRow.streakDays` no se retira: compat). Sale SOLO de la fila de la familia, donde ponerla al lado de la del
  hermano convertiría la rotura en comparación.

### 4.3 Seeds coherentes con la racha

Los `days` de esta semana y de la semana pasada del seed no pueden contradecir la racha sembrada (Luna con 9 días seguidos un
domingo ya aprendió los 7 días de ESTA semana; un lunes, los 7 de la PASADA). Función pura `familyWeek.seedWeekDays(streak, dow,
wantedLastWeek)` con test:
- esta semana: `min(streak, dow + 1)` días que terminan hoy;
- semana pasada: `spill = streak − (dow + 1)`; `spill ≥ 7` → 7 · `spill > 0` → entre `spill` y 6 (el día anterior al arranque de
  la racha fue hueco) · `spill = 0` → como mucho 6 · si no, `wantedLastWeek`.
- Deseados del seed: Ian 6, Luna 7, Andrés 3 (las XP de la semana pasada: Ian 1.180, Luna 1.350, Andrés 300; §2.6).
- Consecuencia que el implementador tiene que saber: con 9 días seguidos, el 7 de Luna para la semana pasada solo es posible un
  lunes o un martes (de miércoles en adelante su racha arrancó el martes anterior y el lunes fue hueco: queda en 6). Está bien que
  así sea —es coherente— y por eso la medalla "Semana completa" de Luna en el seed NO sale de esos `days` sino de un contador fijo
  del seed (`fullWeeks: 1`: una semana completa de antes, §5.4), así su pila no cambia según el día de la semana.
- Quirk heredado (no es de U5): la XP de la semana del seed no escala con el día (un lunes Ian ya tiene 1.240 XP con 1 día
  aprendido). Los puntitos dicen la verdad de `weekDays`; la XP, la del seed de siempre.

### 4.4 Días elegibles (G8)

Con el Ciclo del día v1 (rangos que rigen TODOS los días, sin día de la semana: USUARIOS §11) ningún día queda cerrado entero para
Aprender, así que el "día neutro" de G8 no hace falta todavía. Si el ciclo suma días de la semana (está en su "Falta"), un día con
Aprender cerrado las 24 h debe salir del denominador ("5 de 6 días"): anotado como deuda, no es de U5.

### 4.5 La fila en vivo, entera

De izquierda a derecha (componente puro `FamilyRanking`, CSS `lgf-` existente + `lgd-` para los puntitos):
puesto con su circulito (contrato U4: se conserva) · avatar elegido · nombre (+ "Vos") + 🏆 chiquita si ganó la semana pasada ·
**puntitos** "5 de 7 días" · **↑ "superó su semana"** si `prevXp !== null && xp > prevXp` (aparece cuando se logra; mientras no,
NO hay nada: ni "te faltan N", ni flecha gris) · XP. Con premio "supera su semana", el ↑ de un CHICO lleva además el emoji del
premio ("↑ 🚲": ya se lo ganó si nadie cierra antes; nadie se lo puede sacar —la XP de la semana no baja—). El ↑ es feedback
sobre vos mismo (eje K), no comparación: el que no lo tiene no ve nada negativo.

### 4.6 Lo que NO se hace en U5: el duelo 1 a 1 ("ganame la racha")

U4 anotó "retos 1 a 1" para U5. No se construyen, a conciencia: un duelo entre dos hermanos es exactamente la competencia
interpersonal que no suma nada sobre el trabajo individual (G10: 0,20 y 0,03, no significativos) con un perdedor por
construcción (G2), y el "ganame la racha" literal es la racha diaria destructiva (G7) más la presión de "no fallarle al otro"
(Friend Streak, 08 §2.3). Lo que sí queda del audio: el padre puede elegir "para el que gane la semana" (§3, el "te compro una
bici" mediado por él) y la tabla de la familia ya es la competencia que la visión pide.
**Candidata U6, con evidencia**: el **reto de a dos cooperativo** (molde Friends Quest, 07 §2.5): "Ian y Luna: entre los dos,
10 días aprendiendo esta semana" — objetivo compartido, recompensa simétrica, sin tabla y sin poder de sanción. Es la respuesta
barata a la pregunta abierta de 07 §6 ("¿un equipo de dos se puede hacer con hermanos?") y lo de más evidencia de todo el campo
(G10: cooperación 0,46). No entra en U5 porque suma una perilla y una superficie más; los datos (`weekDays` por persona) ya
quedan listos con esta tanda.

---

## 5. Las medallas de la plataforma (audio 1016)

### 5.1 Qué son y qué no son

El audio pide medallas "como GitHub": por logros de USO ("tu primera ruta agregada, encontraste tu primer amigo") y de
DESEMPEÑO, incluso "una racha de un día entero o de tres días"; un "diccionario inicial"; en el perfil la CANTIDAD y, al abrir el
detalle, "la pila como quien muestra un diploma". La evidencia (eje L, síntesis §5) dice que las insignias no tienen valor
incremental sobre un progreso ya visible, que una colección con huecos es una pérdida latente, y descarta "insignias como sistema
paralelo al progreso de rutas". La reconciliación son cinco reglas duras, que el QA chequea una por una:

1. **Solo las ganadas.** El catálogo no viaja nunca al cliente (vive en el server): ni "5 de 13", ni siluetas grises, ni
   candados, ni "próximas medallas", ni barra de "te falta…". Un usuario sin medallas no ve NADA (ni un "0"). Sin huecos (L) y,
   como nadie las ve venir, son recompensas INESPERADAS (G4: +0,01, la única variante sin daño medible).
2. **No pagan, no se compran, no destraban.** Cero ⚡, ningún acceso, ningún estilo de avatar (eso de 1015 queda afuera: §1).
   Ninguna se puede conseguir gastando ⚡ (por eso no hay "primer regalo": el regalo cuesta ⚡ y la medalla quedaría a la venta).
   No son un segundo progreso: no hay medalla por cada ruta ni por cada posta (el mapa de rutas ya es el progreso; G1, eje C).
3. **Nada se pierde.** Una medalla ganada no se quita nunca (G7). Ninguna premia "no fallar": las de constancia cuentan lo que
   hiciste (3 días seguidos UNA vez, volver después de unos días), nunca exigen sostener algo.
4. **Texto informativo.** Cada una describe lo que hiciste ("Completaste tu primera posta en Aprender."), nunca a la persona
   ("¡Sos un genio!") ni con signos de euforia (eje P: el mismo elogio va de +0,66 a −0,44 según sea información o control).
   Neutro en género (UserInfo no tiene género; regla de U4).
5. **Cada uno ve las suyas.** Las tuyas en tu perfil y tu feed; el adulto ve las de cada chico en Familia → Actividad. Los
   hermanos NO ven la pila del otro (no existe esa superficie) y ningún NPC las "festeja" (G11: nada simulado en una superficie
   de prestigio; eje N: lo cruzado entre usuarios, apagado por defecto en menores).

Lo que se resigna, escrito: la visibilidad social que pide 1014-1015 ("el prestigio tiene sentido si otros lo ven") queda para
cuando haya perfiles de otros usuarios reales y su permiso por edad.

### 5.2 El catálogo inicial (13)

| id | Medalla | Texto (lo que se lee en la pila) | Se deriva de | Se esconde si… | Seed (con los datos del 28-oct) |
|---|---|---|---|---|---|
| `primera-posta` | 🎯 Primera posta | Completaste tu primera posta en Aprender. | Learn: ≥ 1 fila `completed` no `rollup` | — | Ian ✔ (23-oct) |
| `diez-objetivos` | 🧠 Diez objetivos | Completaste 10 objetivos distintos en Aprender. | Learn: ≥ 10 `target` distintos completados | — | — |
| `ruta-completa` | 🗺️ Ruta completa | Completaste todas las postas de una ruta. (`×N` = rutas) | Learn: `routeRuns(catalogRoutes(), filas)` con `done === total > 0`, contando SOLO las filas `completed` (revisión de U5: rendirse o quedarse sin tiempo no cuentan, a diferencia del camino) | — | Ian ✔ (filas del 28-oct a la noche en `ruta.kzd4pr9brpdj`) |
| `posta-perfecta` | 💯 Sin un error | Resolviste una posta entera sin errores. | Learn: una fila `completed` no `rollup` con `pct === 1` | — | Ian ✔ |
| `primer-repaso` | 🔁 Primer repaso | Hiciste tu primer repaso con Active recall. | Learn: una fila `completed` con `source === 'active-recall'` | — | — |
| `primer-guardado` | 📁 Tu primer guardado | Guardaste algo en Mi espacio por primera vez. | Mi espacio: ≥ 1 ítem (papelera incluida) | — | Ian ✔ |
| `ruta-creada` | ✏️ Tu primera ruta | Armaste tu primera ruta en Crear. ("tu primera ruta agregada", 1016) | Catálogo: ≥ 1 ruta con `createdBy === uid` (campo NUEVO, §7) | — | — |
| `primer-amigo` | 🤝 Primer amigo | Sumaste tu primer amigo en Innerith. ("encontraste tu primer amigo", 1016) | Amigos: grafo del usuario con ≥ 1 amigo | Amigos apagado para ese chico | Ian ✔ · Luna ✔ (el adulto no tiene amigos: nunca) |
| `tres-dias` | 🗓️ Tres días seguidos | Aprendiste algo nuevo tres días seguidos. ("una racha de tres días", 1016) | Progreso: `bestStreak ≥ 3` (máximo histórico, no la racha de hoy) | — | Ian ✔ (5) · Luna ✔ (9) |
| `de-vuelta` | 🌱 De vuelta | Volviste a aprender algo nuevo después de unos días sin hacerlo. | Progreso: `comebacks ≥ 1` (un `addXp` con ≥ 3 días de calendario desde el último día con aprendizaje) | — | — |
| `semana-completa` | ✨ Semana completa | Aprendiste algo nuevo los 7 días de una semana. (`×N`) | Progreso: `fullWeeks ≥ 1` (cortes de semana con `days === 7`) | — | Luna ✔ (contador fijo del seed) |
| `mejor-semana` | 📈 Superaste tu semana | Sumaste más XP que la semana anterior. (`×N`) | Progreso: `pbWeeks ≥ 1` (cortes con `prevXp !== null && xp > prevXp`) | — | — (en vivo: Ian y Andrés al primer cierre) |
| `semana-familia` | 🏆 Copa de la familia | Ganaste una semana de la liga de tu familia. (`×N`) | Familia: `crowns[uid] ≥ 1` | Ligas apagado para ese chico | Luna ✔ (la semana pasada del seed) |

Sobre las de evidencia más floja, a conciencia: `posta-perfecta` es desempeño con techo (eje H advierte no cablear premios al
umbral), pero es retroactiva, oculta y sin valor de canje, y el reintento es ilimitado (mastery sano, eje E); `tres-dias` es la
racha que pide el audio, pero monotónica (una vez y para siempre); `semana-completa` es la "perfect week" de la industria (08
§2.6: patrón sin evidencia publicada, [FOLKLORE]) y `de-vuelta` es la que más respaldo tiene (eje S, Milkman: premiar el regreso
tras faltar, +27 %). Queda afuera la medalla de podio de liga: la liga pública ya tiene su medallita oro/plata/bronce sobre el
avatar y duplicarla haría de la pila una vitrina del premio escaso.

Pila del seed (lo que ve cada uno al arrancar, con los datos reales de hoy): **Ian 6** (🗺️ 📁 🎯 💯 🤝 🗓️: la 🗺️ va primera
porque trae la fecha de la fila del 28-oct que completó `ruta.kzd4pr9brpdj`; al escribir esta spec eran 5) · **Luna 4** (🤝 🗓️ ✨
🏆) · **Andrés 0** (no ve el chip: sus primeras llegan en vivo — "Superaste tu semana" en el primer cierre: 450 > 300 —, que es
la historia del audio 1008: el padre empuja y también aprende). Si `learn-results.json`/`space.json` cambian (QA, uso), la pila
del seed cambia con ellos: es derivada, no está escrita.

### 5.3 Cómo se ganan: derivadas de hechos, nunca "entregadas"

Ninguna medalla se otorga a mano. Cada una es una regla PURA sobre los **hechos** del usuario (`server/src/medalRules.ts`, sin
estado, con tests):

```ts
// server/src/medalRules.ts (puro)
export interface MedalFacts {
  // Learn (persistido: learn-results.json v2) — los aporta learnResults.ts
  completedTargets: number; firstCompletedAt: number | null; perfect: boolean; recall: boolean; routesCompleted: number
  // Catálogo (persistido: learn-routes.json, campo nuevo createdBy) — learnRoutes.ts
  routesCreated: number
  // Mi espacio (persistido: space.json v2) — space.ts
  savedEver: number; firstSavedAt: number | null
  // Amigos (RAM por usuario) — friendsFake.ts
  friends: number
  // Progreso (RAM por usuario, con seed) — progress.ts
  bestStreak: number; comebacks: number; pbWeeks: number; fullWeeks: number
  // Familia (RAM de la familia) — leaguesFake.ts
  crowns: number
}
export type MedalId = 'primera-posta' | 'diez-objetivos' | 'ruta-completa' | 'posta-perfecta' | 'primer-repaso' | 'primer-guardado'
  | 'ruta-creada' | 'primer-amigo' | 'tres-dias' | 'de-vuelta' | 'semana-completa' | 'mejor-semana' | 'semana-familia'
/** Las que hoy se cumplen, con su cantidad (times: solo las repetibles) y su fecha si el hecho la trae. */
export function earnedFrom(f: MedalFacts): { id: MedalId; times?: number; at?: number }[]
export const MEDALS: Record<MedalId, { emoji: string; title: string; text: string; domain: 'amigos' | 'ligas' | null; repeatable: boolean }>
```

**Los hechos se REGISTRAN** (patrón `registerContinue` / `setProgressTzSource`, para que `medals.ts` sea una HOJA sin ciclos de
import): cada módulo dueño de un dato llama al cargar `registerMedalFacts(uid => ({ …su parte… }))`, y `medals.ts` junta las
partes (lo que falte, en cero). `medals.ts` importa solo `perUser`, `requestContext`, `users`, `web` y `medalRules`.

**El estado** (`server/src/medals.ts`, `perUser`, RAM): por usuario `{ earned: Map<MedalId, {at: number | null; times: number}>,
seen: Set<MedalId> }`. Una sola operación lo mueve, **`syncMedals(uid)`**: evalúa `earnedFrom(hechos(uid))`; lo que no estaba se
AGREGA (`at` = la fecha del hecho si la hay, si no `Date.now()`), `times = max(guardado, derivado)`, y NUNCA saca nada (si un
hecho desaparece —purgar el último guardado—, la medalla queda). Por cada medalla NUEVA mete la noticia en el feed de ese
usuario (sumidero registrado por `feedFake.ts`, §5.5). Idempotente: dos syncs seguidos no duplican nada.

**Cuándo corre `syncMedals`** (siempre con el usuario dueño como contexto; si el pedido es de otro, bajo `runAsUser`):
- `POST /api/learn/results` (learnResults.ts): `ensureMedals(me)` ANTES de escribir la fila y `syncMedals(me)` DESPUÉS (el
  "antes" garantiza que el slice exista con el seed viejo: si naciera recién después, la posta nueva entraría al seed como "ya
  vista" y no habría medalla nueva). Cubre primera-posta, diez-objetivos, ruta-completa, posta-perfecta, primer-repaso,
  tres-dias y de-vuelta (estas dos se mueven en `addXp`, que corre adentro de este mismo pedido).
- Guardar en Mi espacio (la ruta de `saveItem` en space.ts), aceptar un amigo o que el NPC acepte tu solicitud (friendsFake.ts:
  `accept` y el auto-aceptar con timer —el contexto de ALS viaja—), importar una ruta en Crear (learnRoutes.ts).
- Todo corte de semana: `leaguesFake.closeWeek()` (después de `startNewWeek`), el cierre de la familia (§2.4 paso 6) y el
  cierre real perezoso (§2.3, para cada integrante).
- `GET /api/medals` (red de seguridad: si algo se escapó, aparece al leer).

⚠ **`syncMedals(X)` corre SIEMPRE con X como usuario del contexto** (`runAsUser(X, …)` cuando el pedido es de otro): el
sumidero del Feed escribe en lo vivo del usuario DEL CONTEXTO (`feedFake.live()`), así que un sync de Luna bajo el contexto del
adulto le metería la noticia de Luna en el feed de Andrés. Por eso `medalsOf(mid, {forParent})` (Familia → Actividad) NO
sincroniza: lee lo que hay (si quiere frescura, `runAsUser(mid, () => syncMedals(mid))` antes), y el cierre perezoso del lunes
(que corre con el contexto de quien abrió la app) sincroniza a cada integrante bajo su `runAsUser`. El test de `medals` lo
cubre: sync de X con contexto Y → la noticia queda en X.

`ensureMedals(uid)` = crear el slice si no existe. `POST /api/demo/reset` llama `resetMedals(id)`, que lo re-siembra EN EL ACTO
(perUser.reset con id es eager): así, en el uso normal (cada carga resetea al activo), el slice existe antes de cualquier hecho
nuevo.

### 5.4 Persistencia, reset y "nada se pierde" (D3)

- **Dónde viven**: RAM por usuario (`perUser`), como la economía del demo (regla 9). **Sin archivo nuevo ni migración.**
- **Seed** = `earnedFrom(hechos al sembrar)`, todas marcadas como VISTAS (al arrancar nada es "nuevo"). Como los hechos de Learn,
  Mi espacio y el catálogo PERSISTEN, las medallas que salen de ellos sobreviven al F5 y a un reinicio del server: no se pueden
  perder aunque vivan en RAM. Las que salen de hechos de RAM (racha, semanas, copas, amigos) vuelven al seed con el F5 de ese
  usuario, junto con su XP y sus canjes: es "tu F5 es tu demo nueva", no una pérdida dentro del producto.
- **Hechos fijos del seed** (`progress.ts`, `PROGRESS_SEEDS` suma `medal: {bestStreak, comebacks, pbWeeks, fullWeeks}`): Ian
  `{5, 0, 0, 0}` · Luna `{9, 0, 0, 1}` · Andrés `{2, 0, 0, 0}`. `bestStreak` arranca en la racha del seed; `pbWeeks` en 0 para
  todos a propósito (el primer cierre le da "Superaste tu semana" en vivo a Ian y a Andrés). Las copas: `crowns = {luna: 1}` del
  historial sembrado (§2.6).
- **Fechas** (`at`): la del hecho cuando existe (Ian: la `finishedAt` de su posta del 23-oct; su guardado, su `createdAt`); para
  las del seed sin fecha (racha, semanas, copa, amigos), `null` → en la pila no se muestra fecha. Las ganadas en vivo, la de hoy.
- **Contrato "nunca se pierde"** (el que hereda el backend real): ningún camino de código saca una medalla salvo el reset del
  demo; las domain-filtradas (Amigos/Ligas apagados) se ESCONDEN al servir, no se borran (al prender de nuevo, vuelven).
- La alternativa (`medals.json` v1 persistido por usuario) está en D3 con lo que cuesta.

### 5.5 Dónde se muestran

**a) La tarjeta de perfil** (pie del menú, `ProfileCard.tsx`). Hoy la tarjeta ENTERA es un `<button>` que abre "Tu avatar" (no se
puede anidar otro botón adentro). U5 la envuelve en un `<div className="profile mdl-prof">` (así quedó en U5-D: el botón del
avatar conserva `idav-prof`, ver USUARIOS §12.D) con dos botones hermanos: el de siempre (avatar + nombre + edad → "Tu
avatar", con su medallita de liga y su lapicera) y, a la derecha, el **chip de medallas**
`mdl-chip` "🏅 5" (`aria-label="Tus medallas: 5, 1 nueva"`) con un puntito si hay sin ver. Sin medallas, el chip NO existe. La
lectura (`GET /api/medals`) sigue el patrón de `useLastMedal`: al montar, en CADA cambio de pantalla (no solo al entrar y salir
de Ligas), al volver el foco, cuando cambian los candados de Ligas o Amigos, al evento `LEAGUE_WEEK_CLOSED` que Ligas YA dispara
tras cada cierre (`leagues/lib/cycle.ts`; el cierre de la familia lo dispara igual) y a `innerith:medals-changed`, que dispara
el Feed cuando la primera página o la píldora traen una noticia de medalla. El estilo del `.profile` de shell.css pasa al
`div`; el hover sigue en el botón del avatar.

**b) La pila: hoja "Tus medallas"** (`MedalsSheet`, pura, chasis `.shov/.shcard`, CSS `mdl-` en `src/shared/components/
medals.css`, importado en `src/main.tsx` junto a `avatar.css`). "Como un diploma": una grilla de tarjetas, cada una con el emoji
dentro de un disco con cinta (CSS, sin assets: el diseño fino de los emblemas es posterior, 1016 lo dice), el título en la
display, el texto informativo, "Desde el 23 de octubre" si hay fecha y "×3" si se repitió. Las nuevas llevan la etiqueta
"Nueva". Orden: las más nuevas primero, las sin fecha al final en el orden del catálogo. Encabezado: "Tus medallas" + "Las que
fuiste ganando en Innerith." (sin total, sin "faltan"). Al abrirla: `GET /api/medals` (la pila con sus `fresh`) y DESPUÉS
`POST /api/medals/seen` (las etiquetas "Nueva" se ven en ESTA apertura y se van en la próxima). Cerrar con Esc / fondo / ✕; el
foco vuelve a QUIEN la abrió (el chip o el "Ver tus medallas" de la noticia del Feed; si ya no se ve, al chip).

**c) El Feed**: una noticia propia por cada medalla nueva, con un **kind aditivo `medal`** del `FeedItem` (no el `friend` de
siempre: ese se pinta como "Amigos" con el avatar derivado del nick y un "Ver la liga" que acá no corresponde):
`{ kind: 'medal'; id: 'fm-<n>'; time: 'recién'; reason: 'Es tu medalla nueva'; medal: EarnedMedal }`. Entra en lo VIVO del
usuario (`pushFresh`, por la píldora "N novedades ↑", como el cierre de liga), sin reacciones ni festejos de NPCs. Tarjeta nueva
`FeedMedalCard` (pura, estilo C de noticia, con `MyAvatar`): kicker "Tu medalla", título "Ganaste la medalla «Primera
posta»", el texto informativo y el botón "Ver tus medallas" (abre la hoja con `openMedalsSheet()`, patrón `openAvatarPicker`).
Filtros al servir (`liveAllowed`): `semana-familia` solo con Ligas prendido, `primer-amigo` solo con Amigos; el resto, siempre
(no es social: es tuyo). Las palabras/temas de la familia (`familyFilter`) también la filtran, como toda noticia en vivo. El
resumen de la edición (`summaryOf`) no la cuenta en la mezcla (no es contenido recomendado). Un cliente sin el kind nuevo no
pinta nada (el `switch` de `FeedPage.block` no tiene default): server y cliente pueden ir en tandas distintas.

**d) Familia → Actividad** del integrante (`ActivityPanel`): un bloque "Medallas de {integrante}" con la cantidad en una
insignia, sin paréntesis ("Medallas de Luna" + "4"), de solo lectura (emoji + título + "×N" + "Desde el…"), de
`ParentActivity.medals` (aditivo; sin "Nueva", sin filtrar por los candados: el adulto ve todas, incluida la copa de un chico
con Ligas apagadas, con la nota "(Ligas apagadas: {integrante} no la ve)"). Sin medallas: "Todavía no ganó medallas." (al
ADULTO sí se le puede decir: él no es el que juega).

**No se muestran** en: la pila de un hermano (no existe), Ligas, la barra superior, perfiles de NPCs, el lobby/resultado de las
postas (el overlay de Learn es porte EXACTO de Smarty —regla suprema de AGENTS—: no se toca; y no hay "toast global", eje O).

### 5.6 Bordes de las medallas

- `primer-amigo` no existe para el adulto (D4 de U4: sin amigos chicos). `ruta-creada` necesita route-lab corriendo para crear de
  verdad: en el demo se prueba por API (importar un bundle de fixture y borrarlo después, §8).
- Purgar el único guardado de Mi espacio y después F5: el seed re-derivado ya no tiene `primer-guardado` (la medalla se va con la
  "demo nueva"). Dentro de la sesión, nunca se va. Documentado, no se arregla (el backend real persiste las ganadas).
- Una ruta importada y después BORRADA: igual que el anterior (`ruta-creada` no vuelve tras un F5).
- La primera posta de Luna es UNA por entorno: su fila de Learn persiste (anti-farming de W3), así que en el próximo arranque Luna
  ya tiene la medalla. Igual que el "+30 ⚡ la primera vez". El QA respalda y restaura `learn-results.json` (§8).
- El F5 de Luna después de un cierre de la familia: su slice vuelve al seed y su copa (si la ganó en vivo) se RE-DERIVA de
  `crowns` (que es de la familia y no se resetea con el F5 de uno): la conserva, pero sin su «Desde el…» (las copas no traen
  fecha: se re-siembra con `at` null). Su "Superaste tu semana" de esa sesión, no (sale de `pbWeeks`, de su progreso en RAM).
- Dos pestañas con usuarios distintos: cada una conserva el usuario con que cargó hasta su próxima recarga (`src/api/index.ts`
  lee `innerith.user` UNA vez por carga: `PAGE_USER`), así que cada una ve y pide SUS medallas.

---

## 6. Contratos (aditivos; se congelan con la tanda U5-A)

Regla: ninguna forma existente cambia de significado. Los campos nuevos de tipos que YA existen van **opcionales en el tipo**
(el server de U5 los manda siempre): así `tabs.test.ts` —que arma `FamilyLeague` a mano y `tsc -b` lo compila (`include: ["src"]`)—
y cualquier cliente de antes siguen compilando y andando.

### 6.1 `src/api/types.ts`

```ts
/* ---------- U5 (28-oct): la liga de la familia completa + las medallas de la plataforma (docs/USUARIOS.md §12) ---------- */
export type FamilyPrizeCondition = 'supera-su-semana' | 'gana-la-semana';
/** El premio de la semana de la familia: un TEXTO fijo que promete el adulto (sin ⚡, sin sorteo, sin magnitud variable). */
export type FamilyWeekPrize = {
  emoji: string; title: string; desc?: string;
  condition: FamilyPrizeCondition;
  /** El adulto que lo prometió ("Te lo da Andrés"). */ by: { id: string; name: string };
  /** Copiado de un premio de la Tienda de un chico (informativo: no lo ata) o null = escrito en la hoja. */
  from: { member: string; itemId: number } | null;
  setAt: number;
};
/** 🏆 ganó la semana (solo el 1.º, con XP > 0 y ≥ 2 filas) · ↑ superó su semana anterior · ✨ aprendió los 7 días. */
export type FamilyWeekMark = 'gano' | 'supero' | 'siete';
export type FamilyWeekClosedRow = {
  id: string; name: string; kind: 'adult' | 'child'; xp: number;
  /** días con aprendizaje nuevo esa semana (0-7) */ days: number;
  marks: FamilyWeekMark[];
  /** se llevó el premio de esa semana */ prize?: true;
};
/** Una semana cerrada de la familia (resumen SIN puestos: solo marcas alcanzables + la copa). */
export type FamilyWeekClosed = {
  /** 0 = la "semana pasada" del seed; cada cierre suma 1 */ week: number;
  closedAt: number;
  /** "la semana pasada" · "hace 2 semanas"… (lo arma el server al servir, por posición) */ label: string;
  /** botón de demo (true) o lunes real / seed (false) */ simulated: boolean;
  /** en el orden de la tabla al cerrar */ rows: FamilyWeekClosedRow[];
  /** "Entre todos sumaron N XP" */ total: number;
  /** el premio que estaba en juego; winners [] = nadie lo ganó AL CERRAR (si sigue en juego HOY lo dice `prizeInPlay`) */
  prize: (FamilyWeekPrize & { winners: string[] }) | null;
  /** Revisión de U5 (aditivo; el server lo manda SIEMPRE): el premio de ESA semana sigue en juego HOY —sin ganadores y es el
   *  vigente (mismo `setAt`)—. false: no hubo premio, alguien lo ganó, o ya no es el vigente (el adulto lo cambió o lo quitó,
   *  o un cierre posterior lo consumió). Con un premio arrastrado varias semanas, true en cada una. */
  prizeInPlay?: boolean;
};
export type FamilyCloseResult = { closed: FamilyWeekClosed; /** el cierre de la liga PÚBLICA del que apretó */ mine: CloseWeekResult };
export type FamilyPrizeOptions = {
  /** los premios NO archivados de cada dependiente, en el orden de `dependents` */
  groups: { member: string; name: string; items: { itemId: number; emoji: string; title: string; desc?: string }[] }[];
};
export type FamilyPrizeRequest = { condition: FamilyPrizeCondition } &
  ({ from: { member: string; itemId: number } } | { emoji: string; title: string; desc?: string });

export type MedalId = 'primera-posta' | 'diez-objetivos' | 'ruta-completa' | 'posta-perfecta' | 'primer-repaso'
  | 'primer-guardado' | 'ruta-creada' | 'primer-amigo' | 'tres-dias' | 'de-vuelta' | 'semana-completa' | 'mejor-semana'
  | 'semana-familia';
/** Una medalla GANADA (el catálogo no viaja nunca al cliente). */
export type EarnedMedal = {
  id: MedalId; emoji: string; title: string; text: string;
  /** desde cuándo (null = del seed, sin fecha) */ at: number | null;
  /** solo las repetibles con 2 o más ("×3") */ times?: number;
  /** todavía no la vio en "Tus medallas" */ fresh?: true;
};
export type MedalsResponse = { medals: EarnedMedal[]; unseen: number };
```

Aditivos sobre tipos existentes (opcionales):

```ts
FamilyLeagueRow  += { days?: number; bestRun?: number; prevXp?: number | null; wonLastWeek?: true; prizeEligible?: true }
                    // streakDays NO se retira (compat; la fila de U5 ya no la pinta)
FamilyLeague     += { prize?: FamilyWeekPrize | null; history?: FamilyWeekClosed[] /* nuevo primero, ≤ 8 */;
                      canManage?: boolean /* el que mira es adulto: pone el premio y simula el cierre */; week?: number }
                    // closesInDays: con cierre simulado de la familia, 7 − días reales desde el cierre (antes: siempre al domingo)
Redemption       += { origin?: 'liga-familia'; /** cuándo cerró la semana que lo dio */ closedAt?: number }
                    // con origin: itemId 0 y price 0 (no es un ítem ni movió ⚡)
ParentActivity   += { medals?: (EarnedMedal & { hidden?: 'ligas' | 'amigos' })[] }   // las de M, sin `fresh`
FeedItem         += { kind: 'medal'; id: string; time: string; reason: string; medal: EarnedMedal }
                    // ⚠ este lo suma la tanda del CLIENTE de medallas (U5-D) junto con su tarjeta; el server (U5-B) ya lo emite
```

### 6.2 HTTP

```
GET  /api/leagues/family                    → FamilyLeague (U4 + aditivos)                 · chico con Ligas apagadas: 403 (U4, igual)
POST /api/leagues/family/prize {FamilyPrizeRequest} → FamilyLeague (con el premio ya puesto; reemplaza al anterior)
       403 (chico)  {error:'El premio de la semana lo pone un adulto de la familia.'}
       400 {error}  'Elegí para quién es el premio.' (condition ausente o inválida)
                    'Ese integrante no es de tu familia.' (from.member no está en los dependents del adulto)
                    'Ese premio ya no está en la Tienda de {nombre}.' (itemId inexistente, archivado o de otro integrante)
                    los de checkPrizeFields, con los MISMOS textos de parent.ts ('El título tiene que tener entre 2 y 60
                    caracteres.' · 'La descripción admite hasta 140 caracteres.' · 'Elegí un emoji para el premio (por ejemplo 🎮).')
                    'Ninguno de tus chicos está jugando la liga de la familia (tienen Ligas apagadas).'
                    'Pedido inválido (se esperaba JSON).'
       405 con GET
POST /api/leagues/family/prize/clear        → FamilyLeague (prize null)                      · 403 chico (mismo texto) · 405 con GET
GET  /api/leagues/family/prize-options      → FamilyPrizeOptions                             · 403 chico (mismo texto)
POST /api/leagues/family/close-week         → FamilyCloseResult (§2.4)                       · 405 con GET
       403 (chico)  {error:'El cierre de la semana de la familia lo hace un adulto.'}
       400 {error:'La liga de la familia necesita al menos dos integrantes.'}
GET  /api/medals                            → MedalsResponse (del activo, sin las de dominios apagados para él; nuevas primero)
POST /api/medals/seen                       → MedalsResponse (unseen 0)                      · 405 con GET
GET  /api/market/redemptions                → igual; incluye los canjes origin 'liga-familia' del activo
GET  /api/parent/activity?member            → ParentActivity + medals de M (todas; `hidden` marca las que M no ve)
POST /api/parent/deliver?member {id}        → igual; entrega también un canje 'liga-familia' de M
POST /api/demo/reset                        → igual (DemoResetResult); además resetMedals(id) y, SOLO con {scope:'all'},
                                              resetFamilyWeeks() (la semana de la familia es RAM de la familia: el reset por
                                              usuario no la toca); SIN {scope:'all'} (revisión de U5, demoReset.ts) ANTES
                                              cierra la semana de la familia si estaba pendiente, en dos tiempos: la foto,
                                              el reset del activo y después el reparto (§2.3)
```

Gating: todo `/api/leagues/family*` hereda el 403 de Ligas apagadas del CHICO (U4: primera línea de `leaguesRoutes`). `/api/medals*`
no pertenece a ninguna sección (`schedule.ts: sectionForApi` → null: el Ciclo del día no lo cierra) ni a ninguna funcionalidad.
Un adulto nunca recibe 403 en nada de esto. Orden de cada pedido a `/api/leagues/*`, `/api/parent/activity`,
`/api/market/redemptions` y `/api/medals`: primero `familyCloseIfDue(me.id)` (index.ts), después lo de siempre.

### 6.3 Accesos internos del server (para que las tandas no se pisen)

| Módulo | Exporta (nuevo) | Lo usa |
|---|---|---|
| `users.ts` | `familyKeyOf(id): string` (el primer adulto guardián en el orden del seed; un adulto o un chico sin guardián: él mismo) | leaguesFake |
| `familyWeek.ts` (NUEVO, puro) | `closeFamilyWeek(rows, prize)`, `prizeWinners(rows, condition)`, `seedWeekDays(streak, dow, wanted)`, `bestRun(dayNums)` | leaguesFake, progress (seed) |
| `progress.ts` | `weekFactsOf(id): { days: number; bestRun: number; lastWeek: { weekStart: number; xp: number; days: number } \| null }` (vivo) · `seedLastWeekOf(id)` (la del SEED, para el historial sembrado de la familia) | leaguesFake |
| `leaguesFake.ts` | `familyCloseIfDue(viewerId)`, `resetFamilyWeeks()`, `crownsOf(id)` | index.ts, (medals vía registro) |
| `market.ts` | `grantFamilyPrize(uid, p: {emoji, title}, closedAt): Redemption` | leaguesFake |
| `parent.ts` | `memberItemsOf(id): ParentItem[]` (copias, sin archivados) · `checkPrizeFields(b): Check<{emoji, title, desc?}>` | leaguesFake |
| `medalRules.ts` (NUEVO, puro) | `MEDALS`, `MedalFacts`, `MedalId`, `earnedFrom(facts)` | medals |
| `medals.ts` (NUEVO, hoja) | `registerMedalFacts(fn)`, `registerMedalNews(fn)`, `registerMedalGate(fn: (uid, domain: 'amigos' \| 'ligas') => boolean)`, `ensureMedals(id)`, `syncMedals(id)`, `medalsOf(id, {forParent})`, `resetMedals(id?)`, `medalsRoutes` | todos los dueños de hechos, parent (activity + registra el gate), index |
| `parent.ts` (registro) | `registerMedalGate((uid, d) => userById(uid)?.kind === 'adult' \|\| featureOn(d, uid))` al cargar. ⚠ `featureOn` de un ADULTO da `false` (fail-closed: no tiene config de integrante): sin el `kind === 'adult'`, al adulto se le escondería su propia copa | medals |
| `feedFake.ts` | (registra) `injectMedalNews(m: EarnedMedal)` como sumidero | medals |
| `learnRoutes.ts` | `routesCreatedBy(id): number` (filas con `createdBy`) | medals vía registro |
| `space.ts` | `savedFactsOf(id): { savedEver: number; firstSavedAt: number \| null }` | medals vía registro |
| `friendsFake.ts` | `friendCountOf(id): number` | medals vía registro |

Grafo de imports nuevo (sin ciclos nuevos): `medals.ts` es HOJA (importa `perUser`, `requestContext`, `users`, `web`,
`medalRules`); los dueños de hechos importan `medals.ts` para registrarse y llamar `syncMedals`. `leaguesFake` suma `market` (que
no importa `leaguesFake`) y `medals`. `parent` suma `medals` (hoja). Nadie importa `leaguesFake` nuevo salvo `index.ts`.

---

## 7. Mapa archivo por archivo (contra el código real del 28-oct)

Las líneas son las del árbol de trabajo de hoy (con U4/F1/F2 sin commitear): sirven para ubicarse, no son contrato. "Tanda" =
quién lo toca (§8); un archivo tiene UN dueño por tanda.

### 7.1 Server

| Archivo | Hoy (verificado) | Cambio U5 | Tanda |
|---|---|---|---|
| `server/src/users.ts` | `familyOf` (L78-85), orden del seed | + `familyKeyOf(id)` | A |
| `server/src/familyWeek.ts` | — | NUEVO, puro: `closeFamilyWeek`, `prizeWinners`, `seedWeekDays`, `bestRun` (§2.2, §3.4, §4.3) | A |
| `server/src/progress.ts` | `Store` (L34-45) sin semana anterior; `rollWeek` (L113-116) pone `xpWeek = 0` y pierde la semana; `startNewWeek` (L121-125); `touchStreak` (L128-133) corta si ya contó hoy; `addXp` (L139-152); `PROGRESS_SEEDS` (L71-83) | `Store` + `lastWeek`, `weekDays`, `bestStreak`, `comebacks`, `pbWeeks`, `fullWeeks`; `rollWeek`/`startNewWeek` guardan `lastWeek` y mueven `pbWeeks`/`fullWeeks`; `addXp` marca el día (fuera de `touchStreak`), `comebacks` (≥ 3 días sin aprender) y `bestStreak`; seeds con `lastWeek` (§2.6, vía `seedWeekDays`) y `medal` (§5.4); + `weekFactsOf(id)` y `seedLastWeekOf(id)`. En U5-B: + `registerMedalFacts` (una llamada al cargar) | A (+1 línea B) |
| `server/src/leaguesFake.ts` | `familyLeague` (L461-471: filas U4, `closesInDays = calendarClosesInDays()`); `closeWeek` (L385-413) del activo; `leaguesRoutes` (L474-501: 403 de Ligas, `close-week`, y `405` para todo lo que no es GET en L485); `daysIn` (L208), `weeksAgoLabel` (L258) | Estado de la familia `Map<familyKey, FamilyWeekState>` con seed (§2.1, §2.6); `familyLeague` + aditivos (§6.1); `familyCloseIfDue`, cierre simulado de la familia (§2.4) con `runAsUser` de cada integrante; premio: set/clear/options (§3); rutas nuevas ANTES del 405 de L485; `resetFamilyWeeks`, `crownsOf`. En U5-B: `syncMedals` tras `startNewWeek` en `closeWeek` y en los cierres de la familia + `registerMedalFacts({crowns})` | A (+B) |
| `server/src/market.ts` | `Redemption` (L74) sin origen; `toRedemption` (L196); `listRedemptions` (L212-215) y `deliverRedemption` (L220-228) filtran por `itemOwner(r.itemId) === member` | `Redemption` + `origin?`, `closedAt?`; `grantFamilyPrize(uid, p, closedAt)` con `stores.of(uid)`; los dos filtros aceptan `r.origin === 'liga-familia'` | A |
| `server/src/parent.ts` | `checkTitle`/`checkDesc`/`checkEmoji` privadas (L264-282); `itemOwner` (L497); `activity(mid)` (L859-875); no importa `leaguesFake` (y no debe) | + `checkPrizeFields` y `memberItemsOf(id)` (A); `activity` + `medals: medalsOf(mid, {forParent: true})` (B) | A, B |
| `server/src/medalRules.ts` | — | NUEVO, puro: catálogo de 13 + `earnedFrom` (§5.2-§5.3) | B |
| `server/src/medals.ts` | — | NUEVO, hoja: registros, estado `perUser`, `ensureMedals`/`syncMedals`/`medalsOf`/`resetMedals`, rutas `/api/medals*` | B |
| `server/src/feedFake.ts` | `FeedItem` del server (L84-95); `liveAllowed` (L524-529); `newsItem`/`pushFresh` (L544-556); `summaryOf` (L494-511) cuenta por kind | + kind `medal`; `injectMedalNews` registrado en medals; `liveAllowed` filtra `semana-familia` sin Ligas y `primer-amigo` sin Amigos; `summaryOf` lo ignora | B |
| `server/src/learnResults.ts` | POST (L137-177): `mine.push(row)` en L165, `addXp` en L170 | `ensureMedals(me)` antes de L165 y `syncMedals(me)` antes de responder (las dos ramas); `registerMedalFacts` con lo de Learn (usa `catalogRoutes()` + `routeRuns` de learnProgress para `routesCompleted`) | B |
| `server/src/learnRoutes.ts` | `RouteRow` (L60) sin autor; `importBundle` (L127-139) arma la fila | `RouteRow.createdBy?: string` (= `currentUser()?.id` al importar; la seed poc-solar queda sin autor); `routesCreatedBy(id)`; `syncMedals` tras un import OK. ⚠ Archivo del PORTE (W1): el cambio es metadato aditivo, NO cambia ninguna conducta del creador (la regla suprema de AGENTS se respeta); si el implementador ve que toca algo más, para y reporta | B |
| `server/src/space.ts` | `saveItem` (L361); items con `createdAt`/`trashedAt` (L39-42) | `savedFactsOf(id)` (ítems incluidos los de la papelera); `syncMedals` tras un guardado nuevo (en la ruta que llama `saveItem`) | B |
| `server/src/friendsFake.ts` | `friendCount()` (L378) del activo; `accept` (L650) | `friendCountOf(id)`; `syncMedals` tras aceptar (manual y auto-aceptar del NPC) | B |
| `server/src/index.ts` | reset (L97-110) sin medallas; ruteo (L143-146) | `familyCloseIfDue(me.id)` antes de `/api/leagues/*`, `/api/parent/activity`, `/api/market/redemptions` y `/api/medals` (A); reset + `resetFamilyWeeks()` con `{scope:'all'}` (A); + `resetMedals(id)` y ruteo `/api/medals*` (B) | A, B |
| `server/src/__tests__/familyWeek.test.ts` | — | NUEVO: marcas (copa con ≥ 2 filas y XP > 0; ↑ con `prevXp` null/0/mayor; ✨), total, ganadores de las dos condiciones (empates, todo en 0, adulto 1.º → chico mejor ubicado), `seedWeekDays` (los 7 días de la semana × rachas 2/5/9), `bestRun` | A |
| `server/src/__tests__/progressWeek.test.ts` | ya prueba el corte en la zona de la familia | + `lastWeek` al cortar (con salto de semanas), `weekDays` después de un cierre simulado el mismo día, `pbWeeks`/`fullWeeks`, `comebacks` | A |
| `server/src/__tests__/medalRules.test.ts` | — | NUEVO: cada regla con su borde (9 vs 10 objetivos, `rollup` no cuenta, `pct` 0,99 vs 1, `bestStreak` 2/3…), `times` de las repetibles | B |

### 7.2 Cliente

| Archivo | Hoy (verificado) | Cambio U5 | Tanda |
|---|---|---|---|
| `src/api/types.ts` | `Redemption` (L169), `ParentActivity` (L191-203), `FamilyLeagueRow`/`FamilyLeague` (L449-456) | todo §6.1 MENOS el kind `medal` de `FeedItem` | A |
| `src/api/index.ts` | `familyLeague` (L258), `closeWeek` (L262) | + `familyPrizeOptions()`, `setFamilyPrize(req)`, `clearFamilyPrize()`, `closeFamilyWeek()`, `medals()`, `medalsSeen()` (envoltorios finos, como los de al lado) | A |
| `src/sections/leagues/containers/LeaguesPage.tsx` | la solapa Familia (L105-109) pinta `FamilyRanking`; `simulateClose` (L52-75); un solo chip al pie (L111) | arriba de la tabla: `FamilyPrizeCard` + `FamilyWeekCard`; hoja `FamilyPrizeSheet` (lee `familyPrizeOptions` al abrir); con `tab==='familia'` y `canManage`, el chip del pie dispara `closeFamilyWeek` (aviso `FamilyCloseBanner` + el `LEAGUE_WEEK_CLOSED` de siempre, con `detail = mine`: así la medallita del avatar y el chip de medallas se re-piden sin que C sepa de medallas); con un chico, el chip individual de siempre | C |
| `src/sections/leagues/components/FamilyRanking.tsx` | racha "✨ N días" (L25-27), pie U4 | fila §4.5 (puntitos, ↑, 🏆 chiquita), título "Esta semana: ¿quién aprende más días?" y pie §4.2 | C |
| `src/sections/leagues/components/SimulateCloseChip.tsx` | etiqueta fija | + props `label`/`title`/`busyLabel` opcionales (sin ellas, igual que hoy) | C |
| `src/sections/leagues/components/{FamilyWeekCard,FamilyPrizeCard,FamilyPrizeSheet,FamilyCloseBanner,DaysDots}.tsx` | — | NUEVOS, puros (props) | C |
| `src/sections/leagues/lib/familyWeek.ts` + `__tests__/familyWeek.test.ts` | — | NUEVO: textos (marcas, condición vista por chico/adulto, línea del premio, "Entre todos…"), `prizeDraft` (validación SOLO de forma para habilitar el botón; el motivo real lo da el 400) | C |
| `src/sections/leagues/leagues.css` | `lgf-` (L70-73…) | + `lgw-` (semana pasada), `lgp-` (premio y hoja), `lgd-` (puntitos), `lgx-` (aviso del cierre de la familia) — grepeados: libres | C |
| `src/sections/store/containers/StorePage.tsx` | carga `Promise.allSettled([market, redemptions, ecTx])` (L88) | + `api.familyLeague().catch(() => null)` en la misma carga; tarjeta `FamilyPrizeBanner` arriba de la grilla si el activo es un chico elegible y hay premio | C |
| `src/sections/store/cards/FamilyPrizeBanner.tsx` | — | NUEVO, puro (CSS `stfp-` en store.css; libre) | C |
| `src/sections/store/cards/RedemptionRow.tsx` | "⚡ precio" (L15) | con `origin === 'liga-familia'`: "🏆 Lo ganaste en la liga de la familia" en lugar del precio | C |
| `src/sections/parent/cards/DeliveryRow.tsx` | "⚡ precio" en la meta (L14) | con `origin`: "🏆 De la liga de la familia · cerró el {fecha}" | C |
| `src/sections/parent/containers/RewardsPanel.tsx` | "Premios de la Tienda" (L129-) | línea de solo lectura del premio de la semana + link a `/ligas?tab=familia` (lee `api.familyLeague()`; si falla, no hay línea) | C |
| `src/shared/components/ProfileCard.tsx` | la tarjeta entera es UN botón (L134-142) → "Tu avatar"; `useLastMedal` (L87-104) | envoltorio `div.profile` + botón de siempre + chip `mdl-chip`; hook `useMedals` (patrón `useLastMedal`); `openMedalsSheet()` exportado (patrón `openAvatarPicker`, L54-61) | D |
| `src/shared/components/MedalsSheet.tsx` + `medals.css` | — | NUEVOS (puro + CSS `mdl-`); `src/main.tsx` importa `medals.css` después de `avatar.css` (L15) | D |
| `src/sections/home/containers/FeedPage.tsx` | `block()` (L319-334) sin default | + `case 'medal'` → `FeedMedalCard`; al entrar una noticia de medalla por la píldora, `dispatchEvent('innerith:medals-changed')` | D |
| `src/sections/home/cards/FeedMedalCard.tsx` | — | NUEVO, puro (clases `hf-` del Feed, grepear las nuevas) | D |
| `src/sections/parent/components/ActivityPanel.tsx` | bloques de Actividad (L5-82) | + "Medallas de {integrante} (N)" de `dash.medals` | D |
| `src/api/types.ts` (solo `FeedItem`) | union `FeedItem` (L278-…) | + kind `medal` (§6.1) | D |

### 7.3 Docs (cada tanda, su parte; con Edit sobre anclas propias)

`docs/USUARIOS.md` §12 NUEVA "U5 — La liga de la familia completa y las medallas" (A abre la sección con el modelo y los
contratos; B, C y D suman su subsección) · `README.md` (ligas: familia, premio, cierre; market: canje de la liga; medallas;
`/api/medals*`) · `docs/VISION.md` §13 (filas Ligas, Avatar/reputación, Usuarios: "retos" pasa a "candidato U6: reto de a dos
cooperativo") · `docs/AGENTS.md` regla 9 (+ medallas: RAM por usuario derivada de hechos, en el reset; la semana de la familia:
RAM de la FAMILIA, fuera del reset por usuario, como los avisos).

---

## 8. Plan de tandas

### 8.0 Antes de lanzar (coordinador)

1. Copiar este documento a `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` (el scratchpad es de esta sesión: los agentes lo leen del repo).
2. Que Esteban conteste D1-D4 (§10) o aceptar las recomendaciones; los briefs ya asumen las recomendaciones.
3. Que no haya otro QA contra el mismo server (dos QA con el mismo usuario se pisan: cada carga resetea a ese usuario, U4).

### 8.1 Orden y paralelismo

```
U5-A  server: liga de la familia + TODOS los contratos (types.ts/api)   ──┐
                                                                           ├──► U5-B  server: medallas      ──► U5-D  cliente: medallas ──┐
                                                                           └──► U5-C  cliente: liga familiar ─────────────────────────────┴──► U5-E  QA
```

- **A primero y sola**: congela los contratos (§6) en `types.ts` y `api/index.ts` (menos el kind `medal` del Feed) y deja el server
  de la liga andando. Sin A, ni B ni C tienen contra qué escribir.
- **B ∥ C**: terrenos disjuntos (B = solo `server/`; C = solo `src/` de ligas, Tienda y las dos piezas de Premios de Familia). Lo
  único compartido son los docs: cada uno su subsección de USUARIOS §12 con anclas propias (si un Edit falla porque el otro
  escribió, releer y reintentar).
- **D después de B** (necesita `/api/medals` y la noticia `medal` del server para su E2E); puede solaparse con el final de C
  (terrenos disjuntos: D = `ProfileCard`, `MedalsSheet`, `medals.css`, `main.tsx`, Feed, `ActivityPanel`, el kind `medal` de
  `FeedItem`).
- **E al final**: QA de punta a punta con los guardarraíles (§3.5, §5.1) como checklist.
- Todas con agentes Opus (directiva del dueño: el arquitecto decide, los agentes ejecutan; el QA es honesto). Ninguna commitea.

### 8.2 Verificación común (todas las tandas; `docs/AGENTS.md` "Verificación")

- `npx tsc -b --force` y `npx tsc -p tsconfig.server.json --noEmit` limpios · `npm run build` verde · `npm test` verde (decir
  cuántos archivos/tests había y cuántos hay).
- E2E/humo: si el dev del usuario corre (web 5173 / api 8787), usarlo (tsx watch recarga solo); si no, levantar el propio: api en
  8787 (`npx tsx watch --env-file=server/.env server/src/index.ts`) y web en 5188 (`npx vite --port 5188 --strictPort`), listar
  los PID y MATARLOS al terminar. El 5173 no se ocupa nunca. Navegador: Edge o Chrome headless con `playwright-core` (script
  `.mjs` en el scratchpad de la sesión, capturas a `shots/`, juntar errores de consola y terminar con `console.log('ERR', errs)`).
  Mirar al menos una captura con los propios ojos.
- **Higiene de estado (persistido)**: ANTES de probar, copiar al scratchpad `server/data/{learn-results,space,learn-routes,
  wishlist,parent,identity}.json`; al terminar, comparar byte a byte y, si algo cambió, restaurar CON EL SERVER PARADO (si el
  server es el del usuario, no se para: no postear filas de Learn ni importar rutas; probar esas reglas en unidad y dejarlo
  anotado para U5-E). La RAM se limpia con `POST /api/demo/reset {scope:'all'}` al final.
- Al terminar: actualizar los docs de su parte (§7.3) y reportar: qué se hizo, desvíos (con por qué), bordes nuevos, la
  verificación con números y el estado restaurado.

### 8.3 Brief U5-A — server: la liga de la familia completa (+ contratos)

> Sos el implementador de **U5-A** en Innerith (`/Users/esteban-andres-altamura-kit-digital/Desktop/plataforma-educativa`).
> Leé ENTEROS `docs/AGENTS.md`, `README.md`, `docs/VISION.md` y `docs/USUARIOS.md` §9-§11; después
> `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` §0-§4 y §6-§7 (es la spec; manda sobre cualquier otra cosa salvo AGENTS).
> **Objetivo**: que el server tenga la liga de la familia completa —semana con estado de la familia, cierre real perezoso y
> cierre simulado de toda la familia, premio del padre atado a la semana y el reto de constancia— y que los contratos de TODO
> U5 queden congelados en el cliente.
> **Terreno** (solo estos): `server/src/{users,familyWeek(nuevo),progress,leaguesFake,market,parent,index}.ts`,
> `server/src/__tests__/{familyWeek(nuevo),progressWeek}.test.ts`, `src/api/types.ts` (todo §6.1 MENOS el kind `medal` de
> `FeedItem`), `src/api/index.ts` (los 6 métodos de §7.2), docs. NO toques UI (`src/sections/**`, `src/shared/**`): eso es U5-C/D.
> **Qué hacer**:
> 1. `familyWeek.ts` PURO (sin estado ni imports con estado) con `closeFamilyWeek`, `prizeWinners`, `seedWeekDays`, `bestRun`
>    exactamente como §2.2, §3.4 y §4.3, y su test (§7.1 lista los casos).
> 2. `progress.ts`: `Store` + `lastWeek`/`weekDays`/`bestStreak`/`comebacks`/`pbWeeks`/`fullWeeks`; `rollWeek` y `startNewWeek`
>    guardan `lastWeek {weekStart, xp, days}` y mueven `pbWeeks` (`prevXp !== null && xp > prevXp`) y `fullWeeks` (`days === 7`);
>    `addXp` marca el día en `weekDays` FUERA de `touchStreak` (§4.1), suma `comebacks` si pasaron ≥ 3 días de calendario desde
>    `lastDay`, y lleva `bestStreak = max`. Seeds: `lastWeek` de §2.6 con `days` de `seedWeekDays` (deseados Ian 6 · Luna 7 ·
>    Andrés 3), `weekDays` de esta semana coherentes con la racha, y `medal: {bestStreak, comebacks, pbWeeks, fullWeeks}` de §5.4
>    (los contadores van en A aunque las medallas sean de B). + `weekFactsOf(id)` (vivo) y `seedLastWeekOf(id)` (del seed:
>    el historial sembrado de la familia sale de ACÁ, nunca del progreso vivo, §2.6). Firmas existentes: SIN cambios.
> 3. `users.ts`: `familyKeyOf`. `market.ts`: `Redemption.origin/closedAt`, `grantFamilyPrize` (con `stores.of(uid)`), y los
>    filtros de `listRedemptions`/`deliverRedemption` (§3.4.6). `parent.ts`: exportar `checkPrizeFields` (reusa las 3 privadas;
>    mismos textos) y `memberItemsOf(id)`; NO importes `leaguesFake` desde `parent.ts`.
> 4. `leaguesFake.ts`: estado de la familia (§2.1) con seed (§2.6: historial con la semana pasada, `crowns {luna:1}`); 
>    `familyLeague` con los aditivos de §6.1 (`days`, `bestRun`, `prevXp`, `wonLastWeek`, `prizeEligible`, `prize`, `history`
>    con `label` por posición, `canManage`, `week`, y `closesInDays` simulado si hubo cierre de la familia); `familyCloseIfDue`
>    (§2.3); cierre simulado `POST /api/leagues/family/close-week` en el orden EXACTO de §2.4 (pasos 0-5 y 7; el 6, medallas, es
>    de U5-B: dejá un comentario `// U5-B: syncMedals de cada integrante` en ese punto); premio: `POST …/prize`, `…/prize/clear`,
>    `GET …/prize-options` con los errores LITERALES de §6.2. Las rutas nuevas van ANTES del `405` genérico de `leaguesRoutes`.
>    `resetFamilyWeeks()`.
> 5. `index.ts`: `familyCloseIfDue(me.id)` antes de los cuatro lectores (§6.2, último párrafo); `resetFamilyWeeks()` solo con
>    `{scope:'all'}`.
> 6. Contratos del cliente: §6.1 en `types.ts` (campos nuevos de tipos existentes OPCIONALES) + los 6 métodos en `api/index.ts`.
> **Hecho cuando** (humo por API con `X-Innerith-User`, contra un server fresco): como andres, `GET /api/leagues/family` trae el
> historial sembrado (🏆 Luna 1.350, `total` 2.830, sin ↑), `prevXp` 1.180/1.350/300 y `canManage: true`; como ian,
> `canManage: false` y los POST de familia → 403 con su texto; cada 400 del premio con su texto exacto; premio desde la Tienda
> de Luna (copia emoji/título; archivar el original no cambia lo prometido); `close-week` como andres: historial de 2, marcas
> correctas, con "supera su semana" canje pendiente para Ian (1.240 > 1.180) y no para Luna (1.290 < 1.350); en OTRA corrida
> (`{scope:'all'}` en el medio: después de un cierre todos quedan en 0 y el premio seguiría en juego), con "gana la semana"
> para Luna (1.290, la mayor XP entre los chicos); ⚡ de todos IGUALES antes y después (0 movimientos nuevos); las ligas públicas de los TRES cerraron
> (`/api/leagues/mine` de cada uno con su `lastWeek` nuevo); `GET /api/market/redemptions` como ian muestra el canje
> `origin:'liga-familia'`; `POST /api/parent/deliver?member=ian` lo entrega; `POST /api/demo/reset` como ian NO toca el
> historial de la familia y `{scope:'all'}` sí; sin premio ganado, el premio sigue en juego. Más la verificación común (§8.2).
> **Reporte**: lo de §8.2 + la tabla de seeds tal como quedó (para U5-C) + cualquier desvío del contrato (no debería haber).

### 8.4 Brief U5-B — server: las medallas de la plataforma

> Sos el implementador de **U5-B** en Innerith (mismo repo). Leé ENTEROS `docs/AGENTS.md`, `README.md`, `docs/VISION.md`,
> `docs/USUARIOS.md` §9-§12 (la §12 la abrió U5-A) y `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` §1, §5, §6 y §7.
> **Objetivo**: las 13 medallas derivadas de hechos, su estado por usuario en RAM, `/api/medals*`, la noticia propia en el Feed y
> las medallas de cada integrante en Familia → Actividad. U5-A ya dejó los contratos (`types.ts`) y la liga de la familia.
> **Terreno**: `server/src/{medalRules(nuevo),medals(nuevo),feedFake,learnResults,learnRoutes,space,friendsFake,progress,
> leaguesFake,parent,index}.ts` y `server/src/__tests__/medalRules.test.ts`; docs. En `progress.ts` y `leaguesFake.ts` SOLO
> el registro de hechos y las llamadas a `syncMedals` (el resto es de U5-A). NO toques `src/` (el kind `medal` del `FeedItem`
> del CLIENTE lo suma U5-D; vos lo sumás al `FeedItem` del SERVER en `feedFake.ts`).
> **Qué hacer**:
> 1. `medalRules.ts` puro con `MEDALS` (los 13 de §5.2: emoji, título y texto LITERALES, `domain`, `repeatable`) y
>    `earnedFrom(facts)`; tests de cada borde.
> 2. `medals.ts` HOJA (imports: `perUser`, `requestContext`, `users`, `web`, `medalRules`): `registerMedalFacts`,
>    `registerMedalNews`, estado `{earned: Map, seen: Set}` con seed = derivado + todo visto, `ensureMedals`, `syncMedals`
>    (agrega, nunca saca, `times = max`, noticia por cada nueva), `registerMedalGate` + `medalsOf(id, {forParent})` (filtra las
>    de `domain` con el gate que registra `parent.ts` —`medals.ts` NO importa `parent.ts`: `parent` lo importa a él—; el gate da
>    `true` para un ADULTO porque `featureOn` de un adulto es `false` por fail-closed, §6.3; con `forParent`, todas, con
>    `hidden`), `resetMedals`, rutas `GET /api/medals` y `POST /api/medals/seen` (§6.2).
> 3. Registros de hechos (§5.3, una llamada al cargar cada módulo): `learnResults` (targets completados, primera fecha, perfecta,
>    repaso, rutas completas con `routeRuns(catalogRoutes(), filas)`), `learnRoutes` (`createdBy` NUEVO en `RouteRow` al
>    importar, con `currentUser()?.id`; `routesCreatedBy`; ⚠ porte W1: solo metadato aditivo), `space` (`savedFactsOf`),
>    `friendsFake` (`friendCountOf`), `progress` (los 4 contadores que dejó U5-A), `leaguesFake` (`crownsOf`).
> 4. Disparos de `syncMedals` (§5.3): Learn POST con `ensureMedals` ANTES de `mine.push(row)` y `syncMedals` antes de responder
>    (las dos ramas); guardar en Mi espacio; aceptar amigo (manual y el auto-aceptar con timer); importar ruta; `closeWeek`
>    después de `startNewWeek`; el paso 6 del cierre de la familia (`runAsUser` de cada integrante, donde U5-A dejó el
>    comentario); el cierre real perezoso; y el GET.
> 5. `feedFake.ts`: kind `medal` en el `FeedItem` del server, `injectMedalNews` registrado (entra en lo vivo con `pushFresh`, sin
>    reacciones, `reason: 'Es tu medalla nueva'`, id `fm-<n>`), `liveAllowed` según `domain`, `familyFilter` como toda noticia,
>    `summaryOf` lo ignora.
> 6. `parent.ts`: `registerMedalGate` al cargar (§6.3, con el adulto siempre `true`) y `activity(mid)` + `medals:
>    medalsOf(mid, {forParent: true})`. `index.ts`: `resetMedals(id)` en el reset y el ruteo de `/api/medals*` (con
>    `familyCloseIfDue` antes, como dejó U5-A).
> **Hecho cuando**: con un server fresco, `GET /api/medals` da las pilas del seed de §5.4 (Ian 5 · Luna 4 · Andrés 0, o lo que
> derive de los datos de ese momento: decilo), `unseen: 0`; `close-week` de la familia como andres → `mejor-semana` NUEVA para
> Ian y Andrés (y su noticia `kind:'medal'` en el `/api/feed` de cada uno, en SU feed y no en el de otro); `seen` → `unseen 0`;
> Ligas apagado para Luna (`POST /api/parent/features?member=luna`) → su `semana-familia` desaparece de su `/api/medals` y
> aparece con `hidden:'ligas'` en `GET /api/parent/activity?member=luna`; prender de nuevo → vuelve; reset de Luna → su pila
> vuelve al seed y NADA queda `fresh`. Learn (si el 8787 es TUYO): una posta completada como Luna → `primera-posta` (+
> `posta-perfecta` si `pct` 1) nuevas → restaurar `learn-results.json` con el server parado. Si el 8787 es del usuario: eso
> va en unidad y queda para U5-E. Más §8.2.

### 8.5 Brief U5-C — cliente: la liga de la familia

> Sos el implementador de **U5-C** en Innerith (mismo repo). Leé ENTEROS `docs/AGENTS.md` (reglas 1, 4, 5 y 9 sobre todo),
> `README.md`, `docs/VISION.md`, `docs/USUARIOS.md` §10-§12 y `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` §1-§4, §6 y §7.
> **Objetivo**: la UI de la liga de la familia completa en `/ligas?tab=familia`, el premio en la Tienda del chico y el canje "de
> la liga" en Tus canjes y en Familia → Premios. U5-A dejó el server y los contratos (`types.ts`, `api/index.ts`): no los
> cambies; si te falta algo, paralo y reportalo.
> **Terreno**: `src/sections/leagues/**` (containers, components, lib, `leagues.css`), `src/sections/store/{containers/StorePage,
> cards/RedemptionRow,cards/FamilyPrizeBanner(nuevo)}.tsx` + `store.css`, `src/sections/parent/{cards/DeliveryRow,
> containers/RewardsPanel}.tsx` + `parent.css`; docs. NO toques `ProfileCard`, el Feed, `ActivityPanel` ni nada de medallas
> (U5-D), ni el server.
> **Qué hacer** (todo §7.2 filas "C"): fila §4.5 en `FamilyRanking` (puntitos `DaysDots` sin letras de día, "5 de 7 días", ↑ y
> 🏆 chiquita, nada cuando no se logró); título y pie de §4.2; `FamilyWeekCard` (§2.6: "La semana pasada" + `<details>`
> "Semanas anteriores", marcas, "Entre todos sumaron N XP", línea del premio); `FamilyPrizeCard` (§3.2-§3.3: vista del chico
> "Si superás tu semana anterior: 🚲 … · Te lo da Andrés"; del adulto con Cambiar / Quitar y, si el último premio se consumió,
> "Repetir el de la semana pasada" con `history[0].prize`); `FamilyPrizeSheet` (dos maneras + condición con radios nativos;
> D1 preselecciona "supera su semana"; el `error` del 400 se muestra TAL CUAL; foco y Esc como las hojas de la casa); chip del
> pie para el adulto en la solapa Familia → "Simular cierre de la semana de la familia" (`SimulateCloseChip` con props
> opcionales) + `FamilyCloseBanner` (patrón `CloseBanner`: festejo chico una vez, foco al título, la línea de "tu liga también
> cerró" con `closeCopy(mine)`) + `LEAGUE_WEEK_CLOSED` con `detail = mine`; Tienda: `FamilyPrizeBanner` arriba de la grilla
> (§3.3; nada de precio, Canjear ni corazón); `RedemptionRow`/`DeliveryRow` con `origin`; línea del premio en `RewardsPanel`.
> Textos: los de la spec, voseo, tono de 9 años, neutros en género; nada de "perdiste", "último", "te faltan".
> **Prefijos CSS** (grepeados libres el 28-oct; regrepealos): `lgw-`, `lgp-`, `lgd-`, `lgx-`, `stfp-`. Ojo con `*/` adentro de
> comentarios de CSS (regla 5).
> **Hecho cuando** (E2E en el navegador): como Andrés, la solapa Familia muestra la semana pasada sembrada, la tabla con
> puntitos y ↑ de Ian y Andrés; poner un premio de la Tienda de Luna → la tarjeta lo muestra; switch a Luna (no resetea):
> "Si superás tu semana anterior: …", y en su Tienda la tarjeta arriba de la grilla; switch a Andrés → simular el cierre de la
> familia → aviso + historial de 2 + el canje en Familia → Premios de Ian ("🏆 De la liga…") → "Ya se lo di"; switch a Ian →
> Tus canjes con "Lo ganaste en la liga de la familia · Entregado"; un 400 provocado (título de 1 letra) muestra el texto del
> server; con Ligas apagadas para Luna, su Tienda no muestra la tarjeta y la solapa sigue para Ian y Andrés. Captura de cada
> pantalla mirada a ojo. Más §8.2 (tests de `lib/familyWeek.ts`).

### 8.6 Brief U5-D — cliente: las medallas

> Sos el implementador de **U5-D** en Innerith (mismo repo). Leé ENTEROS `docs/AGENTS.md`, `README.md`, `docs/VISION.md`,
> `docs/USUARIOS.md` §10-§12 y `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` §1, §5, §6 y §7. U5-B dejó `/api/medals*`, la noticia
> `kind:'medal'` y `ParentActivity.medals`.
> **Objetivo**: la cantidad en el perfil, la pila "como un diploma", la noticia propia en el Feed y las medallas del integrante
> en Familia → Actividad, con las cinco reglas de §5.1 (solo las ganadas, nada de huecos ni "próximas").
> **Terreno**: `src/shared/components/{ProfileCard,MedalsSheet(nuevo)}.tsx`, `src/shared/components/medals.css` (nuevo, `mdl-`),
> `src/main.tsx` (el import), `src/sections/home/{containers/FeedPage,cards/FeedMedalCard(nuevo)}.tsx` + `home.css`,
> `src/sections/parent/components/ActivityPanel.tsx` + `parent.css`, y en `src/api/types.ts` SOLO el kind `medal` de `FeedItem`
> (§6.1); docs. NO toques Ligas, Tienda, Premios ni el server.
> **Qué hacer** (§5.5 a-d al pie de la letra): `ProfileCard` pasa a `div.profile` con dos botones hermanos (el de siempre y el
> chip `mdl-chip` "🏅 N" con puntito si `unseen > 0`; sin medallas no hay chip); `useMedals` (patrón `useLastMedal`: montar,
> entrar/salir de Ligas, foco, `LEAGUE_WEEK_CLOSED`, `innerith:medals-changed`); `openMedalsSheet()` (patrón
> `openAvatarPicker`); `MedalsSheet` pura (grilla de discos con cinta, título, texto, "Desde el …", "×N", "Nueva"; al abrir
> `POST /api/medals/seen`; Esc, fondo, ✕, foco de vuelta al chip); `FeedMedalCard` + `case 'medal'` en `FeedPage.block` +
> `innerith:medals-changed` cuando una noticia de medalla entra por la píldora; bloque "Medallas de {integrante}" en
> `ActivityPanel` (con la nota de las `hidden`). Nada de toasts globales ni de tocar el overlay de Learn (porte Smarty).
> La tarjeta del perfil vive en una barra con container query (`@container side (max-height:783px)`): el chip tiene que entrar
> en la densidad compacta sin empujar el nombre (`min-width:0` y elipsis en el nombre, como hoy).
> **Hecho cuando** (E2E): como Ian, el chip "🏅 5" (o lo que derive), la hoja con sus medallas sin ningún hueco ni total;
> switch a Andrés: SIN chip; simular el cierre de la familia → el chip aparece con "1" y su puntito, la píldora del Feed trae
> "Ganaste la medalla «Superaste tu semana»" y "Ver tus medallas" abre la hoja con "Nueva"; cerrar y reabrir → sin "Nueva";
> Familia → Actividad de Luna con sus medallas; con Ligas apagadas para Luna, su copa no está en SU hoja y en Actividad figura
> con la nota. Capturas a ojo (barra normal y compacta). Más §8.2.

### 8.7 Brief U5-E — QA de punta a punta (honesto)

> Sos el QA de **U5** en Innerith (mismo repo). Leé `docs/AGENTS.md`, `docs/USUARIOS.md` §10-§12 y
> `docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md` entero. NO arreglás código: encontrás, reproducís y reportás (con severidad y el paso
> exacto). Si algo de la spec no se cumple, es un hallazgo aunque "ande".
> **Checklist**: (1) los guardarraíles del premio (§3.5) uno por uno, con el saldo de ⚡ y los movimientos de cada integrante
> antes/después; (2) las cinco reglas de las medallas (§5.1): buscar cualquier "N de 13", silueta, candado, "próxima", "te
> falta", total o ranking de medallas, en la UI y en las respuestas de la API (el catálogo NO debe viajar); (3) nada punitivo
> (§2.2): ningún "último", "bajó", "perdiste", flecha gris o "te faltan N" en Ligas, Tienda, Feed ni Familia; (4) los flujos de
> los "Hecho cuando" de A-D, en el navegador y por API, con el switch de usuario (que NO resetea) y con F5 (que resetea SOLO al
> activo: el historial de la familia sobrevive); (5) los bordes documentados (§2.5, §2.7, §5.6) se comportan como dice la spec;
> (6) candados: Ligas apagadas para un chico (403, sin tarjeta en Tienda, copa escondida), Tienda apagada (el premio igual se ve
> en Ligas), Amigos apagado (sin `primer-amigo`), Ciclo del día cerrando Tienda (el premio en Ligas no depende de la Tienda);
> (7) accesibilidad básica: foco al abrir y cerrar cada hoja y aviso, Esc, radios con flechas, `aria-label` del chip; (8)
> consola limpia salvo errores provocados a propósito; (9) Learn con datos reales SOLO en tu propio server: completar 3 postas
> como Luna (supera 1.350 → ↑ y canje con "supera su semana"; `primera-posta` nueva) y restaurar `learn-results.json` con el
> server parado; (10) la verificación común (§8.2) completa, y el estado restaurado byte a byte.
> **Reporte**: tabla de hallazgos (severidad · dónde · cómo reproducir · qué dice la spec), qué se verificó y qué NO se pudo
> verificar (por ejemplo, el cierre real de un lunes: solo por test puro e inspección), y el estado final de `server/data`.

---

## 9. Riesgos

| # | Riesgo | Probabilidad / daño | Mitigación |
|---|---|---|---|
| R1 | **Lo que la evidencia sigue desaconsejando y se hace igual** (a conciencia): el premio del padre es ANUNCIADO (G4: −0,36), la copa es escasa (G2), la tabla en vivo conserva puestos entre hermanos (decisión U4 D2), y hay medallas de constancia y desempeño (eje L) | Seguro que existe; el daño real en una familia de 2-4 es desconocido (eje M: no hay estudios) | El premio no es escaso por defecto (D1) ni aleatorio; el resumen no tiene puestos; nada se pierde; las medallas no tienen huecos ni catálogo; todo cuelga de Ligas, que el padre apaga por chico. En el producto real, Ligas debería nacer APAGADA para menores (DSA, G15): no es de U5, queda anotado para Esteban |
| R2 | **"F5 a medias"**: el canje del premio vive en el slice del chico y se va con SU F5; las medallas de hechos en RAM vuelven al seed; el historial de la familia, no | Alta en una demo con switch + F5 | Documentado (§2.7, §5.6) y en USUARIOS §12; el QA lo verifica como borde, no como bug. Es el mismo modelo de U4 ("tu F5 es tu demo nueva") |
| R3 | **Ensuciar el estado real del demo**: las postas de Learn persisten (la primera de Luna es una vez por entorno) y `createdBy` se escribe en `learn-routes.json` | Media (QA y E2E) | §8.2: respaldo antes y comparación byte a byte después; restauración con el server parado; si el 8787 es del usuario, esas pruebas van en unidad y quedan para U5-E |
| R4 | **Tocar un archivo del porte** (`learnRoutes.ts`, W1: "funcionalidad EXACTA") para `ruta-creada` | Baja | Es metadato aditivo que no cambia ninguna conducta; si el implementador ve que cambia algo más, para y reporta, y `ruta-creada` sale del catálogo de U5 (quedan 12) antes que romper el porte |
| R5 | **Ciclos de import**: el server ya tolera algunos (parent ↔ market) bajo la regla "nadie llama al otro al cargar" | Media si se improvisa | `medals.ts` es HOJA y todo entra por registros (§6.3); `parent` no importa `leaguesFake` (el disparo perezoso va en `index.ts`); los registros solo GUARDAN funciones al cargar |
| R6 | **Calendarios que se desalinean**: el cierre individual de "Mi liga" corta la semana de uno solo (U4 A6); el lunes real cierra la familia pero no las ligas públicas | Media | Tabla §2.5; el cierre de la familia las vuelve a alinear; documentado como borde |
| R7 | **El cierre real depende de que alguien abra la app**, y tras varias semanas sin uso se rotula por posición ("la semana pasada") | Baja en demo | Aceptado (§2.3); el cierre real de verdad es del backend |
| R8 | **Reestructurar la tarjeta de perfil** (de un botón a un div con dos): puede romper la densidad compacta del menú (`@container side`), el foco de vuelta de "Tu avatar" o el hover | Media | Brief D lo marca; capturas en las dos densidades; el QA mira el foco |
| R9 | **Entre B y D**, el server ya emite la noticia `medal` y el cliente todavía no la pinta: la píldora puede decir "1 novedad" y no aparecer nada | Segura, temporal | D va inmediatamente después de B; nadie demuestra U5 entre las dos tandas |
| R10 | **Texto libre del padre** en el premio "Uno nuevo": no pasa por moderación (como los premios de la Tienda) | Baja | Es el adulto de la familia escribiéndole a su hijo; misma política que hoy (`market.ts`: "Los textos los escribe el padre") |
| R11 | **Alcance de U5-C** (la tanda de UI más grande: 5 componentes nuevos + Tienda + Premios) | Media | Si se estira, partirla en C1 (Ligas) y C2 (Tienda + Premios de Familia): terrenos disjuntos |

---

## 10. Decisiones abiertas (máx. 4; con recomendación)

**D1 — ¿Qué condición del premio arranca elegida?** (a) "Para todos los que superen su semana anterior" · (b) "Para el que gane
la semana" (la visión literal: "ganame y te compro una bici") · (c) ofrecer una sola.
**Recomendación: (a)**, con (b) a un toque. El padre sigue pudiendo hacer el "el que gane se lo lleva"; lo que cambia es el
default, que es lo que la mayoría deja (G2: −0,15 vs −0,88; en una tabla de 9, 12 y un adulto, (b) la gana casi siempre el
mayor —07 §2.6—). (c) quita una elección que la visión pide.

**D2 — ¿Cómo se cuenta el reto de constancia?** (a) "N de 7 días" de la semana · (b) "días seguidos" dentro de la semana (el
mejor tramo, que también solo sube).
**Recomendación: (a).** Es la ventana semanal de Strava (un día malo no cuesta nada, 08 §2.5) y no esconde una racha rota
detrás de otro nombre. (b) está más cerca del "ganame la racha" del audio y queda a un cambio de cliente (el server ya manda
`bestRun`).

**D3 — ¿Las medallas persisten en disco?** (a) RAM por usuario, sembradas desde los hechos (las de Learn y Mi espacio
sobreviven al F5 porque sus hechos persisten; las de racha, semanas y copa vuelven al seed con el F5, como la XP) · (b)
`server/data/medals.json` v1 por usuario.
**Recomendación: (a).** La demo queda repetible ("Superaste tu semana" vuelve a aparecer en cada demo), sin archivo nuevo ni
migración, y coherente con la regla 9. (b) cumple el "nunca se pierde" al pie de la letra, pero cada "primera vez" se gasta UNA
vez por entorno, hay que limpiar el archivo tras cada QA, y una copa de una semana que el F5 borró seguiría en la pila. El
contrato "nada se pierde" lo hereda el backend real.

**D4 — ¿Quién cierra la semana de la familia (demo) y pone el premio?** (a) solo un adulto · (b) cualquier integrante cierra
(el premio sigue siendo del adulto).
**Recomendación: (a).** El que media es el padre (1008: "si el padre quiere que el otro empuje…"); que un chico cierre la
semana de TODOS —y de paso la liga pública de su hermano— es darle poder de sanción dentro del equipo (07 §2.5). El chico
conserva su "Simular cierre de semana" de siempre, que cierra solo la suya.

---

## 11. Resumen para Esteban

1. La liga de la familia deja de ser solo una tabla: tiene semana con cierre (el lunes de la familia, o el botón de demo del
   adulto), historial de 8 semanas y la "copa de la semana" 🏆 para el que más sumó.
2. Al cerrar nadie pierde nada: no hay "último" y cada uno puede ganar "superó su semana" ↑ y "aprendió los 7 días" ✨.
3. Premio del padre: "1 hora de bici" (de la Tienda del chico o escrito), para "el que gane la semana" o para "todos los que
   superen su semana"; sugiero arrancar con el segundo (D1).
4. El premio no usa ⚡ ni sorteo: el ganador lo ve en Tus canjes, y vos lo entregás desde Familia → Premios como siempre.
5. El reto es "¿quién aprende más días esta semana?", con siete puntitos que solo se llenan; no se ve qué día faltó.
6. No hago el duelo 1 a 1 "ganame la racha": la evidencia lo marca como el peor caso. Propongo para U6 un reto de a dos
   cooperativo entre hermanos.
7. Medallas tipo GitHub: 13 para arrancar (primera posta, sin un error, ruta completa, tu primera ruta, primer amigo, tres días
   seguidos, semana completa, copa de la familia…). Solo se ven las que ganaste: sin catálogo ni huecos.
8. En tu tarjeta de perfil va la cantidad ("🏅 5") y al tocarla, la pila "como un diploma"; el adulto ve las de cada chico en
   Familia → Actividad, y los hermanos no se ven la pila entre sí.
9. Las medallas no dan ⚡, no se compran y no se pierden. En la demo viven en RAM y se rearman solas desde lo que hiciste (D3).
10. Son 5 tandas: primero el server de la liga; después, en paralelo, el server de medallas y la UI de la liga; después la UI de
    medallas, y el QA al final. Sin archivos nuevos. Quedan 4 decisiones (D1-D4), todas con recomendación.
