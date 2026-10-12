# Porte Smarty→Innerith · Informe 1: route-lab y el flujo /crear

> Análisis de ingeniería inversa sobre smarty-poc rama develop, HEAD 47f434b (12-oct-2026).
> Pedido de Esteban: funcionalidad EXACTA, sin recortes. Informes hermanos: 02 Learn+AR, 03 MyTube/arquitectura, 00 mapa.

# Informe funcional: cómo se crean rutas de aprendizaje en la POC de Smarty (rama `develop` @ `47f434b`)

**Raíz analizada (absoluta):** `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc`. Todas las rutas del cuerpo son relativas a esa raíz. La lista absoluta está en §1.

**Qué leí:**
- `route-lab/` entero: código, fixture y los 4 jobs que hay en disco.
- `RUTAS_GENERADAS.md`, `AUDITORIA_FACTS.md` y el README de la raíz.
- Todo el flujo `/crear` hasta Dexie, y cómo Learn lo consume.
- Corrí un solo script Python con `-B`, en modo lectura, para comprobar el orden de carga del `.env`. No modifiqué nada.

**Estado del árbol de trabajo:** el único cambio sin commitear es `route-lab/.env.example`, que quedó vacío (0 bytes). En HEAD ese archivo trae la plantilla `OPENAI_API_KEY=` y `ROUTELAB_MODEL=gpt-5.4-mini`.

---

## 0. Resumen

1. **`/crear` arma la ruta por módulos.** Una ruta es una secuencia de módulos y cada módulo tiene **una sola fuente**: un *título* de Wikipedia en español o una URL de *video* de YouTube.
   - "Generar" hace `POST /module`, que es **síncrono**. Devuelve:
     - una posta de **comprensión** (lectura o video, más preguntas, aprobada por umbral);
     - N postas de **profundización** (una por concepto);
     - el **inventario** de facts.
   - Después se edita y se cura (con `POST /emit`) y se audita. Toda la auditoría corre en el browser.
   - "Guardar" hace `flatten()` → `importRouteBundle()` → Dexie.
2. **route-lab es FastAPI 100% síncrono.** No hay colas, polling, SSE ni endpoint de estado. Un "job" es solo una carpeta de artefactos en disco.
   - `/crear` usa **solo** `/module` y `/emit`.
   - `/routes` es el pipeline viejo de ruta plana de flashcards; lo usa el panel Admin.
   - **La app nunca llama a `/health`.**
3. **Pipeline de `/module`:** `ingest` → `extract` → `module`.
   - `ingest`: Wikipedia por la action API, o el transcript de YouTube.
   - `extract`: el LLM saca facts por documento; la cita literal se verifica con fuzzy ≥0.85; el merge entre fuentes es determinista.
   - `module`: la selección es determinista; los distractores los pone el LLM solo si el tipo es opción múltiple.
   - Las etapas graph, plan, generate y bundle **no participan** en `/crear`.
4. **Un solo modelo para todo route-lab**: `gpt-5.4-mini` por defecto, vía Chat Completions con `response_format: json_object`. No hay caché ni reintentos.
5. **Auditor de veracidad (en el browser):**
   - Usa OpenAI Responses con tool-calling. Las herramientas son `buscar_web` (Serper) y `buscar_wikipedia` (sin key).
   - El modelo es propio: `auditModel`, por defecto `gpt-5.5`.
   - Se dispara por fact o en lote sobre los "riesgosos".
   - El veredicto se persiste en `learnRoutes.editorial`.
   - **No hay refutación adversarial.**
6. **Artefacto final:**
   - Base Dexie `smarty`, versión 16: tablas `learnRoutes` (`&id`) y `learnDefinitions` (`&id, target, routeId`).
   - Learn juega leyendo esas tablas y graba en `activityResults`.
   - Tipos que emite `/crear`: `flashcards` y `multiplechoice`, ambos con generador `static`. Opción múltiple sale **siempre en modo `single`**.

---

## 1. Archivos clave (rutas absolutas)

**route-lab**
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\server.py`: API FastAPI (`/health`, `/routes`, `/module`, `/emit`).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\cli.py`: CLI; solo cubre las etapas viejas (ingest…bundle, run).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\core\llm.py`: punto único de acceso al LLM.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\core\fuzzy.py`: verificador de citas.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\core\job.py`: carpeta de artefactos y manifest.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\core\env.py`: carga del `.env`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\stages\ingest.py`
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\stages\extract.py`
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\stages\module.py`
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\stages\mc.py`
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\stages\emit.py`
- Etapas viejas: `...\route-lab\stages\graph.py`, `plan.py`, `generate.py`, `bundle.py`. `module.py` y `emit.py` reutilizan `plan._difficulty`, `generate._check_card` y `bundle.BLOCKLIST`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\fixtures\poc-solar.json`: el único fixture del modo stub.
- Artefactos de ejemplo:
  - `...\route-lab\jobs\https-www-youtube-com-watch-v-h6utjnflru0\70-module.json` (respuesta real de `/module`, opción múltiple).
  - `...\route-lab\jobs\poc-solar\60-route-bundle.json` (bundle viejo).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\route-lab\requirements.txt`, `README.md`, `Dockerfile`, `.dockerignore`, `.gitignore`.

**App (flujo `/crear` y persistencia)**
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\zones\child\RouteCreator.tsx`: la vista /crear entera, incluidas las llamadas HTTP.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\routeDraft.ts`: estado anidado, tipos del inventario y de la auditoría, `flatten`/`unflatten`/`validateForSave`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\import.ts`: `importRouteBundle` (validación + acuñado seco + transacción) y `deleteImportedRoute`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\factAudit.ts`: el auditor.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\llm.ts`: `completeWithTools` y `parseJudgeJson`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\imageEngine\serper.ts`: `serperSearchResult`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\overrides.ts`: knob `audit.prompt`, líneas 291-310.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\settings.ts`: `auditModel`, `apiKey`, `serperKey`, `learnActivo`, `searchGl`/`searchHl`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\db.ts`: esquema Dexie (v16, líneas 325-449).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\learn.ts`: tipos `LearnRoute`/`Posta`/`RouteModule`, `resolveRoute`, `useImportedRoutes`.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\registry.ts`: `DefinitionRecipe`, tipos y generadores.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\definitions.ts`: catálogo en memoria y acuñado.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\activities\multiplechoice\` (`types.ts`, `module.ts` con el portero, `generators.ts`, `engine.ts`, `config.ts`).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\learn\activities\flashcards\` (mismos archivos).
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\routeCover.ts`: portada.
- `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\lib\youtube.ts`: `parseYtUrl`.
- Consumo en Learn:
  - `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\zones\child\RutaView.tsx`
  - `...\app\src\zones\child\Learn.tsx`
  - `...\app\src\learn\ActivityOverlay.tsx`
  - `...\app\src\learn\recallActivity.ts`
  - `...\app\src\lib\recall.ts`
- Vía Admin: `C:\Users\esteb\Desktop\snapshot-personal-2026-10-03\snapshot-personal-2026-10-03\smarty-poc\app\src\zones\admin\LearnRoutes.tsx` (`POST /routes` e import de JSON).
- `...\app\src\App.tsx`: ruta `/crear` e hidratación al boot.
- `...\app\src\zones\child\ChildShell.tsx` y `...\app\src\lib\featureSchedule.ts`: control de acceso.
- `...\app\src\lib\backup.ts`: ámbitos de respaldo.

---

## 2. Qué vive en el front y qué en route-lab

| Responsabilidad | Dónde |
|---|---|
| Estado de la ruta y los módulos, IDs `routeId`/`moduleId`, orden de módulos, umbral, repaso, categoría, portada, título y emoji | Front (`RouteCreator.tsx` + `routeDraft.ts`) |
| Detectar si la fuente es video o artículo; elegir qué se manda (URL o título) | Front (`parseYtUrl`) |
| Traer el contenido (Wikipedia o transcript), extraer facts con LLM, verificar citas, hacer el merge | route-lab (`ingest.py`, `extract.py`) |
| Seleccionar la comprensión y la profundización, armar flashcards/MC, distractores por LLM, inventario, moderación por lista negra | route-lab (`module.py`, `mc.py`) |
| Curaduría (qué conceptos y qué facts) y armado de las specs de cada posta | Front (`applyCuration`); route-lab solo re-emite (`/emit`) |
| Auditoría de veracidad (LLM + Serper + Wikipedia) | **Front, 100%** (`factAudit.ts`), con las keys en localStorage |
| Validación previa al guardado, aplanado, acuñado seco con los porteros, persistencia Dexie | Front |
| Juego, progreso, recall | Front (Learn) |

