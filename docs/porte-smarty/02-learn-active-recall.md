# Porte Smarty→Innerith · Informe 2: Learn y Active Recall

> Análisis de ingeniería inversa sobre `smarty-poc` rama **develop**, HEAD `47f434b` (12-oct-2026).
> Pedido de Esteban: funcionalidad EXACTA, sin recortes. Informes hermanos: 01 route-lab+Crear,
> 03 MyTube/After Day/arquitectura, 00 mapa consolidado.

## 0. Base de la verificación
- Lectura estática (no se corrió la app ni los tests); lo deducido va marcado **(inferido)**.
- Leído completo: `app/src/learn/**` (del AudioEngine solo FX/moods/stems), `lib/learn.ts`, `lib/recall.ts`, `zones/child/{Learn,RutaView,RouteCreator,ReadingView,VideoReadingView,ChildShell}.tsx`, `db.ts`, `lib/{backup,settings,featureSchedule,reader,routeCover,overlayNav,llm}.ts`, `zones/admin/LearnRoutes.tsx`; en route-lab `server.py`, `stages/{module,mc,emit,plan,generate,bundle,extract,ingest}.py`, `core/{llm,job}.py`; un job real (`70-module.json`) y el bundle de `poc-solar`.
- Docs contrastados: ACTIVIDADES, RUTAS_GENERADAS, AUDITORIA_FACTS, ESTADO, SPEC (no cubre Learn), SCENE_DIRECTOR, MOTOR_AUDIO, `research/gamificacion/09-grounding-codigo.md`, `docs/INFORME_BETA.md`.
- El último commit que toca `app/` es `d844f2a` (botón Borrar ruta en /crear); lo posterior es docs.

## 1. Resumen ejecutivo
1. **Learn es UNA sola sección** (`/learn`, menú "Learn", título "Aprender"): mosaico de Rutas por categoría + botón raíz **"Active recall"** (repaso entre rutas, sin fin). Al abrir una ruta: camino estilo Duolingo de **Postas** agrupadas en **Módulos**. No hay secciones separadas de contenido/práctica/repaso.
2. **"Colapsado" en el código**: cada módulo = **posta de contenido** (lectura zen o video + preguntas de comprensión en el MISMO overlay, aprobada con `passThreshold`, 70% por defecto) + **N postas de profundización** (una por concepto) + **posta de Repaso** opcional. El contenido también se abre desde el encabezado del módulo ("guidebook", sin bloqueo ni registro).
3. **El progreso es 100% derivado.** No se guarda estado de postas: una fila por partida terminada en `activityResults`, atribuida a un **`target`**. Posta lograda = su target tiene ≥1 intento (o `bestPct ≥ passThreshold` si hay umbral). Desbloqueo lineal. Estrellas por `bestPct`.
4. **Tipos jugables**: `flashcards`, `multiplechoice`, `quiz`, `domino`, `multi`. Corrección **determinística y local. Cero LLM en tiempo de juego.** Las rutas reales solo traen **opción múltiple (single) y flashcards** (generadas offline por route-lab; el LLM se usa para facts y distractores).
5. **Active recall** = el mismo motor (Tipo multi) en dos lugares: posta de repaso en la ruta (K = min(5,n), alcance módulo o lo previo) y raíz (todas las rutas, sin fin, en ciclo). Orden por urgencia `0.6·(1−lastPct) + 0.4·min(1, Δt/3 días)`. **Sin umbral, sin fechas, sin SRS por ítem.**
6. **No hay contabilidad por fact ni por ítem**: lo más fino es `skills` por resultado, y en lo generado `skill === target`.
7. **Gamificación** = puntos de partida, estrellas, efectos visuales/sonoros y música por escena. **No hay XP, EC, vidas, rachas de días ni insignias.**

## 2. Superficie: rutas, navegación y acceso
| Ruta | Componente | Qué es | Acceso |
|---|---|---|---|
| `/learn` | `Learn.tsx` | Mosaico de rutas + Active recall | `settings.learnActivo` (default OFF) + horario (`isFeatureOpen`, falla en abierto) |
| `/crear` | `RouteCreator.tsx` | Creador por módulos (pensado para el adulto; hoy en el menú del chico) | Menú depende de `learn`; **la URL no está protegida** |
| `/admin` → Ajustes | `LearnRoutes.tsx` | Toggle Learn beta, generar ruta completa (`POST /routes`), importar bundle, listar, borrar | PIN |

