"""Etapa module — ensamblado POR MÓDULO. Una sola fuente → comprensión (check de
lectura: cards muestreadas across conceptos, gateada por umbral) + profundización (una
posta por concepto con ≥MIN_FACTS). Reusa el portero de generate, la difficulty de plan
y el blocklist de bundle. NO corre graph (toposort intra-módulo no aplica) ni plan (arma
ruta completa con recall/route_id de sources). Los targets salen del routeId/moduleId que
manda el creador (la app), no del slug del job.

El TIPO de actividad de las postas lo elige el creador (activityTypes): 'flashcards'
(autocalificado, repaso espaciado) o 'multiplechoice' (corregido objetivamente → mejor
gate de comprensión). El correcto de cada MC sale del fact verificado; los distractores,
del LLM (ver stages/mc.py). Ver RUTAS_GENERADAS.md / memoria modulos-de-ruta + actividades-usables-y-audio."""
from __future__ import annotations
from core.job import Job
from core import llm
from stages import mc
from stages.generate import _check_card
from stages.plan import _difficulty, MIN_FACTS
from stages.bundle import BLOCKLIST

EMOJI = "🪐"
# Tipos que el módulo sabe generar hoy; precedencia si el creador pide varios.
SUPPORTED_TYPES = ("multiplechoice", "flashcards")


def _comprehension_cap(edad: int, size: str) -> int:
    base = 4 if edad <= 9 else 6
    if size == "small":
        base -= 2
    elif size == "large":
        base += 2
    return max(2, base)


def _size_maxcards(edad: int, nivel: str, size: str) -> int:
    m = _difficulty(edad, nivel)["maxCards"]
    if size == "small":
        return max(2, m - 2)
    if size == "large":
        return m + 2
    return m


def _size_concept_cap(size: str) -> int:
    return {"small": 2, "large": 6}.get(size, 4)


def _best_score(fact: dict) -> float:
    return max((p.get("score", 0) for p in fact.get("provenance", [])), default=0)


def _fact_ok(f: dict) -> bool:
    """¿El fact rinde una jugada? (front/back no vacíos — mismo criterio que el portero de flashcards)."""
    return bool((f.get("front") or "").strip()) and bool((f.get("back") or "").strip())