---

## 3. Contrato HTTP de route-lab (`server.py`, puerto 5203)

### 3.1 Reglas generales
- **Todos los endpoints son síncronos.** Son handlers `def` de FastAPI que corren en el threadpool. El cliente espera con la conexión abierta todo el pipeline.
- No hay jobs asíncronos, polling, SSE, websockets, cancelación ni autenticación.
- **CORS:** `allow_origins = ALLOW_ORIGINS.split(",")`; por defecto `"*"`. Métodos y headers `*`.
- **"Job" = `route-lab/jobs/<jobId>/`.** Si no se pasa `jobId`, se usa `_slug(sources)`: minúsculas, sin acentos, `[^a-z0-9]+`→`-`, máximo 48 caracteres. La carpeta **se reutiliza y se pisa** entre corridas.
- **Errores:**
  - `HTTPException` devuelve `{"detail": "<texto>"}`.
  - Los errores de validación de pydantic usan el formato estándar de FastAPI, `{"detail":[...]}`. Esto no lo verifiqué en runtime.

### 3.2 `GET /health`
- Devuelve `{"ok": true, "mode": "real" | "stub"}`.
- `mode` refleja solo si `OPENAI_API_KEY` existe en el entorno. **No valida la key**: con una key revocada igual dice `"real"`.

### 3.3 `POST /module` (el que usa /crear)

**Request (`ModuleRequest`):**

| Campo | Tipo | Default | Qué manda /crear |
|---|---|---|---|
| `source` | str (obligatorio) | — | URL del video si `parseYtUrl(url).type==='video'`; si no, **el título** (`m.source.title`) |
| `routeId` | str (obligatorio) | — | `state.routeId` (`ruta.<12 base36>`) |
| `moduleId` | str (obligatorio) | — | `m.id` (`m-<6 base36>`) |
| `edad` | int | 10 | input de 6 a 14 |
| `nivel` | str | `"medio"` | `basico` \| `medio` \| `avanzado` |
| `lang` | str | `"es"` | siempre `'es'` |
| `activityTypes` | list[str] | `["flashcards"]` | `m.types`: un solo elemento, `flashcards` o `multiplechoice` |
| `size` | str | `"auto"` | `small` \| `auto` \| `large` (en la UI: chica, auto, grande) |
| `jobId` | str \| null | null | /crear **no lo manda**, así que el job es el slug de la fuente |

**Orden de validación y errores:**

| Código | Mensaje exacto |
|---|---|
| 400 | `Falta 'source' (título de Wikipedia o link de YouTube)` |
| 400 | `Faltan 'routeId'/'moduleId'` |
| 422 | `v1 genera 'flashcards' o 'multiplechoice'; activityTypes no incluye ninguno` |
| 422 | Cualquier `ValueError`: errores de YouTube en ingest (§4.1) y de `module.run`: `el artículo no rinde suficientes facts verificables (N) para un módulo (mín 2)`, `no se pudieron muestrear ≥2 preguntas de comprensión verificables del artículo`, `no se pudieron armar ≥2 preguntas de comprensión válidas del tipo pedido` |
| 500 | `módulo falló: <TipoExcepción>: <msg>`. Ejemplos: `RuntimeError: Wikipedia no devolvió texto para '<t>' (¿título inexistente?)`; `HTTPError: HTTP Error 401: Unauthorized` (key mala); `KeyError: 'quote'` (el LLM omitió un campo); timeouts |

**Response 200** (forma exacta tomada de `module.py`, líneas 262-310):

```jsonc
{
  "module": { "id": "<M>", "title": "<título real de la fuente>", "emoji": "🪐", "source": SrcRef },
  "comprehension": {
    "posta": { "id": "<M>.check", "title": "Comprensión de la lectura", "kind": "activity",
               "definitionId": "<R>.<M>.d.check", "target": "<R>.m.<M>.check", "moduleId": "<M>",
               "reading": SrcRef, "passThreshold": 0.7 },
    "definition": DefinitionRecipe },
  "profundizacion": [ { "posta": { "id": "<M>.t.<C>", "title": "<concept_label>", "kind": "activity",
               "definitionId": "<R>.<M>.d.<C>", "target": "<R>.t.<C>", "moduleId": "<M>" },
               "definition": DefinitionRecipe } ],
  "inventory": { "concepts": ConceptInv[], "facts": FactInv[], "integrityDropped": [{"id","reason","quote"}] },
  "review": { "moderation": { "method": "blocklist-stub", "items_checked": int, "flagged": int },
              "finalApprovedAt": null, "note": "moderación real (juez LLM) sin cablear en la PoC; esto es solo lista negra" },
  "meta": { "origin": "route-lab@poc", "jobId", "source": "<título>", "routeId", "moduleId",
            "learner": {"edad","nivel"}, "size", "activityType": "multiplechoice"|"flashcards",
            "skippedActivityTypes": [], "droppedConcepts": [{"concept","reason"}],
            "factsExtracted": int, "factsUsed": int, "conceptsFound": int,
            "sourceKind": "wikipedia"|"youtube-transcript", "captionKind": "manual"|"asr"|null,
            "truncated": "True"|"False"|null,   // STRING (sale del front-matter); null en Wikipedia
            "llm": "real"|"stub" }
}
```

- `SrcRef` para Wikipedia es `{url, title}`. Para video es `{url: "https://www.youtube.com/watch?v=<id>", title, kind: "video", videoId}`.
- **Qué usa el front de esta respuesta:**
  - `comprehension.posta.{id,title,target}` y `comprehension.definition`;
  - `profundizacion[].posta.{id,title,target}` y `profundizacion[].definition`;
  - `module.{title,emoji,source}`, `meta.{captionKind,jobId}` e `inventory`.
- **Qué ignora:** `posta.passThreshold`, `reading`, `kind`, `moduleId`, `review` y el resto de `meta`. Para `learner` esto implica que **edad y nivel no se guardan en ninguna parte**.

### 3.4 `POST /emit` (curaduría, re-emitir sin volver a extraer)

**Request (`EmitRequest`):**
- `facts: list[dict]` (obligatorio, no vacío). El front manda `inventory.facts` completo, con `audit` incluido. route-lab **solo lee** `id`, `front`, `back` y `statement`.
- `postas: list[EmitPosta]` (obligatorio, no vacío). Cada `EmitPosta` es `{postaId?: str|null, defId: str, target: str, title: str = "", idPrefix?: str|null, factIds: list[str] = []}`. El front además manda `conceptId`, que pydantic descarta.
- `edad=10`, `nivel="medio"`, `lang="es"`.
- `activityType="multiplechoice"`. El front manda `m.types[0] ?? 'multiplechoice'`.
- `jobId`: el front manda el `jobId` de la extracción. Solo decide dónde se guarda `prompts/mc-distractors.md`; **`/emit` no lee nada del job**. Si no viene, se usa `emit-adhoc`.

**Specs que arma el front para cada concepto tildado** que tenga ≥2 facts tildados:
- `postaId = <M>.t.<C>`
- `defId = <R>.<M>.d.<C>`
- `target = <R>.t.<C>`
- `title = concept label`
- `idPrefix = <M>.<C>`
- `factIds` = los facts tildados.

**Errores:**

| Código | Mensaje |
|---|---|
| 400 | `Falta 'postas' (al menos una posta a emitir)` |
| 400 | `Falta 'facts' (el inventario del módulo)` |
| 422 | `activityType '<x>' no soportado` |
| 500 | `emit falló: <Tipo>: <msg>` |

Una falla del LLM no produce 500: cae a distractores deterministas.

**Response:** `{"definitions": [{postaId, defId, target, title, definition: DefinitionRecipe|null, reason: null|"menos de 2 preguntas/tarjetas válidas"}]}`, en el mismo orden del request.

