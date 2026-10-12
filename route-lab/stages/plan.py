"""Etapa 4 — plan. Determinista (sin LLM). Toposort → postas de flashcards (una por
concepto) + recall cada K + recall endless al cierre. Regla de oro: NUNCA estirar
(concepto con menos de MIN_FACTS se cae con causa)."""
from __future__ import annotations
from core.job import Job

MIN_FACTS = 2
EMOJI = "🪐"


def _difficulty(edad: int, nivel: str) -> dict:
    base = {"durationSec": 120 if edad <= 9 else 90, "maxCards": 6 if edad <= 9 else 8}
    if nivel == "avanzado":
        base["maxCards"] += 1
    return base


def run(job: Job, edad: int = 10, nivel: str = "medio") -> dict:
    facts = job.read_json("20-facts.json")
    graph = job.read_json("25-graph.json")
    diff = _difficulty(edad, nivel)

    facts_by_concept: dict[str, list] = {}
    for f in facts["facts"]:
        facts_by_concept.setdefault(f["concept"], []).append(f)

    label = {c["id"]: c["label"] for c in facts["concepts"]}
    order = [c for c in graph["order"] if c in facts_by_concept]  # sólo conceptos con facts

    slug = job.id
    route_id = f"ruta.{slug}"
    K = 3 if edad <= 9 else 4

    postas = []
    dropped = []
    n = 0
    for concept in order:
        fs = facts_by_concept[concept]
        if len(fs) < MIN_FACTS:
            dropped.append({"concept": concept, "reason": f"sólo {len(fs)} fact(s) < MIN_FACTS {MIN_FACTS} (no se estira)"})
            continue
        n += 1
        postas.append({
            "posta_id": f"p{n}", "kind": "activity", "concept": concept,
            "title": label.get(concept, concept),
            "target": f"{route_id}.t.{concept}",
            "fact_ids": [f["id"] for f in fs][: diff["maxCards"]],
            "durationSec": diff["durationSec"],
        })
        if n % K == 0:  # recall cada K postas de actividad
            postas.append({"posta_id": f"r{n}", "kind": "recall", "title": "Repaso", "target": f"{route_id}.recall-{n}"})

    # recall endless de cierre
    postas.append({"posta_id": "rend", "kind": "recall", "title": "Repaso final", "target": f"{route_id}.recall-final"})

    out = {
        "route_id": route_id,
        "title": _title(facts),
        "emoji": EMOJI,
        "learner": {"edad": edad, "nivel": nivel},
        "postas": postas,
        "dropped_concepts": dropped,
    }
    job.write_json("30-plan.json", out)
    summary = {
        "postas_actividad": sum(1 for p in postas if p["kind"] == "activity"),
        "postas_recall": sum(1 for p in postas if p["kind"] == "recall"),
        "dropped": len(dropped),
        "order": order,
    }
    job.stamp("plan", summary)
    return summary


def _title(facts: dict) -> str:
    # título simple desde el concepto más "central" (el que más facts tiene)
    top = max(facts["concepts"], key=lambda c: c["fact_count"], default=None)
    return f"Ruta: {top['label']}" if top else "Ruta generada"