- `ChildShell` corta todo sin `settings.apiKey` (OpenAI), aunque Learn no la use al jugar.
- **La ruta elegida es estado de React (`routeId`), no URL.** Atrás desde `RutaView` sin overlays sale de `/learn`.
- Overlays (`ActivityOverlay`, `ReadingView`, `VideoReadingView`) con `useOverlay`: pushState + pila + z-index creciente; "Atrás" cierra el de arriba.

## 3. Modelo de datos
### 3.1 Tipos de dominio (`lib/learn.ts`, `learn/registry.ts`)
**`LearnRoute`**: id · title · description (el creador no tiene input: queda `''`) · emoji · postas: Posta[] · modules?: RouteModule[] · cover? (dataURL JPEG 640×360) · category? (texto libre; `LEARN_CATEGORIES` sugiere 13 materias).
**`RouteModule`** (solo presentación, no anida postas): id · title · emoji? · source? `{url, title, kind?: 'article'|'video', videoId?}`.
**`Posta`**: id · title · kind? `'activity'` (default) | `'recall'` · definitionId? · **target** (clave del progreso) · reading? `{url,title,kind?,videoId?}` (contenido previo a la actividad) · passThreshold? [0,1] (sin él, la posta se logra con jugarla) · moduleId?.
**`DefinitionRecipe`** (dato serializable): id · typeId · title · target · generatorId · params · mode `'untimed'|'timed'` · durationSec.
- **No existe kind "examen"** (es `passThreshold` sobre una posta) ni la entidad "Serie".

### 3.2 IndexedDB (Dexie `smarty` v16)
**`activityResults`** (v15; `'++id, target, finishedAt'`; append-only; único escritor `recordResult`): id · target · source (`ruta:<routeId>/posta:<postaId>` o `active-recall`) · typeId (**= `result.activityId`**, id de módulo — ver Trampas) · definitionId? · outcome `completed/timeout/aborted` · score · maxScore · pct · finishedAt (reloj del dispositivo) · skills? `Record<skill,{attempts,correct}>` · seed? · rollup? (true en el agregado de un multi; **nadie lo lee**). NO se persisten stats (correct/wrong/hints/bestStreak), durationMs, startedAt, config ni version.
**`learnRoutes`** (v16; `'&id'`): id · enabled (siempre true, sin UI) · origin `'generated'` · importedAt · route (JSON opaco) · meta? · editorial? `{modules:{[id]:{captionKind?, jobId?, inventory?}}}` (el chico no lo ve).
**`learnDefinitions`** (v16; `'&id, target, routeId'`): id · routeId (borrado en cascada) · target · importedAt · def (DefinitionRecipe opaco).
- Además hay **catálogo en memoria** (`definitions.ts`): seeds en código + importadas (hidratadas async al arrancar con `hydrateImportedDefinitions`).
- **Backup:** `activityResults` → ámbito "sesion"; `learnRoutes`/`learnDefinitions` → "catalogo".

### 3.3 Convención real de ids y targets
**Creador (`routeDraft.ts` + `/module`):** ruta `ruta.<12 aleatorios>` · módulo `m-<6>` · comprensión: posta `<M>.check` / def `<R>.<M>.d.check` / target `<R>.m.<M>.check` · profundización: posta `<M>.t.<concepto>` / def `<R>.<M>.d.<concepto>` / target **`<R>.t.<concepto>`** (de la RUTA, no del módulo) · repaso: posta `r-<M>` / target `<R>.m.<M>.recall` (nunca se escribe) · manual: `p-<6>` / `<R>.d.manual-<6>` / `<R>.t.manual-<6>` · preguntas `<M>.check.q<n>` y `<M>.<c>.q<n>`; opciones `o1` (la correcta) a `o4`; cartas `<M>.<c>.c<n>`. **Las preguntas NO guardan el id del fact.**
**Admin `/routes`:** ruta `ruta.<slug>` · postas `p<n>`, repasos `r<n>` + `rend` · defs `<R>.d<n>` · targets `<R>.t.<concepto>`, `<R>.recall-<n>`, `<R>.recall-final` · acá las cartas SÍ llevan `card.id = id del fact`.