### 3.5 `POST /routes` (viejo; solo lo usa Admin → `LearnRoutes.tsx`)
- **Request:** `{sources: string[] (obligatorio), edad=10, nivel="medio", lang="es", jobId?}`. Admin manda títulos separados por coma, `edad` y `nivel`.
- **Errores:** 400 `Falta 'sources' (al menos una fuente)`; 500 `pipeline falló: <Tipo>: <msg>`.
- **Response:** `{jobId, summary: {postas, definitions, flagged, bundle: "<ruta absoluta del server>"}, bundle}`. El `bundle` es `{kind:"smarty-route-bundle", schemaVersion:1, route:{id:"ruta.<jobId>", title:"Ruta: <concepto con más facts>", emoji:"🪐", postas, version:1}, definitions (solo flashcards), requires:{types:{flashcards:{contractVersion:1, generators:["static"]}}}, meta:{origin, jobId, sources, learner}, review}`.
- Las rutas de `/routes` **no tienen `modules`**, así que **no se pueden editar en /crear**.

### 3.6 Modo real y modo stub
- **Real:** existe `OPENAI_API_KEY` en el entorno del proceso o en el `.env`. Hoy el `.env` la tiene; lo comprobé sin imprimirla.
- **Stub:** `complete_json` devuelve lo "canned" del fixture `fixtures/<jobId>.json`, pero **ingest sigue siendo real** (red a Wikipedia y YouTube).
  - El único fixture es `poc-solar`. Para cualquier otro job, extract devuelve 0 facts y `/module` responde **422 siempre**.
  - Hay evidencia: `jobs/https-www-youtube-com-watch-v-4ex-l4sfbjs/manifest.json` muestra `facts_kept: 0, llm: "stub"`.
  - En la práctica, **el modo stub no sirve para /crear**.
- **Excepción:** `/emit` sí funciona en stub, con distractores tomados de las otras respuestas del lote.

---

## 4. Pipeline por etapas (el de `/module`)

### 4.1 `ingest` (`stages/ingest.py`, sin LLM)

Cada fuente es un título de Wikipedia **o** una URL de YouTube. `_yt_video_id` reconoce `youtu.be/<id>`, `watch?v=`, `/shorts/<id>` y `/embed/<id>` en youtube.com y youtube-nocookie.com.

**Wikipedia**
- Llama a `https://{lang}.wikipedia.org/w/api.php` con `action=query, prop=extracts|links, explaintext=1, exsectionformat=wiki, redirects=1, pllimit=max, plnamespace=0`.
- User-Agent `route-lab/0.1 (Smarty PoC; educational)`, timeout 30 s, pausa de 0.3 s.
- Si la página no tiene `extract`, lanza `RuntimeError`, que termina en 500.
- **Secciones:**
  - La intro se rotula "Introducción" y es `s0`. Cada `== H ==` es una sección; las `===` se aplanan a texto `"<h>:"`.
  - Se descartan: véase también, referencias, enlaces externos, notas, bibliografía, notas y referencias, galería, fuentes.
  - Máximo 8 secciones (`MAX_SECTIONS`), cada una cortada a 1600 caracteres (`MAX_SECTION_CHARS`).
- **Salida en disco:**
  - `10-corpus/<slug-titulo-real>.md` con front-matter: `id: doc-<slug>`, `source_kind: wikipedia`, `title`, `url` (`https://{lang}.wikipedia.org/wiki/<Titulo_Real>`), `lang`, `sections`, `wiki_links`, `retrieved_at`.
  - El cuerpo usa encabezados `## <Heading> {#sN}`.
  - `10-corpus/<slug>.links.json` con hasta 200 links. `/module` no los usa.

**YouTube**
- Usa `youtube-transcript-api>=1.2`, importado de forma diferida (lazy).
- **Elección de pista:**
  - El "idioma original" se toma de la **primera pista ASR**; si no hay ASR, de la primera pista.
  - Se prefiere una pista manual en ese idioma base; si no hay, la ASR.
  - `caption_kind` queda en `manual` o `asr`.
- Descarta los cues que empiezan con `[` (por ejemplo `[Música]`) y colapsa los espacios.
- Título por `https://noembed.com/embed?url=...` (timeout 15 s); si falla, usa `Video <id>`.
- Corta en chunks de 6000 caracteres sin partir palabras, con **máximo 8 chunks**. Si sobra texto, marca `truncated`.
- Cada chunk es un documento: `video-<id>-c<i>.md`, con `source_kind: youtube-transcript`, `lang: <idioma de la pista>`, `video_id`, `caption_kind`, `part`, `truncated`. El cuerpo es `## <título> (parte i+1) {#s0}`.
- **Errores (todos `ValueError`, o sea 422):**
  - `no pude extraer el video de la URL: <url>`
  - `no pude leer subtítulos del video (<Exc>): puede no tenerlos, ser privado o estar bloqueado`
  - `el video no tiene subtítulos disponibles`
  - `el transcript del video es demasiado corto para generar un módulo` (menos de 200 caracteres)

### 4.2 `extract` (`stages/extract.py`)

**Pase A: un llamado al LLM por documento o chunk, en secuencia, en orden alfabético de `doc_id`.**

- **Prompt** (`_pase_a_prompt`, guardado en `prompts/extract.paseA.<doc>.md`):
  - Rol: "extractor de FACTS atómicos para material educativo de chicos 8-12, en español". La edad está fija en el texto; **no usa `edad` ni `nivel`**.
  - Pide agrupar en "POCOS conceptos AMPLIOS (idealmente 3-6)", con 3 o más facts por concepto.
  - Formato de salida: `{facts:[{id, concept (slug kebab), concept_label, kind (definition|property|numeric|relation), statement, front (pregunta), back (respuesta corta), section, quote (TEXTUAL)}]}`.
  - **Regla dura textual:** *"REGLA DURA: cada `quote` debe ser una cita LITERAL del texto (se valida). Un fact sin cita literal se descarta."*
  - Si la fuente es un transcript, agrega la advertencia de que puede venir con relleno, sponsors o errores de ASR: *"extraé SOLO facts claros, correctos y autocontenidos… Ante la duda, no lo incluyas."*
  - Si `lang` no es `es`: `concept_label`, `statement`, `front` y `back` van **en español**, pero `quote` va **literal en el idioma original**.
  - Le pasa el **vocabulario acumulado** de conceptos de los documentos anteriores ("Reusá EXACTAMENTE estos `concept` slugs…"). Por eso el pase es secuencial.
  - El texto va cortado a `body[:8000]`.
- **Validación determinista:** `quote_ok(quote, body_completo_del_doc, 0.85)`.
  - Normaliza a minúsculas y colapsa espacios. Una subcadena exacta vale 1.0.
  - Si no, usa `rapidfuzz.partial_ratio`, o ventanas de `difflib` como respaldo.
  - Un fact por debajo del umbral va a `dropped` con `reason: "quote no verificable en el corpus (score X < 0.85)"`.
  - **Solo comprueba que la cita exista en la fuente.** No comprueba que `statement`, `front` o `back` digan lo mismo que la cita.
- **IDs únicos:** si un `id` se repite entre chunks (el LLM reinicia en f1), se renombra a `<doc-id>:<id>`, y luego `-2`, `-3`… Ejemplo: `doc-video-h6UtJnflRu0-c1:f2`.
- Cada fact queda con `provenance: [{doc, section, quote, score}]`.

**Pase B: merge determinista**
- Conceptos: mismo slug en documentos distintos se unifica en uno, con `{id, label, docs[], multi_source, fact_count}`. `fact_count` se cuenta **antes** de la deduplicación.
- Facts: se deduplican por `statement` normalizado (exacto, sin puntuación); las procedencias se concatenan.
- Salida: `20-facts.json` = `{concepts, facts, dropped}`.
- No hay reintentos ni validación de esquema. Si falta `quote`, `concept`, `concept_label`, `id` o `statement`, salta un `KeyError` y la respuesta es 500.

### 4.3 `module` (`stages/module.py`, determinista salvo los distractores)

**Tipo primario:** `multiplechoice` gana si está en `activityTypes`; si no, `flashcards`. El resto va a `skippedActivityTypes`.

**Constantes y topes:**

| Parámetro | Fórmula |
|---|---|
| `MIN_FACTS` | 2 (*"Regla de oro: NUNCA estirar"*, `plan.py`) |
| `maxCards` base | 6 si edad ≤ 9; 8 si no. +1 si `nivel=="avanzado"`. **`basico` y `medio` dan exactamente lo mismo** |
| `maxCards` por tamaño | small: `max(2, m-2)`; auto: `m`; large: `m+2` |
| Tope de conceptos (profundización) | small 2 · auto 4 · large 6 |
| Tope de comprensión | base 4 (edad ≤ 9) o 6; small −2, large +2; mínimo 2 |
| `durationSec` | 120 (edad ≤ 9) o 90. Es irrelevante porque `mode` siempre es `untimed` |