def run(job: Job, route_id: str, module_id: str, edad: int = 10, nivel: str = "medio",
        *, activity_types: list[str] | None = None, size: str = "auto", lang: str = "es") -> dict:
    activity_types = activity_types or ["flashcards"]
    # tipo primario: multiplechoice gana si está (gate objetivo); si no, flashcards.
    prim = next((t for t in SUPPORTED_TYPES if t in activity_types), None)
    if prim is None:
        raise ValueError(
            f"v1 genera 'flashcards' o 'multiplechoice'; activityTypes {activity_types} no incluye ninguno"
        )
    skipped = [t for t in activity_types if t != prim]

    data = job.read_json("20-facts.json")
    facts = data["facts"]
    concepts = data["concepts"]
    if len(facts) < 2:
        raise ValueError(
            f"el artículo no rinde suficientes facts verificables ({len(facts)}) para un módulo (mín 2)"
        )

    # fuente real (una sola): título + url del front-matter del corpus
    doc_ids = job.corpus_ids()
    meta, _body = job.read_corpus(doc_ids[0]) if doc_ids else ({}, "")
    src_title = meta.get("title", "")
    src_url = meta.get("url", "")
    # referencia de contenido que consume la app: artículo (default) o video de YouTube.
    is_video = meta.get("source_kind") == "youtube-transcript"
    caption_kind = meta.get("caption_kind") if is_video else None
    src_ref = {"url": src_url, "title": src_title}
    if is_video:
        src_ref = {"url": src_url, "title": src_title, "kind": "video", "videoId": meta.get("video_id")}

    R, M = route_id, module_id
    dur = _difficulty(edad, nivel)["durationSec"]
    max_cards = _size_maxcards(edad, nivel, size)
    concept_cap = _size_concept_cap(size)

    facts_by_concept: dict[str, list] = {}
    for f in facts:
        facts_by_concept.setdefault(f["concept"], []).append(f)
    label = {c["id"]: c["label"] for c in concepts}
    # conceptos más ricos primero (estable: -fact_count, luego id)
    ordered = sorted(facts_by_concept.keys(), key=lambda c: (-len(facts_by_concept[c]), c))

    # ---- SELECCIÓN profundización: una posta por concepto con ≥ MIN_FACTS (cap de conceptos) ----
    prof_specs: list[dict] = []
    dropped: list[dict] = []
    for concept in ordered:
        fs = facts_by_concept[concept]
        if len(fs) < MIN_FACTS:
            dropped.append({"concept": concept, "reason": f"sólo {len(fs)} fact(s) < MIN_FACTS {MIN_FACTS} (no se estira)"})
            continue
        if len(prof_specs) >= concept_cap:
            dropped.append({"concept": concept, "reason": f"supera el cap de conceptos del módulo ({concept_cap})"})
            continue
        usable = [f for f in fs[:max_cards] if _fact_ok(f)]
        if len(usable) < 2:
            dropped.append({"concept": concept, "reason": f"quedó con {len(usable)} fact(s) usable(s) < 2"})
            continue
        prof_specs.append({"concept": concept, "target": f"{R}.t.{concept}",
                           "title": label.get(concept, concept), "facts": usable})

    # ---- SELECCIÓN comprensión: check de lectura, muestra transversal (1 fact por concepto) ----
    cap = _comprehension_cap(edad, size)
    check_target = f"{R}.m.{M}.check"
    check_facts: list[dict] = []
    used: set[str] = set()

    def _try(f: dict) -> bool:
        if _fact_ok(f) and f["id"] not in used:
            check_facts.append(f)
            used.add(f["id"])
            return True
        return False

    # pasada 1: 1 fact representativo (mayor score) por concepto
    for concept in ordered:
        if len(check_facts) >= cap:
            break
        for f in sorted(facts_by_concept[concept], key=lambda x: (-_best_score(x), x["id"])):
            if f["id"] in used:
                continue
            if _try(f):
                break
    # pasada 2 (piso duro ≥2): rellenar de cualquier fact restante
    if len(check_facts) < 2:
        for concept in ordered:
            for f in facts_by_concept[concept]:
                if len(check_facts) >= 2:
                    break
                if f["id"] not in used:
                    _try(f)
            if len(check_facts) >= 2:
                break
    if len(check_facts) < 2:
        raise ValueError("no se pudieron muestrear ≥2 preguntas de comprensión verificables del artículo")

    # ---- DISTRACTORES (una sola llamada LLM) si el tipo es multiplechoice ----
    distractor_map: dict[str, list[str]] = {}
    pool_backs: list[str] = []
    if prim == "multiplechoice":
        pool_backs = mc.unique_backs(facts)
        by_id: dict[str, dict] = {}
        for f in check_facts:
            by_id[f["id"]] = f
        for spec in prof_specs:
            for f in spec["facts"]:
                by_id[f["id"]] = f
        items = [{"id": fid, "question": f["front"], "answer": f["back"], "statement": f.get("statement", "")}
                 for fid, f in by_id.items()]
        distractor_map = mc.generate_distractors(job, items, edad=edad, lang=lang)

    # ---- EMISIÓN: un mazo (flashcards) o set de preguntas (multiplechoice) por posta ----
    def _make_deck(def_id: str, title: str, target: str, facts_list: list[dict], id_prefix: str):
        """Devuelve (definition, count) o None si no llega a ≥2 jugadas válidas."""
        if prim == "multiplechoice":
            questions: list[dict] = []
            for f in facts_list:
                qid = f"{id_prefix}.q{len(questions) + 1}"
                q = mc.build_question(qid, f, distractor_map.get(f["id"], []), pool_backs, target)
                if q and mc.check_question(q) is None:
                    questions.append(q)
            if len(questions) < 2:
                return None
            return {"id": def_id, "typeId": "multiplechoice", "title": title, "target": target,
                    "generatorId": "static", "params": {"questions": questions},
                    "mode": "untimed", "durationSec": dur}, len(questions)
        cards: list[dict] = []
        for f in facts_list:
            card = {"id": f"{id_prefix}.c{len(cards) + 1}", "front": f["front"], "back": f["back"], "skill": target}
            if _check_card(card) is None:
                cards.append(card)
        if len(cards) < 2:
            return None
        return {"id": def_id, "typeId": "flashcards", "title": title, "target": target,
                "generatorId": "static", "params": {"cards": cards},
                "mode": "untimed", "durationSec": dur}, len(cards)

    # profundización
    prof: list[dict] = []
    emitted_concepts: set[str] = set()
    for spec in prof_specs:
        concept, target, title = spec["concept"], spec["target"], spec["title"]
        made = _make_deck(f"{R}.{M}.d.{concept}", title, target, spec["facts"], f"{M}.{concept}")
        if made is None:
            dropped.append({"concept": concept, "reason": "no rindió ≥2 jugadas válidas del tipo pedido"})
            continue
        definition, _n = made
        emitted_concepts.add(concept)
        prof.append({
            "posta": {"id": f"{M}.t.{concept}", "title": title, "kind": "activity",
                      "definitionId": definition["id"], "target": target, "moduleId": M},
            "definition": definition,
        })

    # comprensión
    check_def_id = f"{R}.{M}.d.check"
    made = _make_deck(check_def_id, "Comprensión de la lectura", check_target, check_facts, f"{M}.check")
    if made is None:
        raise ValueError("no se pudieron armar ≥2 preguntas de comprensión válidas del tipo pedido")
    comp_def, n_check = made
    comprehension = {
        "posta": {"id": f"{M}.check", "title": "Comprensión de la lectura", "kind": "activity",
                  "definitionId": check_def_id, "target": check_target, "moduleId": M,
                  "reading": src_ref, "passThreshold": 0.7},
        "definition": comp_def,
    }

    # ---- INVENTARIO: TODO lo extraído + por qué entró o no, para que el editor cure (nada se pierde en silencio) ----
    used_ids: set[str] = {f["id"] for f in check_facts}
    for spec in prof_specs:
        if spec["concept"] in emitted_concepts:
            used_ids.update(f["id"] for f in spec["facts"])
    drop_reason_by_concept: dict[str, str] = {}
    for d in dropped:
        drop_reason_by_concept.setdefault(d["concept"], d["reason"])

    def _fact_drop_reason(f: dict) -> str | None:
        if f["id"] in used_ids:
            return None
        if not _fact_ok(f):
            return "sin pregunta/respuesta válida (front o back vacío)"
        return drop_reason_by_concept.get(f["concept"]) or "no entró en la selección automática del módulo"

    inv_facts = [{
        "id": f["id"], "concept": f["concept"], "conceptLabel": label.get(f["concept"], f["concept"]),
        "kind": f.get("kind", ""), "statement": f.get("statement", ""),
        "front": f.get("front", ""), "back": f.get("back", ""),
        "quote": f.get("quote", ""), "quoteScore": round(_best_score(f), 3),
        "corroborated": len(f.get("provenance", [])) > 1,
        "selected": f["id"] in used_ids, "dropReason": _fact_drop_reason(f),
    } for f in facts]
    inv_concepts = [{
        "id": c["id"], "label": c["label"],
        "factCount": c.get("fact_count", len(facts_by_concept.get(c["id"], []))),
        "corroborated": bool(c.get("multi_source")),
        "proposedAsPosta": c["id"] in emitted_concepts,
        "dropReason": None if c["id"] in emitted_concepts else drop_reason_by_concept.get(c["id"]),
    } for c in concepts]
    inventory = {
        "concepts": inv_concepts, "facts": inv_facts,
        "integrityDropped": [  # facts cuyo quote NO verificó en la fuente (anti-alucinación): se muestran, no se rescatan
            {"id": d.get("id"), "reason": d.get("reason", ""), "quote": d.get("quote", "")}
            for d in data.get("dropped", [])
        ],
    }

    module = {"id": M, "title": src_title, "emoji": EMOJI, "source": src_ref}

    # ---- moderación (mismo stub de blocklist que bundle; fail-closed → gate humano) ----
    def _texts_of(definition: dict):
        params = definition.get("params", {})
        for c in params.get("cards", []):
            yield c.get("front", "")
            yield c.get("back", "")
        for q in params.get("questions", []):
            yield q.get("prompt", "")
            for o in q.get("options", []):
                yield o.get("text", "")

    def _visible():
        yield module["title"]
        yield comprehension["posta"]["title"]
        yield from _texts_of(comprehension["definition"])
        for item in prof:
            yield item["posta"]["title"]
            yield from _texts_of(item["definition"])

    flagged = []
    for s in _visible():
        low = (s or "").lower()
        hit = next((w for w in BLOCKLIST if w in low), None)
        if hit:
            flagged.append({"text": s, "word": hit})
    review = {
        "moderation": {"method": "blocklist-stub", "items_checked": sum(1 for _ in _visible()), "flagged": len(flagged)},
        "finalApprovedAt": None,
        "note": "moderación real (juez LLM) sin cablear en la PoC; esto es solo lista negra",
    }

    out = {
        "module": module,
        "comprehension": comprehension,
        "profundizacion": prof,
        "inventory": inventory,
        "review": review,
        "meta": {
            "origin": "route-lab@poc", "jobId": job.id, "source": src_title,
            "routeId": R, "moduleId": M, "learner": {"edad": edad, "nivel": nivel}, "size": size,
            "activityType": prim, "skippedActivityTypes": skipped, "droppedConcepts": dropped,
            "factsExtracted": len(facts), "factsUsed": len(used_ids), "conceptsFound": len(concepts),
            "sourceKind": meta.get("source_kind", "wikipedia"), "captionKind": caption_kind,
            "truncated": meta.get("truncated"),
            "llm": "real" if llm.have_key() else "stub",
        },
    }
    job.write_json("70-module.json", out)
    job.stamp("module", {
        "activityType": prim,
        "comprehension_items": n_check, "profundizacion_postas": len(prof),
        "dropped": len(dropped), "flagged": len(flagged),
    })
    return out
