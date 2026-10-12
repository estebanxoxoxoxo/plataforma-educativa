"""Generación de OPCIÓN MÚLTIPLE (Tipo multiplechoice de app/src/learn). Estrategia de
CALIDAD/GROUNDING: el enunciado y la respuesta CORRECTA salen de un fact YA verificado
(front/back con quote en extract) — sólo los DISTRACTORES los inventa el LLM (una llamada
por módulo). Si el LLM falla o da pocos, se rellena de forma determinista con otros `back`
del módulo → MC siempre jugable. Emite preguntas byte-compatibles con el portero del Tipo
(mode 'single', 1 correcta, opciones únicas). Ver memoria actividades-usables-y-audio."""
from __future__ import annotations
import json

from core.job import Job
from core import llm


def _stub_distractors(items: list[dict]) -> dict:
    """Sin API key (CI/stub): distractores deterministas = otras respuestas del lote."""
    out = []
    n = len(items)
    for idx, it in enumerate(items):
        ans = (it.get("answer") or "").strip().lower()
        ds: list[str] = []
        for j in range(1, max(2, n)):
            cand = (items[(idx + j) % n].get("answer") or "").strip()
            if cand and cand.lower() != ans and cand.lower() not in {d.lower() for d in ds}:
                ds.append(cand)
            if len(ds) >= 3:
                break
        out.append({"id": it["id"], "distractors": ds})
    return {"items": out}


def _prompt(items: list[dict], edad: int) -> str:
    payload = json.dumps(
        [{"id": it["id"], "pregunta": it["question"], "correcta": it["answer"], "contexto": it.get("statement", "")}
         for it in items],
        ensure_ascii=False,
    )
    return (
        f"Sos un generador de OPCIONES INCORRECTAS (distractores) para un juego de opción múltiple "
        f"para chicos de {edad} años.\n"
        "Te doy preguntas con su respuesta CORRECTA y un poco de contexto. Para CADA pregunta generá "
        "EXACTAMENTE 3 opciones INCORRECTAS que cumplan TODO esto:\n"
        "- CLARAMENTE incorrectas para esa pregunta (JAMÁS una opción que también sea correcta);\n"
        "- plausibles: del mismo tipo y largo parecido que la respuesta correcta (número->números, "
        "nombre->nombres), reflejando errores típicos de un chico;\n"
        "- en el MISMO idioma que la respuesta correcta;\n"
        "- cortas y simples, apropiadas para un chico; distintas entre sí y distintas de la correcta;\n"
        "- NADA de 'todas las anteriores', 'ninguna de las anteriores' ni 'no sé'.\n"
        'Devolvé SOLO un objeto JSON con esta forma exacta: '
        '{"items":[{"id":"<id>","distractors":["d1","d2","d3"]}]} con un item por pregunta y el MISMO id.\n\n'
        f"Preguntas:\n{payload}"
    )


def generate_distractors(job: Job, items: list[dict], *, edad: int = 10, lang: str = "es") -> dict[str, list[str]]:
    """items: [{id, question, answer, statement?}] -> {id: [distractores]}. Una sola llamada LLM.
    Robusto: ante error de red cae al stub determinista (no tumba el módulo)."""
    items = [it for it in items if (it.get("question") or "").strip() and (it.get("answer") or "").strip()]
    if not items:
        return {}
    stub = _stub_distractors(items)
    try:
        resp = llm.complete_json(job, "mc-distractors", _prompt(items, edad), stub=stub)
    except Exception:
        resp = stub  # fallback determinista: MC igual se genera con distractores de otros backs
    out: dict[str, list[str]] = {}
    for row in llm.unwrap(resp, "items"):
        rid = row.get("id") if isinstance(row, dict) else None
        ds = row.get("distractors") if isinstance(row, dict) else None
        if rid and isinstance(ds, list):
            out[rid] = [str(d).strip() for d in ds if str(d).strip()]
    return out


def build_question(qid: str, fact: dict, distractors: list[str], pool_backs: list[str], target: str) -> dict | None:
    """Arma UNA pregunta single-choice: correcta = fact.back (grounded); distractores del LLM,
    rellenados desde `pool_backs` (otros backs del módulo) hasta 3, deduplicados y != correcta.
    Devuelve None si no llega a ≥2 distractores (3 opciones) → no vale como MC."""
    correct = (fact.get("back") or "").strip()
    prompt = (fact.get("front") or "").strip()
    if not correct or not prompt:
        return None
    seen = {correct.lower()}
    picked: list[str] = []
    for d in list(distractors) + list(pool_backs):
        d = (d or "").strip()
        if not d or d.lower() in seen:
            continue
        seen.add(d.lower())
        picked.append(d)
        if len(picked) >= 3:
            break
    if len(picked) < 2:  # correcta + ≥2 distractores = ≥3 opciones
        return None
    options = [{"id": "o1", "text": correct, "correct": True}]
    for i, t in enumerate(picked, start=2):
        options.append({"id": f"o{i}", "text": t, "correct": False})
    return {"id": qid, "prompt": prompt, "mode": "single", "skill": target, "options": options}


def check_question(q: dict) -> str | None:
    """Portero espejo de validateContent (app) para UNA pregunta. Causa concreta o None."""
    if not q.get("id"):
        return "pregunta sin id"
    if not (q.get("prompt") or "").strip():
        return f"prompt vacío ({q.get('id')})"
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        return f"menos de 2 opciones ({q.get('id')})"
    oids: set[str] = set()
    texts: set[str] = set()
    for o in opts:
        if not o.get("id") or not (o.get("text") or "").strip() or not isinstance(o.get("correct"), bool):
            return f"opción malformada ({q.get('id')})"
        if o["id"] in oids:
            return f"id de opción repetido ({q.get('id')})"
        oids.add(o["id"])
        t = o["text"].strip().lower()
        if t in texts:
            return f"texto de opción repetido ({q.get('id')})"
        texts.add(t)
    n_correct = sum(1 for o in opts if o["correct"])
    if q.get("mode") == "single" and n_correct != 1:
        return f"single con {n_correct} correctas ({q.get('id')})"
    return None


def unique_backs(facts: list[dict]) -> list[str]:
    """Pool de respuestas del módulo para rellenar distractores (dedup, orden estable)."""
    seen: set[str] = set()
    out: list[str] = []
    for f in facts:
        b = (f.get("back") or "").strip()
        if b and b.lower() not in seen:
            seen.add(b.lower())
            out.append(b)
    return out