## 4. "Aprender y practicar colapsado": una ruta en juego
### 4.1 Jerarquía
Ruta → Módulos (rótulos) → Postas (nodos). Las postas de un módulo son contiguas en `route.postas`; orden y bloqueo salen del array; `moduleId` agrupa visualmente. Las rutas de `/routes` no tienen módulos (lista plana).

### 4.2 Anatomía de un módulo (como lo arma `flatten`)
1. **Contenido + comprensión** (primera del módulo): `kind:'activity'` con `reading = module.source` y `passThreshold` (default 0.7, editable "Aprobar con N %"). Su definición: opción múltiple o flashcards "Comprensión de la lectura" — un fact por concepto, tope 4 (edad ≤9) o 6, ±2 según tamaño, mínimo 2.
2. **Profundización**: una posta por concepto con ≥2 facts. Tope de conceptos: 2 (chica) / 4 (auto) / 6 (grande). Hasta `maxCards` facts por concepto: 6 (≤9) u 8; +1 en avanzado; ±2 por tamaño. **Sin umbral.** También manual (flashcards a mano).
3. **Repaso del módulo** (checkbox): `kind:'recall'`, título `Repaso — <módulo>`.

### 4.3 El camino (`RutaView`)
- Zig-zag por índice global. Encabezado de módulo sticky con color (6 colores en ciclo) y "ver" (guidebook sin bloqueo/registro).
- Ícono del nodo: si hay `reading`, video o libro ("Ver video"/"Lectura"); si no, según el tipo.
- Estados: bloqueada (gris) · disponible (pulsa) · lograda (color + check + estrellas). Recall: nodo distinto, subtítulo "repaso", nunca lograda ni estrellas.
- Posta sin `definitionId` → modal: "Acá se va a abrir la actividad. (próximo paso: enchufar el motor de actividades)".

### 4.4 Reglas de estado (`resolveRoute`, exactas)
```
prevDone = true
por posta (en orden):
  recall:  estado = prevDone ? available : locked ; estrellas 0 ; prevDone NO cambia
  normal:  stat = byTarget[target]        // sobre TODAS las filas
           done = stat && (passThreshold != null ? bestPct >= passThreshold : attempts > 0)
           estado = done ? done : prevDone ? available : locked ; prevDone = done
estrellas: bestPct ≥0.9→3 · ≥0.7→2 · >0→1 · si no 0 (solo si done)
progreso de la tarjeta = done / postas no-recall
```
- La clave es el target: **cualquier partida lo mueve** (otra ruta, el recall, un replay). Replays siempre permitidos; cada uno agrega fila.

### 4.5 Flujo de una posta (`ActivityOverlay`, pantalla completa)
| Fase | Cuándo | Qué hace | Escena |
|---|---|---|---|
| `reading` | reading tipo artículo, no recall | `ReadingView` modo `trusted`; CTA "Empezar preguntas →" SIEMPRE visible (aun si la página falla); "Atrás" también pasa a preguntas | `lectura` |
| `video` | `reading.kind==='video'` con videoId | `VideoReadingView`: youtube-nocookie, sandbox, controles nativos, tope `maxVolVideo`; CTA arriba y al pie + "Mirá el video y después seguí con las preguntas" | `video` (pausa música) |
| Lobby `idle` | siempre | Título, "¡Cuando estés, dale!", "[play] ¡Empezar!" (desbloquea audio), cuenta 3-2-1-"¡Ya!" (700 ms + 450 ms) → `start()` | `actividad` |
| `running/paused` | | Título, `score/maxScore`, Pausar/Reanudar, **Rendirse** (abort); tablero del tipo | `actividad` |
| `finished` | | "¡Lo lograste!" si completed, si no "Terminó"; score/max + aciertos, errores, mejor racha, duración; **"Jugar de nuevo"** (re-acuña con otra seed, NO re-muestra contenido) y "Cerrar" | `gano`/`perdio` |
| Error | def fuera del catálogo | "No encontré esta actividad" / "La definición «id» no está en el catálogo." | |

El consumo de contenido **no se registra**; solo el resultado de las preguntas.

