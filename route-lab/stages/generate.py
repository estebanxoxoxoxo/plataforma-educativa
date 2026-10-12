"""Etapa 5 — generate. Determinista (fact → Card, sin distractores). Emite
DefinitionRecipe con generatorId 'static' (params = {cards}), byte-compatible con
app/src/learn. Replica el PORTERO de flashcards (front/back no vacíos) antes de emitir."""
from __future__ import annotations
from core.job import Job


def _check_card(card: dict) -> str | None:
    """Portero espejo del Tipo flashcards. Devuelve la causa si es inválida, o None."""
    if not card.get("id"):
        return "card sin id"
    if not (card.get("front") or "").strip():
        return f"front vacío ({card['id']})"
    if not (card.get("back") or "").strip():
        return f"back vacío ({card['id']})"
    return None


def run(job: Job) -> dict:
    facts = job.read_json("20-facts.json")
    plan = job.read_json("30-plan.json")
    fact_by_id = {f["id"]: f for f in facts["facts"]}

    definitions = []
    route_postas = []
    rejected = []

    for p in plan["postas"]:
        if p["kind"] == "recall":
            route_postas.append({"id": p["posta_id"], "title": p["title"], "kind": "recall", "target": p["target"]})
            continue
        cards = []
        for fid in p["fact_ids"]:
            f = fact_by_id.get(fid)
            if not f:
                continue
            card = {"id": fid, "front": f["front"], "back": f["back"], "skill": p["target"]}
            why = _check_card(card)
            if why:
                rejected.append({"card": fid, "reason": why})
                continue
            cards.append(card)
        if len(cards) < 2:
            rejected.append({"posta": p["posta_id"], "reason": f"quedó con {len(cards)} card(s) válidas < 2"})
            continue
        def_id = f"{plan['route_id']}.d{len(definitions) + 1}"
        definitions.append({
            "id": def_id, "typeId": "flashcards", "title": p["title"], "target": p["target"],
            "generatorId": "static", "params": {"cards": cards}, "mode": "untimed", "durationSec": p["durationSec"],
        })
        route_postas.append({"id": p["posta_id"], "title": p["title"], "kind": "activity", "definitionId": def_id, "target": p["target"]})

    out = {
        "route": {"id": plan["route_id"], "title": plan["title"], "emoji": plan["emoji"], "postas": route_postas},
        "definitions": definitions,
    }
    job.write_json("40-definitions.json", out)
    summary = {"definitions": len(definitions), "cards_total": sum(len(d["params"]["cards"]) for d in definitions), "rejected": len(rejected)}
    job.stamp("generate", summary)
    return summary
