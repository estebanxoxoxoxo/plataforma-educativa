"""route-lab HTTP API (FastAPI). Cáscara fina sobre las mismas etapas del CLI. La app
la llama con una fuente y recibe el bundle SÍNCRONO. Patrón tts-lab/moderation-lab.

  uvicorn server:app --host 0.0.0.0 --port 5203
"""
from __future__ import annotations
import os
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.env import load_env
from core.job import Job
from stages import ingest, extract, graph, plan, generate, bundle, module, emit

load_env()

app = FastAPI(title="route-lab", version="0.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("ALLOW_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RouteRequest(BaseModel):
    sources: list[str]
    edad: int = 10
    nivel: str = "medio"
    lang: str = "es"
    jobId: str | None = None


class ModuleRequest(BaseModel):
    source: str
    routeId: str
    moduleId: str
    edad: int = 10
    nivel: str = "medio"
    lang: str = "es"
    activityTypes: list[str] = ["flashcards"]
    size: str = "auto"
    jobId: str | None = None


class EmitPosta(BaseModel):
    postaId: str | None = None
    defId: str
    target: str
    title: str = ""
    idPrefix: str | None = None
    factIds: list[str] = []


class EmitRequest(BaseModel):
    facts: list[dict]
    postas: list[EmitPosta]
    edad: int = 10
    nivel: str = "medio"
    lang: str = "es"
    activityType: str = "multiplechoice"
    jobId: str | None = None


def _slug(sources: list[str]) -> str:
    s = "-".join(sources).lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return (s[:48] or "route")


@app.get("/health")
def health():
    return {"ok": True, "mode": "real" if os.environ.get("OPENAI_API_KEY") else "stub"}


@app.post("/routes")
def make_route(req: RouteRequest):
    if not req.sources:
        raise HTTPException(status_code=400, detail="Falta 'sources' (al menos una fuente)")
    job_id = req.jobId or _slug(req.sources)
    job = Job(job_id)
    job.write_json("00-request.json", {
        "jobId": job_id, "sources": req.sources, "lang": req.lang, "edad": req.edad, "nivel": req.nivel,
    })
    try:
        ingest.run(job, req.sources, req.lang)
        extract.run(job)
        graph.run(job)
        plan.run(job, req.edad, req.nivel)
        generate.run(job)
        summary = bundle.run(job)
    except Exception as e:  # causa concreta al cliente (regla de la casa)
        raise HTTPException(status_code=500, detail=f"pipeline falló: {type(e).__name__}: {e}")
    return {"jobId": job_id, "summary": summary, "bundle": job.read_json("60-route-bundle.json")}


@app.post("/module")
def make_module(req: ModuleRequest):
    if not req.source.strip():
        raise HTTPException(status_code=400, detail="Falta 'source' (título de Wikipedia o link de YouTube)")
    if not req.routeId or not req.moduleId:
        raise HTTPException(status_code=400, detail="Faltan 'routeId'/'moduleId'")
    if not any(t in ("flashcards", "multiplechoice") for t in req.activityTypes):  # fail-fast: no gastar Wikipedia/LLM
        raise HTTPException(status_code=422, detail="v1 genera 'flashcards' o 'multiplechoice'; activityTypes no incluye ninguno")
    job_id = req.jobId or _slug([req.source])
    job = Job(job_id)
    job.write_json("00-request.json", {
        "jobId": job_id, "sources": [req.source], "lang": req.lang, "edad": req.edad, "nivel": req.nivel,
        "module": {"routeId": req.routeId, "moduleId": req.moduleId, "size": req.size, "activityTypes": req.activityTypes},
    })
    try:
        ingest.run(job, [req.source], req.lang)
        extract.run(job)
        result = module.run(job, req.routeId, req.moduleId, req.edad, req.nivel,
                            activity_types=req.activityTypes, size=req.size, lang=req.lang)
    except ValueError as e:  # validación de negocio → 422 con causa
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:  # causa concreta al cliente (regla de la casa)
        raise HTTPException(status_code=500, detail=f"módulo falló: {type(e).__name__}: {e}")
    return result


@app.post("/emit")
def emit_postas(req: EmitRequest):
    """Re-emite postas (MC/flashcards) a partir de los facts que la app ya tiene (curaduría 1b).
    NO re-extrae → los fact-ids se conservan. Ver stages/emit.py."""
    if not req.postas:
        raise HTTPException(status_code=400, detail="Falta 'postas' (al menos una posta a emitir)")
    if not req.facts:
        raise HTTPException(status_code=400, detail="Falta 'facts' (el inventario del módulo)")
    if req.activityType not in ("multiplechoice", "flashcards"):
        raise HTTPException(status_code=422, detail=f"activityType '{req.activityType}' no soportado")
    job = Job(req.jobId or "emit-adhoc")
    try:
        return emit.run(job, postas=[p.model_dump() for p in req.postas], facts=req.facts,
                        edad=req.edad, nivel=req.nivel, activity_type=req.activityType, lang=req.lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"emit falló: {type(e).__name__}: {e}")