### 4.6 Qué se graba (`recordResult`, sin await)
- Posta normal: al finished (completed o aborted) **1 fila** con el target de la posta.
- Posta con definición multi (solo seed): 1 fila por hijo (target del hijo) + 1 agregada con `rollup:true`.
- Recall: 1 fila por hijo terminado; el agregado nunca.
- Cerrar con X o atrás antes de terminar: nada (en recall se pierde el hijo en curso).

## 5. Motor de actividades
**Núcleo (`learn/activity/`):** `ActivityCore` maneja ciclo `idle→running↔paused→finished`, reloj con pausa (tick 250 ms), puntaje, racha por partida, stats, `skills`, y arma `ActivityResult` con `definitionId` y `seed`.
**Bus (`Emitter`)** con try/catch por listener: `started` · `tick{elapsedMs,remainingMs}` · `move:correct{points,streak,skill?}` · `move:wrong{skill?}` · `hint` · `paused` · `resumed` · `finished{result}` · canal libre `signal{ns,type,data}`.
**Puntaje (`scoring.ts`):** `DEFAULT_SCORE={base 10, streakBonus 2, hintPenalty 5}` · `pointsForCorrect = 10+2·(racha−1)` · `perfectScore(n)=n·(n+9)` (+pozo de tiempo solo timed) · bono de tiempo solo timed. **Ninguna definición usa `timed`.**
**Registry:** `typeId → {module, Board, build}`; `build` = generador registrado → **portero** `validateContent` (falla con causa) → `createActivity`.
**Definiciones:** catálogo seed (12, ya sin rutas que las usen) + importadas; `definitionsForTarget` devuelve seed primero. Seed de `makeSeed()` por `Date.now()`; generadores determinísticos (mulberry32 + Fisher-Yates).

## 6. Catálogo completo de tipos
| typeId / id persistido | Contenido | Generadores | Portero | Mecánica y corrección | Puntaje | Fin |
|---|---|---|---|---|---|---|
| `flashcards` / `flashcards` | `{cards:[{id,front,back,skill,hint?}]}` | `static` (la seed baraja) | id/front/back no vacíos; ids únicos | Dar vuelta revela (no puntúa); **autocalificación** "La sabía"/"No la sabía"; pista en el frente sin penalidad | 10+2·(racha−1); max `perfectScore(n)` | completed tras la última |
| `multiplechoice` / `multiplechoice` | `{questions:[{id,prompt,mode:'single'|'multi',options:[{id,text,correct}],skill}]}` | `static` (baraja preguntas Y opciones) | ≥1 pregunta; ids únicos; modo válido; ≥2 opciones; textos únicos case-insensitive; single exactamente 1 correcta | Envío diferido ("Comprobar"); tarjetas giran mostrando acierto/error/era-correcta/neutro; "Continuar →". Single binario; multi `clamp((aciertos−errores)/correctas)`; sin correctas, 1 solo si no marcó nada; atajos "Todas"/"Ninguna" (multi) | **Plano**: `round(fracción·10)`; max 10·n; fracción>0 emite move:correct; emite `signal answered{questionId,fraction}` (nadie lo consume) | completed |
| `quiz` / **`quiz-relampago`** | `{questions:[{id,prompt,answer,options[],skill}]}` | `math` (`{questionCount,maxValue,ops['+','-','×'],optionCount}`) y `capitales-latam` (`{count,optionCount}`, 12 pares) | answer ∈ opciones; únicas; ≥2 | Tocar opción: incorrecta se tacha y sigue en la misma; correcta avanza | 10+2·(racha−1); max perfectScore(n) | completed |
| `domino` / `domino` | `{starter:Tile, hand:Tile[]}`, `Tile{id,left,right}`, `Cell{key,label,variant?,tag?}` | `math` (`{maxValue,ops['+','-'],tileCount}`) y `capitales-latam` (`{count}`) | cada key ≤2 veces; exactamente 2 keys de extremo; **simula la partida completa** (detecta cortes/ciclos) | Arrastrar ficha a un extremo (kit DragDrop); key coincide=coloca, si no error; **Pista** −5 resalta jugable; skill=tag (`suma/resta/capitales/general`) | 10+2·(racha−1); max perfectScore(mano) | completed con mano vacía |
| `multi` / **`multi-actividad`** | `{next(i), total?, runtime}` | `fixed` (`{childIds}`, hijo i seed+i+1) y el armador de recall | **ninguno** | Secuencia de hijos; replica eventos del hijo; corta racha entre hijos; emite `child-finished{result,target,definitionId}` | sesión con DEFAULT_SCORE; max = suma de hijos | completed cuando next()=null; sin fin solo con abort |