**Profundización**
- Los conceptos se ordenan por `(-n_facts, id)`.
- Un concepto se descarta, con su razón, si:
  - tiene menos de 2 facts;
  - ya se alcanzó el tope de conceptos;
  - quedan menos de 2 facts usables, tomando `usable = fs[:maxCards]` con `front` y `back` no vacíos.
- Los facts se usan **en orden de extracción**, no por score.

**Comprensión**
- Pasada 1: un fact por concepto, el de mayor score de procedencia (desempate por `id`), hasta el tope.
- Pasada 2: si quedaron menos de 2, se rellena hasta llegar a 2.
- **En la práctica la cantidad de preguntas de comprensión es `min(tope, nº de conceptos)`.** En el ejemplo real hay 2 conceptos, así que hay 2 preguntas.
- **No se deduplica contra la profundización**: un fact puede aparecer en las dos.

**Emisión**
- Opción múltiple: `mc.build_question` + `mc.check_question` por fact.
- Flashcards: `{id, front, back, skill}` + `_check_card`.
- Cada posta necesita **≥2 ítems válidos**; si no, se descarta con `no rindió ≥2 jugadas válidas del tipo pedido`. Si la comprensión no llega a 2, el resultado es 422.

**Inventario**
- Va **todo** lo extraído.
- `selected`: el fact está en la comprensión o en algún concepto emitido. Puede ser `true` aunque su pregunta haya fallado al construirse.
- Valores de `dropReason`:
  - `sin pregunta/respuesta válida (front o back vacío)`
  - la razón del concepto
  - `no entró en la selección automática del módulo`
- `integrityDropped`: los facts que descartó el chequeo de citas.

**Moderación**
- Lista negra `{"droga","arma","sexo","matar"}` por subcadena sobre los textos visibles.
- **Solo cuenta coincidencias; no bloquea nada.**

**Salida en disco:** `70-module.json` y `manifest.json`.

### 4.4 Distractores de opción múltiple (`stages/mc.py`)

**Un solo llamado al LLM por módulo** (o por `/emit`), sobre todos los facts que se van a emitir. El payload es `[{id, pregunta: front, correcta: back, contexto: statement}]`.

**Reglas del prompt** (para chicos de `{edad}` años):
- **EXACTAMENTE 3** distractores por pregunta.
- *"CLARAMENTE incorrectas… (JAMÁS una opción que también sea correcta)"*.
- Plausibles, del mismo tipo y largo que la correcta.
- En el **mismo idioma** que la respuesta correcta.
- Cortos, distintos entre sí y distintos de la correcta.
- *"NADA de 'todas las anteriores', 'ninguna de las anteriores' ni 'no sé'"*.
- Formato de salida: `{"items":[{"id":"<id>","distractors":["d1","d2","d3"]}]}`.

**Notas:**
- El parámetro `lang` **no se usa**.
- Ante cualquier excepción, cae al stub determinista: otras respuestas del lote.

**`build_question`:**
- La correcta es `fact.back`, que está verificado contra la cita; el enunciado es `fact.front`.
- Los distractores son los del LLM y, si faltan, se completan con `pool_backs` (respuestas únicas de **todos** los facts del módulo).
- Se deduplican sin distinguir mayúsculas, se toman hasta 3 y se exigen **al menos 2**. Por eso una pregunta tiene 3 o 4 opciones.
- La forma es `{id, prompt, mode:"single", skill: target, options:[{id:"o1",text:correcta,correct:true},{id:"o2"…,correct:false}]}`.
- **La correcta siempre es `o1`**: se baraja recién al jugar.

**`check_question`** es espejo del portero de la app:
- `id` presente y `prompt` no vacío;
- al menos 2 opciones;
- cada opción con `id`, `text` y `correct` booleano;
- ids de opción únicos;
- textos únicos (sin distinguir mayúsculas);
- en `single`, exactamente 1 correcta.

### 4.5 `emit` (`stages/emit.py`)
- Repite el armado de `module._make_deck` con los facts que manda la app. **No vuelve a extraer**, así que los `fact-ids` se conservan.
- Los distractores salen de una llamada sobre todos los facts referenciados. El pool de relleno son los backs de **todos** los facts recibidos.

### 4.6 El LLM (`core/llm.py`)
- Hace `POST https://api.openai.com/v1/chat/completions` con urllib a mano: `{"model", "messages":[{"role":"user","content":prompt}], "response_format":{"type":"json_object"}}`, timeout de 90 s.
- Guarda **siempre** el prompt en `jobs/<id>/prompts/<prompt_id>.md` antes de llamar.
- Sin caché y sin reintentos.
- `unwrap` normaliza tanto `{facts:[…]}` como una lista pelada.
- El modelo es `MODEL_DEFAULT = os.environ.get("ROUTELAB_MODEL","gpt-5.4-mini")`, evaluado **al importar el módulo** (ver trampa R1). Es el **mismo modelo para todas las etapas**.

### 4.7 Etapas viejas (solo `/routes` y CLI)
- `graph`: aristas de prerrequisito por LLM; `needs_review` si la confianza es menor que 0.70; orden topológico de Kahn que rompe ciclos por la arista de menor confianza.
- `plan`: una posta de flashcards por concepto, un recall cada K actividades (K=3 si edad ≤ 9, si no 4) y `rend` "Repaso final".
- `generate`: el id de cada tarjeta es el id del fact.
- `bundle`: arma el paquete final y aplica la lista negra.

---

## 5. Entradas soportadas y flujo en /crear

### 5.1 Entradas

| Entrada | ¿Soportada en /crear? | Detalle |
|---|---|---|
| Título de Wikipedia | **Sí** | Siempre `es.wikipedia` (el front manda `lang:'es'`). Lo que se envía es el **campo "Título"**, no la URL |
| URL de Wikipedia | Solo de adorno | Se ignora para generar. Después de generar, route-lab la reemplaza por su propia URL |
| URL de video YouTube (watch / youtu.be / shorts / embed) | **Sí** | Se manda la URL; el título lo completa route-lab |
| URL de video *dentro de una playlist real* (`&list=PL…/UU…/OL…/FL…`) | **No** (trampa) | `parseYtUrl` lo clasifica como playlist, el front lo trata como artículo y manda el título |
| Playlist, canal, `/live/` | No | |
| Texto pegado, PDF, .md, URL de artículo cualquiera, carpeta de Drive, deep research | **No** | Solo aparecen en `RUTAS_GENERADAS.md` |
| Varios contenidos | Sí, **un módulo por contenido** | Cada módulo se genera por separado. No hay merge entre módulos ni grafo de prerrequisitos; el orden es el que arma el usuario |

### 5.2 Flujo paso a paso (`RouteCreator.tsx`)

1. **Montaje.** `blankCreatorState()` crea `routeId = "ruta."+uid()+uid()` (6+6 caracteres base36), título `''`, emoji `🧭`, `version 1` y un módulo vacío (`m-<uid>`, "Nuevo módulo", 📖, `types:['flashcards']`, `size:'auto'`, `passThreshold 0.7`).
   - El selector "Ruta:" lista las rutas de Dexie que tienen `modules`. Elegir una dispara `unflatten`.
2. **Contenido.** Por módulo: input de URL e input de título. Si la URL es un video, aparece el badge 🎥, y después de generar el badge de `captionKind`: `⚠ subtítulos automáticos — revisá bien los datos` o `✓ subtítulos del autor`.
3. **Tipo y tamaño.**
   - Botones `flashcards` | `opción múltiple`. `quiz` y `dominó` aparecen deshabilitados con el texto "próximamente". La elección es **única**: `types:[id]`.
   - Selector de tamaño: chica, auto, grande.
4. **Generar.**
   - Valida que haya `src`; si no, muestra `Agregá el contenido (URL o título) antes de generar.`
   - Si el módulo ya tenía contenido, pide confirmación: *"Regenerar reemplaza la comprensión y la profundización de este módulo (perdés ediciones manuales)[ y puede reiniciar el progreso de este módulo (cambian los conceptos)]. ¿Seguir?"*.
   - Pone `generating=true`, guarda la URL de route-lab en localStorage y hace `POST /module`.
   - **Si sale bien**, reemplaza: comprensión, profundización (**incluidas las manuales**), inventario, `captionKind`, `jobId` y `source` (lo devuelve route-lab, con `kind` y `videoId`). Reemplaza el título del módulo solo si seguía siendo "Nuevo módulo". El emoji no cambia porque nunca queda vacío.
   - **Si falla**, muestra `No pude generar: route-lab <status>: <detail[:300]> (¿corre route-lab en <base>?)`.
