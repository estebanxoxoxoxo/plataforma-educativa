"""Etapa emit — EMISIÓN de postas a partir de facts YA extraídos (no re-extrae). La usa la
curaduría humana (Fase 1b, ver AUDITORIA_FACTS.md): la app manda los facts del inventario que
ya tiene + qué posta arma cada concepto, y devolvemos las Definiciones (MC o flashcards) con
los MISMOS fact-ids. Los distractores (MC) se generan UNA vez para todos los facts referenciados
(pool = todos los facts del módulo, para que no queden pobres). Reusa stages/mc.py y el portero
de flashcards; NO toca el path automático de module.run (que sigue byte-idéntico)."""
from __future__ import annotations

from core.job import Job
from stages import mc
from stages.generate import _check_card
from stages.plan import _difficulty


def _emit_deck(activity_type: str, def_id: str, title: str, target: str, facts_list: list[dict],
               id_prefix: str, distractor_map: dict[str, list[str]], pool_backs: list[str], dur: int):
    """Espejo de module._make_deck: devuelve una Definición o None si no llega a ≥2 jugadas válidas."""
    if activity_type == "multiplechoice":
        questions: list[dict] = []
        for f in facts_list:
            qid = f"{id_prefix}.q{len(questions) + 1}"
            q = mc.build_question(qid, f, distractor_map.get(f["id"], []), pool_backs, target)
            if q and mc.check_question(q) is None:
                questions.append(q)
        if len(questions) < 2:
            return None
        return {"id": def_id, "typeId": "multiplechoice", "title": title, "target": target,
                "generatorId": "static", "params": {"questions": questions}, "mode": "untimed", "durationSec": dur}
    cards: list[dict] = []
    for f in facts_list:
        card = {"id": f"{id_prefix}.c{len(cards) + 1}", "front": f.get("front", ""), "back": f.get("back", ""), "skill": target}
        if _check_card(card) is None:
            cards.append(card)
    if len(cards) < 2:
        return None
    return {"id": def_id, "typeId": "flashcards", "title": title, "target": target,
            "generatorId": "static", "params": {"cards": cards}, "mode": "untimed", "durationSec": dur}


def run(job: Job, *, postas: list[dict], facts: list[dict], edad: int = 10, nivel: str = "medio",
        activity_type: str = "multiplechoice", lang: str = "es") -> dict:
    """postas: [{postaId, defId, target, title, idPrefix, factIds:[...]}]. facts: inventario del módulo
    [{id, front, back, statement}]. Devuelve {definitions:[{postaId, defId, target, title, definition|None, reason}]}."""
    fact_by_id = {f["id"]: f for f in facts}
    dur = _difficulty(edad, nivel)["durationSec"]
    pool_backs = mc.unique_backs(facts)

    distractor_map: dict[str, list[str]] = {}
    if activity_type == "multiplechoice":
        referenced: list[dict] = []
        seen: set[str] = set()
        for p in postas:
            for fid in p.get("factIds", []):
                f = fact_by_id.get(fid)
                if f and fid not in seen:
                    seen.add(fid)
                    referenced.append({"id": fid, "question": f.get("front", ""), "answer": f.get("back", ""), "statement": f.get("statement", "")})
        distractor_map = mc.generate_distractors(job, referenced, edad=edad, lang=lang)

    out: list[dict] = []
    for p in postas:
        pfacts = [fact_by_id[fid] for fid in p.get("factIds", []) if fid in fact_by_id]
        definition = _emit_deck(activity_type, p["defId"], p.get("title", ""), p["target"], pfacts,
                                p.get("idPrefix", p["defId"]), distractor_map, pool_backs, dur)
        out.append({"postaId": p.get("postaId"), "defId": p["defId"], "target": p["target"], "title": p.get("title", ""),
                    "definition": definition, "reason": None if definition else "menos de 2 preguntas/tarjetas válidas"})
    return {"definitions": out}