**No existen:** V/F, abierta (diseñada en borradores, sin empezar), ordenar, unir, completar. Sin corrección LLM. **Al chico llegan:** opción múltiple single + flashcards (route-lab); quiz y dominó solo con contenido seed; en el creador figuran "próximamente".

## 7. Active Recall
### 7.1 Dónde vive y cuándo
- **Raíz (`Learn.tsx`):** botón "Active recall / Repasá lo que más necesitás · N temas" (aparece si hay ≥1 target jugado con definición hoja; N = esos targets). Abre ActivityOverlay título "Active recall", `source:'active-recall'`. **Sin fin** (termina con Rendirse o cerrar).
- **Posta de repaso en ruta (`RutaView.play`):** alcance = targets de postas no-recall ANTERIORES (si tiene `moduleId`, solo su módulo), filtrados a jugados, orden por urgencia, K = min(5, n). Sin targets → click no hace nada (silencioso). Las rutas de `/routes` ponen repasos cada 3 postas (edad ≤9) o 4 + "Repaso final" (también acotado a 5 en la app).
- **No existe** sesión diaria, notificación, vencimiento, "estás al día", ni propuesta desde chat/feed.

### 7.2 De dónde salen las cartas
Para cada target, la **primera definición hoja** que lo entrena (comprensión o la de su concepto), **re-acuñada con seed nueva** → en `static` es **el mismo set barajado**, no datos nuevos. Se repasa el set entero; no hay registro de errores por ítem.

### 7.3 Algoritmo exacto (`lib/recall.ts` + `recallActivity.ts`)
```
rows = db.activityResults.toArray()            // TODAS: abortadas y de recall incluidas
por target (orden finishedAt asc): attempts · lastPct (última) · bestPct (max) · lastSeen (max)
urgency = 0.6·clamp01(1−lastPct) + 0.4·clamp01((now−lastSeen)/3 días)     // SPACING_WINDOW_MS = 3d
dueTargets: TODOS (scope opcional), sin minUrgency ni limit, orden desc
recallable = dueTargets con definición hoja (typeId ≠ 'multi')
raíz:    hijo i = leafDef(order[i % n]) con seed base+i+1   (cicla; orden fijado UNA vez al tocar)
en ruta: hijo i = leafDef(order[i]) para i < min(5, n)
```
Ejemplos: lastPct 0 recién → 0.60 · 0.5 hace 1 día → 0.433 · 1 recién → 0 (igual entra, al final) · 1 hace ≥3d → 0.40 · 0 hace ≥3d → 1.0. `skillMastery` existe y **no se usa**. Sin SM-2/half-life: lineal, satura a 3 días.

### 7.4 Acertar y errar
Feedback normal del tipo durante el repaso. Al terminar cada hijo se graba su fila (target del hijo; source ruta/posta o active-recall) → actualiza bestPct (**puede destrabar postas reales, incluida una comprensión con umbral**) y lastPct/lastSeen (baja urgencia). Sin re-encolado de lo fallado.

### 7.5 UI funcional
Lobby + cuenta regresiva → `MultiBoard` (título de la hija o "Repaso"; "Ejercicio i de N" o "Ejercicio i" en raíz; tablero del hijo) → encabezado global con puntaje de sesión, Pausar, Rendirse → en acotados, Resultado del multi + "Jugar de nuevo" (misma lista, seed nueva).

## 8. Contabilidad por fact
- **Por respuesta: nada.** Por partida: la fila de §3.2 (skills con `{attempts,correct}`; en lo generado `skill===target`).
- **Derivado por target en cada render:** attempts, bestPct, lastPct, lastSeen → estrellas, lograda, urgencia.
- Los facts son solo **metadata editorial** (inventario con `selected` y `dropReason`), sin vínculo con desempeño; las preguntas no llevan `factId`. Para datos por fact: `question.factId` + persistir `answered`, o `skill = fact.id` (sugerencia de ESTADO §7.3).