5. **Editar.** Ver la tabla de §5.3.
6. **Curar (opcional).** Ver §5.4.
7. **Auditar (opcional).** Ver §6.
8. **Guardar.**
   1. `validateForSave` revisa, en este orden:
      - `Agregá al menos un módulo.`
      - `Poné un título a la ruta.`
      - por módulo: `El módulo «X» no tiene contenido (URL + título)…`
      - por módulo: `Generá el módulo «X» (o quitalo) antes de guardar.`
   2. Si hay facts `selected` con `audit.status==='contradicho'`, aparece un confirm que **avisa pero no bloquea**.
   3. `flatten`. Si hay ids repetidos lanza `Hay un id de posta|definición duplicado: "…" (bug del generador). Regenerá ese módulo.`
   4. `importRouteBundle({kind:'smarty-route-bundle', schemaVersion:1, route, definitions, editorial})`.
   5. Mensaje final: `✓ Guardada «T» — ya aparece en Learn (N postas).`, donde N incluye los recall.
9. **Borrar.** Solo aparece si la ruta está guardada. Confirm y luego `deleteImportedRoute`.

### 5.3 Qué se puede editar

| Elemento | Edición |
|---|---|
| Ruta | Título, emoji, categoría (texto libre con las 13 sugerencias de `LEARN_CATEGORIES`), portada (`cropToCover`: 640×360, JPEG 0.82, data URL; "Quitar"). **`description` no tiene input** |
| Learner / route-lab | Edad, nivel, URL de route-lab. **No se persisten con la ruta** |
| Módulo | Agregar, borrar (**sin confirmación**), subir y bajar, emoji, título, URL, título de la fuente, tipo, tamaño, "Aprobar con X%" (0-100, visible solo después de generar), "Repaso del módulo al final" |
| Comprensión | Flashcards: editar front/back, agregar y quitar tarjetas. **Opción múltiple: solo vista previa; para cambiarla hay que regenerar.** El título de la posta no es editable |
| Profundización | Título de la posta (cambia `p.title` y `def.title`), reordenar, borrar, "+ profundización" (flashcards manual con una tarjeta vacía). En flashcards se editan las tarjetas; en opción múltiple, solo vista previa |
| Facts del inventario | **No se pueden editar ni borrar.** Solo hay casillas "evaluar" y "posta", y botones de auditar y re-auditar. Ver §6.3 |

### 5.4 Curaduría (`applyCuration` → `POST /emit`)
- **Estado:** `curOverride` guarda claves `${mid}:c:${cid}` y `${mid}:f:${fid}`. Si no hay clave, vale el valor del inventario (`proposedAsPosta` o `selected`). La casilla de un fact se deshabilita si su concepto no está tildado.
- **Indicadores:** "• cambios sin aplicar" (estado `dirty`). El botón "Aplicar selección (re-genera preguntas)" solo se habilita con cambios.
- **Validaciones:**
  - Un concepto con menos de 2 facts tildados genera el aviso `«label» necesita ≥2 datos (tiene n)` y se omite.
  - Si no queda ninguno, el error es `No hay conceptos con ≥2 datos evaluados para armar profundización.`
- **Resultado:**
  - La profundización pasa a ser lo emitido, más las postas manuales preservadas al final.
  - El inventario se reescribe: `proposedAsPosta`/`selected` según lo emitido; `dropReason` queda en `'no seleccionado por el editor'` o `'no evaluado por el editor'` si no tenía uno.
  - Se limpian los overrides del módulo.
  - Mensaje: `✓ Profundización re-generada: N posta(s) — avisos`.
- **La comprensión nunca se re-emite.**

---

## 6. Auditoría de facts

### 6.1 Dos capas distintas
1. **Anti-alucinación en route-lab (automática).** La `quote` tiene que existir en la fuente con fuzzy ≥0.85. Mide **fidelidad a la fuente, no verdad**. Lo que no pasa va a `integrityDropped`, que se muestra en gris y no se puede rescatar.
2. **Auditor de veracidad (a demanda, en el browser, `learn/factAudit.ts`).** Es lo que responde "¿es cierto?". Se detalla abajo.

### 6.2 Cómo funciona el auditor
- **Entrada:** `{statement, front, back, quote, kind}` con `lang:'es'`. Si `statement` viene vacío, se usa `"front → back"`.
- **Modelo:** `auditModel()`, que lee la key `smarty.auditModel` de localStorage; por defecto `'gpt-5.5'`. Se elige en Admin → Ajustes entre `gpt-5.5`, `gpt-5.4` y `gpt-5.4-mini`. Es independiente del preset del chat.
- **Llamada:** `completeWithTools` sobre OpenAI **Responses** (SDK `openai` en el browser con `dangerouslyAllowBrowser`, key `smarty.openaiKey`).
  - `instructions` = el prompt `audit.prompt` (editable en Admin → Reglas; override en `smarty.ov.audit.prompt`).
  - `input` = un mensaje de usuario fijo: "Auditá la afirmación de arriba usando las herramientas de búsqueda y devolvé SOLO el JSON del veredicto."
  - `max_output_tokens: 1500`, `store:false`, **`maxToolRounds: 8`**.
  - El loop agrega a la entrada los items `function_call`, ejecuta las tools y responde con `function_call_output`, hasta que el modelo devuelve texto.
- **Tools** (strict; `query` obligatorio):
  - `buscar_web`: `POST https://google.serper.dev/search {q, num:6, gl: searchGl (por defecto 'ar'), hl: searchHl (por defecto 'es')}` con header `X-API-KEY`. Es Serper **amplio**, sin la lista blanca infantil. Sin key, devuelve `{"error":"Falta la API key de Serper (Ajustes)."}` **al modelo**, no al usuario.
  - `buscar_wikipedia`: `GET https://es.wikipedia.org/w/rest.php/v1/search/page?q=…&limit=5`. El snippet es `description` o `excerpt` sin HTML. No necesita key.
  - Las fuentes consultadas se deduplican por URL.
- **Prompt (reglas):** verificar `"{{statement}}"`, tipo `{{kind}}`, cita original `"{{quote}}"`.
  1. *"TENÉS QUE buscar antes de concluir; nunca dictamines de memoria"*, apuntando a 2-3 fuentes independientes.
  2. Comparar la afirmación con las fuentes.
  3. Comparar la afirmación con la cita: *"¿la traducción o transcripción cambió un número o un dato?"*.
  4. Si es falsa, dar el valor correcto.
  - JSON exacto: `{"status":"confirmado|parcial|contradicho|sin-datos","confidence":0.0,"summary":"…","correction":"…(solo si contradicho/parcial)","sources":[{"title","url","snippet","agrees":"si|parcial|no|irrelevante"}]}`. Pide ser *"honesto y conservador"*.
  - **No hay refutación adversarial ni segundo juez.**
- **Normalización:**
  - Si no se consultó **ninguna** fuente, el resultado es `sin-datos`, confianza 0, resumen "El auditor no consultó ninguna fuente.".
  - Si el JSON no parsea, lanza `El auditor no devolvió un veredicto en el formato esperado.`
  - `status` fuera de la lista pasa a `sin-datos`; `confidence` se acota a [0,1].
  - Las `sources` se filtran a las URLs **realmente devueltas por las tools**. Si no queda ninguna, se usan las primeras 4 consultadas con `agrees:'irrelevante'`.
- **Qué se guarda por fact (`FactInv.audit: AuditResult`):** `{status, confidence, summary, correction?, sources:[{title,url,snippet,agrees}], model, auditedAt}`.
  - Vive en el estado del borrador y **se persiste solo al Guardar**, dentro de `learnRoutes.editorial`.
- **Disparadores:**
  - **Lupa por fact.** Sale en ámbar si el fact es "riesgoso": `kind==='numeric' || quoteScore < 0.9`.
  - **"Auditar N riesgosos"**: secuencial, sobre los riesgosos sin `audit`, tolerante a fallos, con progreso `Auditando d/t…`. Al final muestra `Auditoría del módulo: k/N datos auditados · f con error.`
  - **"↻ re-auditar"** dentro del panel. Pisa el veredicto anterior.
  - Solo una auditoría a la vez en toda la vista (`auditingFact`).
