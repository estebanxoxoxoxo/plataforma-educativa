# route-lab

Servicio aislado de generación de **rutas de aprendizaje** para Smarty. Convierte una
colección de contenidos (PoC: 2 artículos de Wikipedia) en un `route-bundle.json` que
la feature Learn de `app/` importa. Diseño completo: [`../RUTAS_GENERADAS.md`](../RUTAS_GENERADAS.md).

CLI-first, con un server HTTP encima (ver abajo) que la app usa para generar rutas. Cada corrida
es un **job = carpeta de artefactos** re-corribles
(`jobs/<jobId>/`). Contratos estables en los seams; cada etapa lee y escribe archivos.

## Correr la PoC (cero instalaciones — solo stdlib)

```bash
cd route-lab
python3 cli.py run poc-solar --sources "Sistema solar" "Júpiter (planeta)" --edad 10 --nivel medio
```

Corre todas las etapas y deja el bundle en `jobs/poc-solar/60-route-bundle.json`.
También se puede correr etapa por etapa:

```bash
python3 cli.py ingest   poc-solar --sources "Sistema solar" "Júpiter (planeta)"
python3 cli.py extract  poc-solar          # LLM (o --stub por fixtures si no hay OPENAI_API_KEY)
python3 cli.py graph    poc-solar
python3 cli.py plan     poc-solar --edad 10 --nivel medio
python3 cli.py generate poc-solar
python3 cli.py bundle   poc-solar
```

## Etapas

| # | Etapa | Entrada → Salida | LLM |
|---|---|---|---|
| 1 | `ingest`   | títulos wiki → `10-corpus/<doc>.md` | no (Wikipedia REST, real) |
| 2 | `extract`  | corpus → `20-facts.json` (pase A por doc + **merge** cross-fuente + checker fuzzy) | sí* |
| 3 | `graph`    | facts → `25-graph.json` (aristas prereq + needs_review + toposort) | sí* |
| 4 | `plan`     | facts+graph → `30-plan.json` (postas flashcards + recall) | no |
| 5 | `generate` | plan+facts → `40-definitions.json` + route | no |
| 6 | `bundle`   | → `60-route-bundle.json` | no |

\* Las etapas LLM llaman a OpenAI si `OPENAI_API_KEY` está seteada; si no, corren en
**modo stub** leyendo `fixtures/<jobId>.json` (respuestas canned sobre el corpus real).
El prompt que se enviaría queda guardado en `jobs/<jobId>/prompts/` en ambos casos.

## API key (LLM real)

`extract`/`graph` corren en **stub** por fixtures salvo que haya `OPENAI_API_KEY`. Para
correr con LLM real: copiá tu key (la misma de la app → Admin → Ajustes) al `.env`:

```
OPENAI_API_KEY=sk-...
```

> ⚠️ **El `.env` se lee UNA SOLA VEZ, al arrancar el proceso** (`core/env.py` lo carga al
> importar). Si cambiás la key con el server corriendo, **hay que reiniciarlo**: si no sigue
> usando la vieja y la generación falla con `401 Unauthorized`. Verificá con
> `curl -s localhost:5203/health` → `{"ok":true,"mode":"real"}`.

`.env` está **gitignored** y **no se copia a la imagen Docker** (`.dockerignore`); en
Docker la key se pasa en runtime. El prompt enviado siempre queda en `jobs/<id>/prompts/`.
Con key, el pipeline corre sobre cualquier fuente (los fixtures se ignoran); sin key, el
`jobId` tiene que matchear un fixture (`fixtures/<jobId>.json`).

## Server HTTP (para llamar desde la app)

Cáscara FastAPI sobre las mismas etapas. La app POSTea una fuente y recibe el bundle
**síncrono**.

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 5203
```

- `GET /health` → `{ok, mode: "real"|"stub"}`
- `POST /routes` body `{sources: string[], edad, nivel, lang?, jobId?}` → `{jobId, summary, bundle}`
  (el `bundle` es el `route-bundle.json` completo). CORS abierto (browser-direct).

```bash
curl -X POST http://localhost:5203/routes -H "Content-Type: application/json" \
  -d '{"sources":["Sistema solar","Júpiter (planeta)"],"edad":10,"nivel":"medio"}'
```

## Docker

```bash
docker build -t route-lab .
docker run --rm -p 5203:5203 -e OPENAI_API_KEY=sk-... route-lab
```

La key se pasa con `-e` (nunca horneada). Para testers remotos = URL fija con CORS,
igual que voice-server.

## Dependencias

Núcleo: **stdlib de Python 3.11** (urllib, json, graphlib, difflib). Opcionales (mejoran
pero no hacen falta): `rapidfuzz` (fuzzy más rápido que difflib), `openai` (o se usa el
POST HTTP crudo de `core/llm.py`). Ver `requirements.txt`.
