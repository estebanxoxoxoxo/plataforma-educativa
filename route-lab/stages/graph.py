"""Etapa 3 — graph. Aristas de prerrequisito (LLM/stub) + señal RefD (wiki_links) +
needs_review (híbrido ACE) + toposort de Kahn (stdlib graphlib). Con 1 fuente esto era
inerte; con 2 el orden deja de ser el del artículo."""
from __future__ import annotations
import json
from graphlib import TopologicalSorter, CycleError
from pathlib import Path

from core.job import Job
from core import llm

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
REVIEW_THRESHOLD = 0.70


def run(job: Job) -> dict:
    facts = job.read_json("20-facts.json")
    concept_ids = {c["id"] for c in facts["concepts"]}
    fpath = FIXTURES / f"{job.id}.json"
    fixture = json.loads(fpath.read_text(encoding="utf-8")) if fpath.exists() else {}

    prompt = _edges_prompt(facts["concepts"])
    resp = llm.complete_json(job, "graph.edges", prompt, stub=fixture.get("edges", []))
    raw_edges = llm.unwrap(resp, "edges")

    # señal RefD: ¿el concepto aparece en los wiki_links capturados? (barata, determinista)
    links = set()
    for doc_id in job.corpus_ids():
        if job.exists(f"10-corpus/{doc_id}.links.json"):
            links.update(job.read_json(f"10-corpus/{doc_id}.links.json"))
    refd_seen = {c["id"]: _label_in_links(c["label"], links) for c in facts["concepts"]}

    edges = []
    for e in raw_edges:
        if e["from"] not in concept_ids or e["to"] not in concept_ids:
            continue  # arista a un concepto que no sobrevivió el filtro de facts
        needs_review = e["confidence"] < REVIEW_THRESHOLD
        edges.append({**e, "needs_review": needs_review,
                      "refd": {"from_seen": refd_seen.get(e["from"], False), "to_seen": refd_seen.get(e["to"], False)}})

    # toposort (prereqs primero): grafo node -> predecesores (los `from`)
    accepted = [e for e in edges if not e["needs_review"]]  # las dudosas no ordenan hasta validarse
    preds: dict[str, set] = {c: set() for c in concept_ids}
    for e in accepted:
        preds[e["to"]].add(e["from"])
    order = _toposort(preds, accepted)

    needs_review = [e for e in edges if e["needs_review"]]
    out = {
        "order": order,
        "edges": edges,
        "needs_review": needs_review,
        "levels": _levels(preds, order),
    }
    job.write_json("25-graph.json", out)
    summary = {
        "concepts_ordered": len(order),
        "edges": len(edges),
        "needs_review": len(needs_review),
        "order": order,
        "llm": "real" if llm.have_key() else "stub",
    }
    job.stamp("graph", summary)
    return summary


def _label_in_links(label: str, links: set[str]) -> bool:
    toks = [t for t in label.lower().split() if len(t) > 3]
    return any(any(t in link for link in links) for t in toks)


def _toposort(preds: dict[str, set], accepted: list[dict]) -> list[str]:
    while True:
        try:
            return list(TopologicalSorter(preds).static_order())
        except CycleError:
            # romper el ciclo por la arista aceptada de menor confianza
            weakest = min(accepted, key=lambda e: e["confidence"])
            preds[weakest["to"]].discard(weakest["from"])
            accepted.remove(weakest)


def _levels(preds: dict[str, set], order: list[str]) -> list[list[str]]:
    depth: dict[str, int] = {}
    for n in order:
        depth[n] = 1 + max([depth[p] for p in preds.get(n, set())], default=-1)
    out: dict[int, list[str]] = {}
    for n, d in depth.items():
        out.setdefault(d, []).append(n)
    return [out[d] for d in sorted(out)]


def _edges_prompt(concepts: list[dict]) -> str:
    names = "\n".join(f"- {c['id']}: {c['label']}" for c in concepts)
    return (
        "Sos un experto en secuenciación pedagógica. Dado el conjunto de conceptos, "
        "devolvé aristas de PRERREQUISITO en JSON {edges:[{from, to, confidence (0..1), rationale}]} "
        "donde `from` conviene aprenderse antes que `to`. Sé conservador; sólo aristas con evidencia.\n\n"
        f"CONCEPTOS:\n{names}"
    )