- **Lo que se ve:** badge `✓ confirmado`, `≈ parcial`, `✗ contradicho` o `? sin-datos`. El panel muestra el resumen, "Corrección (según fuentes)", "Confianza X% · modelo" y los links con marca de acuerdo (✓, ≈, ✗, ·) más 90 caracteres del snippet.
- **Errores visibles:** `Auditoría: <mensaje>`. Por ejemplo `NO_API_KEY` si falta la key de OpenAI.

### 6.3 Editar o eliminar un fact en /crear: **no existe**
- No se puede editar `statement`, `front`, `back` ni `quote` en el inventario. No hay borrado de facts. La `correction` del auditor **solo se muestra**: no hay "aplicar corrección".
- **Lo único que se puede hacer:**
  - destildar el fact y "Aplicar selección", que lo saca de la **profundización** al re-emitir;
  - editar a mano el texto de una **tarjeta de flashcards** en la posta. Eso no toca el fact del inventario, así que quedan desalineados.
- **Un fact usado en la comprensión no se puede sacar** sin regenerar el módulo entero.

---

## 7. Artefacto final: lo que se guarda y lo que Learn consume

### 7.1 Dexie (`app/src/db.ts`)
- Base `smarty`. **La versión 16** agrega:
  - `learnRoutes: '&id'`
  - `learnDefinitions: '&id, target, routeId'`
- Learn además lee y escribe `activityResults: '++id, target, finishedAt'` (versión 15).

| `LearnRouteRow` | Tipo | Valor desde /crear |
|---|---|---|
| `id` | string | `R` |
| `enabled` | boolean | **siempre `true`**, se fuerza en cada guardado. No hay UI para ponerlo en `false` |
| `origin` | `'generated'` | |
| `importedAt` | number (ms) | `Date.now()` de cada guardado |
| `route` | `LearnRoute & {version}` | §7.2 |
| `meta` | unknown | **`undefined`** desde /crear. Las rutas de `/routes` guardan `{origin, jobId, sources, learner}` |
| `editorial` | `RouteEditorial` \| undefined | §7.4. No está indexado, así que no requirió subir la versión de la base |

| `LearnDefinitionRow` | Tipo |
|---|---|
| `id` | = `def.id` (clave primaria global) |
| `routeId` | dueño (para borrar en cascada) |
| `target` | = `def.target` (indexado) |
| `importedAt` | number |
| `def` | `DefinitionRecipe` |

### 7.2 `LearnRoute`, `Posta` y `RouteModule` (`lib/learn.ts`, más `flatten`)

`route = {id, title, description ('' desde /crear), emoji, version (siempre 1), postas: Posta[], modules: RouteModule[], cover?: dataURL, category?: string}`

- `RouteModule = {id, title, emoji?, source?: {url, title, kind?: 'article'|'video', videoId?}}`. Si no hay fuente, `source` queda `undefined`.

**Variantes de Posta** (las postas de cada módulo van **contiguas** y en orden de módulo):

| Variante | `id` | `kind` | `definitionId` | `target` | Otros campos |
|---|---|---|---|---|---|
| Comprensión (1ª del módulo) | `<M>.check` | activity | `<R>.<M>.d.check` | `<R>.m.<M>.check` | `reading` = `m.source`; `passThreshold` = `m.passThreshold` (0-1, por defecto 0.7); `moduleId`; título "Comprensión de la lectura" |
| Profundización automática | `<M>.t.<C>` | activity | `<R>.<M>.d.<C>` | **`<R>.t.<C>`** (por ruta, no por módulo) | `moduleId`; título = label del concepto |
| Profundización manual | `p-<uid>` | activity | `<R>.d.manual-<uid>` | `<R>.t.manual-<uid>` | `moduleId`; "Nueva actividad" |
| Repaso de módulo (si está tildado) | `r-<M>` | recall | — | `<R>.m.<M>.recall` | `moduleId`; título `Repaso — <título módulo>` |
| Vieja (`/routes`) | `p<n>`, `r<n>`, `rend` | activity / recall | `ruta.<job>.d<n>` | `ruta.<job>.t.<C>` / `.recall-n` / `.recall-final` | sin `moduleId` ni `reading` |

`unflatten` reconoce la comprensión como la primera posta `activity` que tiene `reading`.

### 7.3 `DefinitionRecipe` y sus variantes (`registry.ts`)

`{id, typeId, title, target, generatorId, params, mode: 'untimed'|'timed', durationSec}`. route-lab siempre emite `mode:'untimed'`, y `durationSec` es 90 o 120 (las manuales usan 90).

| typeId | generatorId | `params` | ¿Lo emite /crear? |
|---|---|---|---|
| `flashcards` | `static` | `{cards: Card[]}`, con `Card = {id, front, back, skill, hint?}` (route-lab no emite `hint`) | **Sí** |
| `multiplechoice` | `static` | `{questions: MCQuestion[]}`, con `MCQuestion = {id, prompt, mode:'single'|'multi', skill, options:[{id, text, correct:boolean}]}` | **Sí, solo `single`**, 3-4 opciones, la correcta es `o1` |
| `quiz` | `math` \| `capitales-latam` | `MathQuizParams{questionCount,maxValue,ops,optionCount}` / `FactQuizParams{count,optionCount}` | No (seed / próximamente) |
| `domino` | `math` \| `capitales-latam` | `{maxValue,ops,tileCount}` / `{count}` | No |
| `multi` | `fixed` | `{childIds: string[]}` | No |

- **Modo `multi` de opción múltiple:** el motor sí lo juega, con 0..N correctas, crédito parcial `(aciertos−errores)/total_correctas` y atajos "Todas"/"Ninguna". **route-lab nunca lo genera.**
- **IDs de ítems:**
  - comprensión: `<M>.check.q<n>` o `<M>.check.c<n>`;
  - profundización: `<M>.<C>.q<n>` o `<M>.<C>.c<n>`;
  - manual: `c-<uid>`.
- **`skill` = `target`.** Ningún ítem guarda el `fact.id`: **no hay vínculo pregunta → fact**, salvo por texto.
- **Portero al acuñar:**
  - flashcards: arreglo no vacío; `id`, `front` y `back` no vacíos; ids únicos;
  - opción múltiple: arreglo de preguntas no vacío; `id`, `prompt` y `options` presentes; `qid` únicos; modo `single` o `multi`; al menos 2 opciones; `id`, `text` y `correct` booleano en cada opción; ids y textos únicos; en `single`, exactamente 1 correcta.

### 7.4 `editorial` (metadata del editor; Learn no la lee)

```ts
RouteEditorial = { modules: Record<ModuleId, { captionKind?: 'manual'|'asr'|null; jobId?: string; inventory?: ModuleInventory }> }
ModuleInventory = { concepts: ConceptInv[]; facts: FactInv[]; integrityDropped: {id, reason, quote}[] }
ConceptInv = { id, label, factCount, corroborated /*multi_source*/, proposedAsPosta, dropReason: string|null }
FactInv = { id, concept, conceptLabel, kind /*definition|property|numeric|relation*/, statement, front, back,
            quote /*literal, en el idioma ORIGINAL de la fuente*/, quoteScore /*[0.85,1], 3 decimales*/,
            corroborated /*procedencias>1*/, selected, dropReason: string|null, audit?: AuditResult }
```

- **No se persiste:** la procedencia (doc, chunk, sección), edad, nivel, `types`, `size` ni el `meta` de route-lab.
- **La "fuente" de un fact** es la del módulo (`module.source`).

### 7.5 Import (`learn/import.ts`), en orden
1. Revisa `kind==='smarty-route-bundle'`, `schemaVersion===1`, `route.id` y `postas[]`, y `definitions[]`.
2. Integridad referencial: cada posta que no es recall y tiene `definitionId` tiene que apuntar a una definición del bundle.
3. `registerImportedDefinitions` agrega las definiciones al catálogo **en memoria**.
4. **Acuñado seco:** `buildDefinition(id, 1)` para cada definición. Si falla:
   - las borra de memoria (rollback);
   - lanza `La app rechaza el bundle (acuñado seco falló):\n- <defId>: <causa>`.
5. Transacción de lectura y escritura sobre `learnRoutes` y `learnDefinitions`:
   - borra todas las definiciones de ese `routeId`;
   - hace `put` de la fila de la ruta, que la reemplaza entera;
   - hace `bulkPut` de las definiciones.

