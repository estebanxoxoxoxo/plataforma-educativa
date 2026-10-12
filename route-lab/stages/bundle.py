"""Etapa 6 — bundle. Ensambla el route-bundle.json (contrato con app/). Moderación:
en la PoC un chequeo local trivial (lista negra) — NO es el juez LLM real; queda
declarado como stub honesto. Gate humano = revisar 60-route-bundle.json y aprobar."""
from __future__ import annotations
from core.job import Job

# lista negra mínima de demo (el juez LLM real es la etapa que falta cablear)
BLOCKLIST = {"droga", "arma", "sexo", "matar"}


def _visible_strings(bundle: dict):
    r = bundle["route"]
    yield r["title"]
    for p in r["postas"]:
        yield p["title"]
    for d in bundle["definitions"]:
        yield d["title"]
        for c in d["params"]["cards"]:
            yield c["front"]
            yield c["back"]


def run(job: Job) -> dict:
    gen = job.read_json("40-definitions.json")
    plan = job.read_json("30-plan.json")
    req = job.read_json("00-request.json") if job.exists("00-request.json") else {}

    bundle = {
        "kind": "smarty-route-bundle",
        "schemaVersion": 1,
        "route": {**gen["route"], "version": 1},
        "definitions": gen["definitions"],
        "requires": {"types": {"flashcards": {"contractVersion": 1, "generators": ["static"]}}},
        "meta": {
            "origin": "route-lab@poc",
            "jobId": job.id,
            "sources": req.get("sources", []),
            "learner": plan.get("learner", {}),
        },
    }

    # moderación (stub honesto: sólo lista negra determinista; falta el juez LLM)
    flagged = []
    for s in _visible_strings(bundle):
        low = (s or "").lower()
        hit = next((w for w in BLOCKLIST if w in low), None)
        if hit:
            flagged.append({"text": s, "word": hit})
    bundle["review"] = {
        "moderation": {"method": "blocklist-stub", "items_checked": sum(1 for _ in _visible_strings(bundle)), "flagged": len(flagged)},
        "finalApprovedAt": None,  # lo setea el gate humano
        "note": "moderación real (juez LLM) sin cablear en la PoC; esto es solo lista negra",
    }

    job.write_json("55-moderation.json", {"flagged": flagged})
    job.write_json("60-route-bundle.json", bundle)
    summary = {
        "postas": len(bundle["route"]["postas"]),
        "definitions": len(bundle["definitions"]),
        "flagged": len(flagged),
        "bundle": str((job.dir / "60-route-bundle.json")),
    }
    job.stamp("bundle", summary)
    return summary