## 9. Gamificación conectada
| Evento | Visual (`visualBridge`→`VisualStage`) | Audio (`audioBridge`→AudioEngine) |
|---|---|---|
| started | fondo `play` | mood `play` |
| move:correct | chispas (racha<3) o confeti (≥3), intensidad min(1+0.2(racha−1),2.2); `+N` flotante; destello verde | `chime` / `chime-hi` (racha≥3), vol 0.9 |
| move:wrong | sacudida + destello rojo | `buzz` 0.7 |
| hint | texto flotante | `hint` |
| tick ≤5 s (timed) | fondo `tense` | mood `tense` |
| finished completed | `win` + destello + confeti 2.2 | mood `win` + `fanfare` |
| finished otro | `lose` | mood `lose` + `fail` |

Respeta `prefers-reduced-motion`. Los moods solo tocan el canal `bed`, que **nunca suena** (inaudibles).
**SceneDirector** (pila; el de arriba manda; fundido 1.5 s) gobierna además la música de fondo del chico: `ruta` → **TEMP: video de prueba `yJ6Lbsmb1lY` en iframe oculto** + fondo a 0 y pausa · `lectura` → `temaA` mood `calmo` (mood inexistente en el manifest) + fondo a 20 · `video` → nada + pausa · `actividad` → `temaB` `play` + 20 · `gano/perdio` → `temaB` win/lose + 20. Al vaciarse la pila restaura el fondo. `temaA/temaB` son WAV de demo.
**Preparado sin uso:** `streak-milestone`, señal `answered`, flag `rollup`. EC/XP/vidas/rachas = visión, sin código.

## 10. Red y LLM en vivo vs local
| Momento | Red | LLM | Key |
|---|---|---|---|
| Mosaico | miniaturas i.ytimg; portadas por Wikipedia summary (cache `smarty.routeCover.*`) | no | — |
| Abrir ruta | iframe YT (escena TEMP) | no | — |
| Lectura | snapshot Dexie (7 días) o Wikipedia REST / r.jina.ai | **no** (`trusted` saltea juez y resúmenes); sí filtro local de palabras | — |
| Link dentro de la lectura | lector anidado **no trusted** | **sí** (juez + resúmenes) | OpenAI de Ajustes |
| Video | youtube-nocookie | no | — |
| Actividades y recall | ninguna | **no** | — |
| Crear (`/module`,`/emit`) | route-lab :5203 (Wikipedia, transcripts, noembed) | sí, server-side | `OPENAI_API_KEY` del .env de route-lab; `ROUTELAB_MODEL` (default gpt-5.4-mini) |
| Auditar facts | OpenAI Responses desde el navegador + Serper + Wikipedia | sí (tool-calling) | OpenAI y Serper de Ajustes; `settings.auditModel` (default gpt-5.5) |

## 11. Creación y dependencias
**/crear:** por módulo: URL de artículo o video YT (o título de Wikipedia) → tipo (flashcards u opción múltiple), tamaño, edad, nivel → **Generar** (`POST /module`) → edición de cartas a mano (la opción múltiple es solo lectura) → inventario de facts con checkboxes + "Aplicar selección" (`POST /emit`, sin re-extraer) → "Auditar" por fact o en lote. **Guardar**: valida contenido+comprensión por módulo; avisa facts "contradicho"; `flatten` → `importRouteBundle` (exige kind/schemaVersion, integridad referencial, **acuñado de prueba con seed 1** por el portero, reemplazo transaccional por routeId). Borrar ruta borra ruta+definiciones; **los resultados quedan**.
**MyTube:** el video de la ruta NO pasa por la whitelist. **Drive:** "Guardar artículo" en la lectura (db.saved); "Guardado en X" navega a /drive y **desmonta Learn** (se pierde la partida). **Chat:** sin integración. **Padre:** no ve ningún progreso de Learn.