**Al borrar una ruta** se borran sus definiciones y la ruta. Los `activityResults` se conservan.

### 7.6 Cómo lo consume Learn
- **Catálogo:** `useImportedRoutes()` toma las filas con `enabled!==false`. Las definiciones viven en un mapa en memoria que se hidrata **una vez al arrancar** (`hydrateImportedDefinitions()` en `App.tsx`), sin filtrar por `enabled`.
- **Habilitación de postas (`resolveRoute`):** lineal sobre `postas`.
  - Una posta de actividad está "done" si:
    - tiene `passThreshold` y `bestPct ≥ passThreshold`;
    - o no tiene `passThreshold` y `attempts>0`, **lo que incluye intentos abortados con "Rendirse"**.
  - La siguiente se desbloquea si la anterior está done. Los recall no bloquean y no cuentan para el avance.
- **Overlay:**
  - si hay `reading`, primero muestra la lectura (`ReadingView` con `trusted`, sin juez) o el video (`VideoReadingView` por `videoId`, embed nocookie con sandbox), con el botón "Empezar preguntas →";
  - después juega la definición, acuñada con un seed aleatorio que baraja preguntas, opciones y tarjetas.
- **Resultados:** `activityResults {target, source:'ruta:<R>/posta:<id>', typeId, definitionId, seed, outcome, score, maxScore, pct, finishedAt, skills, rollup}`.
- **Recall de módulo:** toma los targets de las postas anteriores del mismo `moduleId` que ya tengan resultados, ordenados por urgencia `0.6·(1−últimoPct)+0.4·min(1,Δt/3d)`. Arma un multi de `min(5, n)` ítems. **Si no hay resultados todavía, el botón no hace nada.**

---

## 8. Configuración

| Qué | Dónde |
|---|---|
| URL de route-lab | localStorage `smarty.routeLabUrl`, por defecto `http://localhost:5203`. Es un input en /crear (y en Admin). **Se guarda solo al "Generar"**, no al "Aplicar selección" |
| Keys de route-lab | `route-lab/.env`, que se lee **una sola vez al arrancar** (`core/env.py`; una variable de entorno real tiene prioridad) |
| `OPENAI_API_KEY` | En el `.env` o en el entorno. Separada de la key de la app, aunque los docs piden usar la misma |
| `ROUTELAB_MODEL` | Opcional. En el `.env` actual está vacía, así que hoy se usa `gpt-5.4-mini`. **Además no funciona desde `.env`** (trampa R1) |
| `ALLOW_ORIGINS` | CORS separado por comas (sí se lee después de cargar el `.env`) |
| Docker | `python:3.11-slim`, `uvicorn server:app --port 5203`. La key va con `-e`; el `.env` y `jobs/` quedan fuera de la imagen |
| Dependencias | Solo la stdlib en las etapas. Además `fastapi>=0.110`, `uvicorn[standard]>=0.29`, `rapidfuzz>=3.0` (opcional) y `youtube-transcript-api>=1.2` (solo para video) |
| App: requisitos para entrar a /crear | `smarty.openaiKey` (sin esto `ChildShell` muestra la pantalla "NotConfigured"). Para ver "Crear" en el menú: `smarty.learnActivo='1'` y horario abierto. **Por URL directa `/crear` abre igual aunque Learn esté apagado**, porque `featureForPath` no mapea `/crear` |
| App: auditor | `smarty.serperKey` (opcional), `smarty.auditModel`, `smarty.searchGl`/`smarty.searchHl`, `smarty.ov.audit.prompt` |
| `/health` | Solo se usa por curl (README). **La app no lo llama** |

---

## 9. Lo que dicen los docs contra lo que hace el código

| Doc | Dice | El código hace |
|---|---|---|
| RUTAS_GENERADAS (encabezado y §5) | "sin implementar"; "Dexie v16 pendiente, rutas hardcodeadas"; "`activityResults` sin ámbito de backup" | Todo eso ya existe: Dexie v16, importador, creador; `ROUTES=[]`; `activityResults` está en el ámbito 'sesion' y las tablas de Learn en 'catalogo' |
| RUTAS §1 | 7 etapas, con `moderate` como juez LLM fail-closed sobre el 100% de los textos y gate humano | Lista negra de 4 palabras que **solo cuenta**. `finalApprovedAt` siempre es `null` y el importador lo ignora. `/crear` usa otro pipeline (ingest → extract → module) |
| RUTAS §1 ingest | Readability, yt-dlp, PDF (pypdf), .md, deep research | Solo Wikipedia (action API, no REST) y youtube-transcript-api |
| RUTAS decisiones | Mini para extract, gpt-5.4 para merge y aristas; caché sqlite; costo con tope de corpus | Un solo modelo; el merge es determinista; sin caché ni reintentos; sin tope global (8 secciones o 8 chunks) |
| RUTAS §1.5 | Distractores por pool determinista y LLM solo si no hay pool | Al revés: **primero el LLM** y el pool como relleno |
| RUTAS §1.3 / §3 / §4.b | `prereqGraph` en el bundle; Packs (`manifest.yaml`, `recipe.py`); `templates/`; `contracts/`; `core/pack.py`; `core/moderation.py`; CLI `--from` | Nada de eso existe |
| RUTAS §1.1 | Generadores literales para quiz y domino (`pairs`) | Solo `static` para flashcards y opción múltiple |
| RUTAS §4.b | Mapeo de `kind` a front/back | El LLM emite front y back directamente |
| RUTAS §2 | Ejemplo de `review.finalApprovedAt` con timestamp | `null`; /crear ni siquiera manda `review` |
| RUTAS §1 | `version` entero que se incrementa al reemplazar | Siempre 1, nunca se incrementa |
| RUTAS §5 | Fact alucinado con score 0.46 | El artefacto en disco dice 0.55 (depende de rapidfuzz o difflib) |
| route-lab README | Solo documenta `/health` y `/routes`; "POST HTTP crudo a la Responses API" (en `requirements.txt`) | Existen `/module` y `/emit`, que son los que usa /crear; la llamada es a **Chat Completions** |
| AUDITORIA (encabezado) | "Nada implementado"; "solo multiple choice" | Fases 1a, 1b, 2a y 2b implementadas. **Flashcards es el tipo por defecto** de cada módulo nuevo y ambos tipos están habilitados |
| AUDITORIA §5.1 | El fact del inventario trae `provenance[]`; los descartados por cita no verificable van en `facts` con `dropReason` | Sin `provenance`. Tiene `conceptLabel` y `corroborated`. Los descartados por integridad van **aparte** en `integrityDropped` (solo id, razón y cita) |
| AUDITORIA §5.2 / §8.1 | Re-emitir **solo lo afectado** (un fact = una llamada) | `/emit` re-emite **toda** la profundización de los conceptos tildados en una llamada. La comprensión nunca se re-emite |
| AUDITORIA §5.3 | Fases futuras: `evaluated: boolean` | Se usa `selected` |
| AUDITORIA §6 vs §8.3 vs §9 | Una herramienta `buscar_fuentes`; "sin key de búsqueda no audita" | Dos herramientas (`buscar_web`, `buscar_wikipedia`); sin Serper **audita igual** con Wikipedia (lo reconoce el propio §9) |
| AUDITORIA §6 | `correction` editable; `auditedAt` para saber si está viejo | Solo lectura; `auditedAt` se guarda pero no se muestra ni se usa |
| AUDITORIA §7 | "agregá una pregunta manual" | En opción múltiple no hay edición manual. Las postas manuales son solo de flashcards |
| `routeDraft.ts` (comentario de `captionKind`) | "Transitorio (no se persiste)" | Se persiste en `editorial` (commit 3dae6a2) |

---

## 10. Trampas y detalles finos para el porte

### route-lab

- **R1. `ROUTELAB_MODEL` del `.env` nunca se aplica.**
  - `server.py` y `cli.py` importan `stages` (y con eso `core/llm.py`, que fija `MODEL_DEFAULT` y el default del parámetro `model=`) **antes** de llamar a `load_env()`.
  - Solo funciona como variable de entorno real del proceso.
  - `OPENAI_API_KEY` sí funciona, porque se lee en cada llamada.
  - Lo comprobé ejecutando con `-B`: `MODEL_DEFAULT='gpt-5.4-mini'` y el default de kwargs queda fijado.