## 12. Docs vs código
| Doc | Dice | Código |
|---|---|---|
| ACTIVIDADES §2 | Definición con tema/assets/presets | Sin tema/assets; sin skins |
| ACTIVIDADES §3 | Generador LLM o híbrido | En la app no hay; el LLM vive en route-lab y emite contenido literal |
| ACTIVIDADES §4 | Entidad Serie | No existe |
| ACTIVIDADES §6.1 | kind `examen` | Solo `passThreshold` |
| ACTIVIDADES §7.1 | Recall con "pendiente/al día/check" | Solo disponible o bloqueada |
| ACTIVIDADES §7.1 | Raíz pide el siguiente due cada vez | Orden fijado al abrir; cicla |
| ACTIVIDADES §7.2 | target→skill→ítem; miss log | Solo target; skillMastery sin uso; sin miss log |
| ACTIVIDADES §7.3 | Recall acuña datos distintos | En static, mismo set barajado |
| ACTIVIDADES §8 | typeId/exerciseId/childId | typeId = id de módulo; sin exerciseId/childId |
| RUTAS_GENERADAS | "Sin implementar"; Dexie v16 pendiente | Todo implementado |
| RUTAS_GENERADAS | Generadores literales quiz/dominó | No existen |
| RUTAS_GENERADAS | Moderación juez LLM fail-closed | Lista negra de 4 palabras; el importador ignora `review` |
| RUTAS_GENERADAS | Cache LLM sqlite | No existe |
| RUTAS_GENERADAS | Recall final sin fin | La app lo acota a 5 |
| AUDITORIA_FACTS | "Nada implementado"; solo MC | Fases 1 y 2 hechas; también flashcards |
| SCENE_DIRECTOR / MOTOR_AUDIO | "Propuesto" | Implementado con placeholders TEMP |

## 13. Delta conceptual con "Aprender + Practicar separados"
**Piezas del POC que no existen en el modelo separado:** el Módulo (contenido → comprobación → profundización → repaso) · bloqueo por comprensión (`passThreshold`: de "lo vi" a "lo demostré") · contenido DENTRO del overlay (una sesión) · guidebook · **store único por target** (posta = proyección; cualquier lanzador mueve la misma maestría) · recall como nodo del camino + raíz sin fin con el mismo motor · Definición como dato con portero/acuñado de prueba/seed · inventario+curaduría+auditoría de facts como metadata editorial · música por fase.
**Se gana:** coherencia en un camino; una sola verdad del progreso; desbloqueo con evidencia; repaso contextual.
**Se pierde o queda más pobre:** sin biblioteca/banco navegable fuera de rutas; sin práctica libre por tema/tipo; el repaso es por target o mazo, **sin SRS por ítem ni fechas** (si el Repasar de Innerith es por ítem, copiar 1:1 es un retroceso en esa dimensión: decisión a tomar); no se mide consumo de contenido; el padre no ve nada.
**Mapeo posible (interpretación del analista):** Aprender → posta contenido+comprensión · Practicar → profundizaciones · Repasar → postas de repaso + raíz · backend → `activity_results` append-only por chico + `learn_routes`/`learn_definitions` por familia + blob editorial (la partición de INFORME_BETA).

## 14. Archivos clave
(cuelgan de `smarty-poc\`): `app\src\{App,db}.tsx|ts` · `app\src\zones\child\{ChildShell,Learn,RutaView,RouteCreator,ReadingView,VideoReadingView}.tsx` · `app\src\zones\admin\LearnRoutes.tsx` · `app\src\lib\{learn,recall,featureSchedule,settings,backup,reader,routeCover,overlayNav}.ts` · motor: `app\src\learn\{ActivityOverlay.tsx,recallActivity.ts,registry.ts,definitions.ts,import.ts,routeDraft.ts,factAudit.ts}` · `app\src\learn\activity\{core,types,scoring,events,host,rng}.ts` · `app\src\learn\activities\{flashcards,multiplechoice,quiz,domino,multi}\*` · `{...}Board.tsx` · `kits\dragdrop\*` · `react\useActivity.ts` · audio/visual: `app\src\learn\audio\{audioBridge,service,sceneDirector,gameManifest,ytScenePlayer}.ts`, `audio\engine\AudioEngine.ts`, `visual\{visualBridge,VisualStage.tsx,types}.ts` · tests: `learn\__tests__\definitions.test.ts` y `activities\{domino,quiz,flashcards,multi}\__tests__\engine.test.ts` (**opción múltiple no tiene tests**) · route-lab: `server.py`, `stages\*`, `core\*`.

## 15. Trampas y detalles finos para el porte
**Progreso y estado**
1. **Rendirse = lograda** (`progressByTarget` no mira `outcome`): sin umbral, una abortada marca la posta lograda (0 estrellas si pct 0).
2. Cerrar con X o atrás no graba nada.
3. "¡Lo lograste!" con cualquier completed aunque no alcance el umbral; la posta sigue "disponible" sin explicación.
4. El recall puede aprobar el bloqueo de comprensión (proyección por target).
5. El bloqueo es lineal GLOBAL, no por módulo (una lograda destraba la siguiente aunque la anterior esté bloqueada).
6. **El porcentaje no es tasa de acierto** en flashcards/quiz/dominó (ponderado por racha): 4 cartas, falla la 3ª → 0.615 < 0.7 con 75% de acierto. En opción múltiple sí lo es.
7. Comprensión de 2 preguntas con umbral 0.7 exige 2/2.
8. Regenerar un módulo puede cambiar slugs de concepto → targets nuevos → se pierde el progreso de profundización (la comprensión conserva `<R>.m.<M>.check`).
9. Targets de profundización por RUTA: dos módulos con el mismo concepto comparten maestría.
**Recall**
10. Entra todo lo jugado, incluso lo dominado; nunca "al día".
11. El orden se fija al abrir. 12. Se repasa el set entero barajado.
13. **(inferido, alta confianza)** El puntaje de sesión del multi se infla con hijos de opción múltiple (suma 10+2·(racha−1) por move:correct vs max 10 por pregunta → 8 perfectas = 136/80); crédito parcial cuenta como acierto pleno en stats.
14. Repaso sin targets jugados: click silencioso.
15. Targets de rutas borradas siguen en el repaso hasta recargar (catálogo en memoria sin purga).
16. **(inferido)** Carrera al arrancar: `reviewable` se calcula de las filas mientras las defs importadas hidratan async → en frío el botón podría no aparecer.
**Datos e IndexedDB**
17. `typeId` persistido = id de módulo (`quiz-relampago`, `multi-actividad`).
18. No se guardan stats/mejor racha/duración. 19. Escrituras `void`, errores tragados. 20. Varias consultas hacen `toArray()` completo por render. 21. El orden del mosaico es por clave primaria (id aleatorio), no por creación. 22. `enabled` sin UI; `version` nunca se incrementa; sin campo descripción en el creador. 23. Restaurar backup = clear + bulkPut; la cache de portadas cae en "setup". 24. Reloj del dispositivo; sin identidad del chico (un perfil por navegador).
**Contenido, red y seguridad**
25. Key de OpenAI exigida para entrar al shell. 26. Links dentro de lectura trusted abren lectores NO trusted (llaman al LLM). 27. "Empezar preguntas" tocable siempre, sin leer/mirar, aun con página caída. 28. Los videos de ruta no pasan por la whitelist de MyTube (solo nocookie+sandbox). 29. `/crear` accesible por URL con Learn apagado. 30. "Guardado en X" lleva a Drive y pierde la partida. 31. "Atrás" en lectura pasa a preguntas y deja historial colgado. 32. Posta de video sin videoId saltea el contenido.
**Creador y route-lab**
33. `unflatten` re-fija `types:['flashcards']` y `size:'auto'` → regenerar o "Aplicar selección" sobre una ruta de MC reabierta **emite flashcards** salvo re-elegir tipo. 34. Solo se emite MC `single` (el modo multi existe solo en motor y vista). 35. **(inferido)** Si falla un re-import, el rollback en memoria borra también las defs válidas previas con esos ids hasta recargar. 36. route-lab: sin auth, CORS `*`, no sanea `jobId` (path traversal), y lee como corpus TODOS los .md de la carpeta del job (restos de corridas previas con el mismo id).
**Audio y placeholders TEMP**
37. A sacar/reemplazar: panel "Probar YouTube" en Learn.tsx, escena `ruta` → `yJ6Lbsmb1lY`, temas demo `temaA/temaB`. 38. Moods inaudibles. 39. El audio exige gesto (se desbloquea al abrir ruta/recall y en "Empezar"). 40. Nada usa `timed`.

## 16. No verificado
Comportamiento en ejecución (carreras de hidratación/rollback, inflado del multi) · internals del AudioEngine más allá de FX/moods/stems · extracción jina más allá de sus llamadas · datos reales de uso (backups cifrados) · memorias de diseño citadas en comentarios (no están en el snapshot) · innerith-ui.