- **R2. El idioma del transcript sale mal en la práctica.**
  - La heurística "primera pista ASR = idioma original" eligió **árabe (`lang: ar`)** en los dos videos en español que hay en disco: `jobs/https-www-youtube-com-watch-v-h6utjnflru0/10-corpus/*.md` y `jobs/…-4ex-l4sfbjs/…`.
  - Resultado: las citas quedan en árabe y los facts en español. El auditor recibe citas árabes.
  - Al portar, elegir la pista por el idioma real del audio o por el `lang` pedido.
- **R3. El chequeo anti-alucinación es débil.**
  - Solo pide que la cita exista en la fuente con fuzzy ≥0.85 contra **todo** el documento. Una cita de 3 palabras pasa.
  - No verifica que `statement`, `front` o `back` coincidan con la cita.
  - Las citas cortas con comillas «» pasaron con 0.86-0.89.
- **R4. El LLM no tiene validación de esquema.** Si falta un campo, sale `KeyError` y 500 con `módulo falló: KeyError: 'quote'`. `kind` no se valida.
- **R5. Las carpetas de job se comparten y no se limpian.**
  - El `jobId` es el slug de la fuente, así que dos rutas, usuarios o pedidos simultáneos sobre la misma fuente usan la misma carpeta (condición de carrera).
  - `corpus_ids()` lista **todos** los `.md`: si quedaron chunks viejos, entran en la extracción.
  - `module.py` toma la fuente de `doc_ids[0]` en orden alfabético.
- **R6. Path traversal.** El `jobId` que manda el cliente se usa como ruta de archivo sin sanear (`JOBS / job_id` + `mkdir`) en `/routes`, `/module` y `/emit`.
- **R7. `meta.truncated` es un string** (`"True"`/`"False"`) porque el front-matter se lee como texto. En Wikipedia vale `null`.
- **R8. Sin caché.** Regenerar vuelve a hacer N llamadas de extracción (una por chunk, hasta 8, cada una con timeout de 90 s) y produce **facts distintos**, porque el LLM no es determinista. Por eso existe `/emit`.
- **R9. Edad y nivel casi no influyen.**
  - No entran al prompt de extracción ("chicos 8-12" está fijo en el texto).
  - `basico` y `medio` dan exactamente lo mismo; solo `avanzado` suma una tarjeta o pregunta.
  - La edad cambia los topes y el texto del prompt de distractores.
- **R10. La comprensión queda chica.**
  - Tiene **≈ nº de conceptos** preguntas (1 por concepto), con piso de 2.
  - Con `passThreshold 0.7`:
    - 2 preguntas de opción múltiple → hace falta el 100% (10/20 = 0.5);
    - 3 preguntas → también el 100%;
    - 4 preguntas → alcanza con 3 de 4.
  - En flashcards el puntaje tiene bonus por racha, con lo que el porcentaje sube todavía menos.
- **R11. Solapamiento y orden.** La comprensión y la profundización pueden repetir el mismo fact. La profundización toma los primeros `maxCards` en orden de extracción, no por score.
- **R12. El pool de distractores es todo el módulo.** Las respuestas de otros conceptos pueden aparecer como distractores aunque no tengan relación con la pregunta.
- **R13. `/emit` con `idPrefix: null`.** Como `model_dump` incluye la clave, `p.get("idPrefix", defId)` devuelve `None` y los ids quedan como `"None.q1"`.
- **R14. `corroborated` engaña en videos.** Que un concepto aparezca en 2 chunks del **mismo** video lo marca como `multi_source` y la UI muestra "✓ 2+ fuentes".

### Creador (front)

- **F1. Lo que se pierde al reabrir.** `unflatten` reinicia `types:['flashcards']` y `size:'auto'`. Si se reabre una ruta de opción múltiple y se hace "Aplicar selección", **se emiten flashcards** (`activityType: m.types[0]`). Edad y nivel tampoco se persisten.
- **F2. Regenerar borra también las postas de profundización manuales** y el inventario, con todas sus auditorías. Curar sí preserva las manuales, pero **las manda al final** y reordena las automáticas según el orden del inventario. También pisa los títulos editados.
- **F3. Después de curar, `selected` miente sobre la comprensión.**
  - Los facts que solo están en la comprensión pasan a `selected:false` con `'no evaluado por el editor'`.
  - Consecuencia: **el aviso de "contradichos" al guardar deja de verlos**.
- **F4. Para artículos, lo que se envía es el título, no la URL.**
  - Si después se edita la URL o el título de un video ya generado, `videoId` y `kind` **no se actualizan**, así que Learn reproduce el video viejo.
  - Nada valida que la lectura y las preguntas sean coherentes.
- **F5. `parseYtUrl` y `_yt_video_id` no coinciden.** El front trata `watch?v=X&list=PL…` como playlist y no lo manda como video.
- **F6. El borrador no persiste.**
  - Recargar la página o salir de `/crear` pierde todo, incluidas las auditorías ya pagadas.
  - Con una ruta guardada abierta, "Nueva" o elegir otra ruta **descarta sin preguntar** los cambios sin guardar (el confirm solo aparece si `!isEditing`).
  - Borrar un módulo no pide confirmación.
- **F7. Errores de validación de pydantic.** `JSON.parse(raw).detail` llega como arreglo y `String(detail)` muestra `[object Object]`. Un input de edad vacío da `NaN`, que se serializa como `null` y produce 422.
- **F8. Sin timeouts ni cancelación en el front.** `fetch` no tiene `AbortController` para `/module` ni `/emit`. Se pueden lanzar varios "Generar" en paralelo, uno por módulo.
- **F9. Mismo concepto en dos módulos de una ruta.** Comparten target `<R>.t.<C>`, así que comparten maestría: jugar uno marca el otro como hecho. La comprensión (`<R>.m.<M>.check`) sí es estable por módulo.
- **F10. La opción múltiple no es editable.** La correcta siempre es `o1` en los datos guardados; Learn baraja con el seed. Si se replica el juego, **hay que barajar**.

### Persistencia / IndexedDB

- **D1. Guardar fuerza `enabled:true`** con `put` de la fila entera, y `meta` queda `undefined`.
- **D2. Inconsistencias del catálogo en memoria:**
  - `deleteImportedRoute` no limpia la memoria: las definiciones borradas siguen activas (y alimentan el recall) hasta recargar.
  - Un acuñado seco fallido al re-guardar una ruta existente **saca de memoria** sus definiciones vigentes, y la ruta muestra "No encontré esta actividad" hasta recargar.
  - Si la transacción de Dexie falla, la memoria ya tiene las definiciones nuevas.
- **D3. Hidratación al arrancar.** Se hace una sola vez y de forma asíncrona, sin `await` antes del render.
- **D4. No hay foreign key pregunta → fact.** No hay puntaje por fact (lo confirma `ESTADO.md` §7.3). Si Innerith quiere mostrar badges de auditoría por pregunta o repasar facts fallados, tiene que agregar `factId` a los ítems (`skill = fact.id` sería la vía barata según ESTADO).
- **D5. `editorial` puede pesar.** Incluye todo el inventario y todas las auditorías, y `cover` es un data URL. El creador carga todas las rutas con `useLiveQuery`.

### Auditor

- **A1. Título y snippet de las fuentes vienen del LLM.** Se filtran por URL realmente consultada, pero se usa `s.title || base.title` y `s.snippet || base.snippet`. El texto que se muestra como "lo que dice la fuente" **puede estar parafraseado o inventado**.
- **A2. Si se agotan las 8 rondas de tools,** el texto puede quedar vacío y el resultado es un error de formato. Con `max_output_tokens:1500` en un modelo de razonamiento existe riesgo de truncamiento; esto no lo verifiqué.
- **A3. Corre con las keys en el browser** (OpenAI con `dangerouslyAllowBrowser`, Serper en localStorage). En Innerith conviene moverlo al backend Node.
- **A4. El modo lote solo audita "riesgosos" sin veredicto.** Los umbrales no coinciden: el badge de certeza usa 0.92 y "riesgoso" usa 0.9.

---

## 11. No verificado

- El comportamiento real de `youtube-transcript-api` al listar pistas. Infiero el bug R2 solo por los artefactos (`lang: ar`).
- El formato exacto de los 422 de validación de FastAPI en esta versión.
- Si el Responses API con `store:false` y reasoning requiere `encrypted_content` en el loop de tools.
- Los tiempos reales de punta a punta.
- Que el flujo ande en el browser contra un route-lab vivo. No levanté servidores.
