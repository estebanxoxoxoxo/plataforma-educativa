"""Etapa 2 — extract. Pase A (facts por doc, LLM/stub) + checker fuzzy de quotes
(anti-alucinación, real) + pase B (MERGE cross-fuente, determinista). El merge es lo
que enciende la 2da fuente: un concepto en ambos docs colapsa en uno canónico."""
from __future__ import annotations
import json
import re
from pathlib import Path

from core.job import Job
from core import llm
from core.fuzzy import quote_ok
from core.lang import is_en, pick

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
QUOTE_THRESHOLD = 0.85


def _norm_stmt(s: str) -> str:
    return re.sub(r"[^\wáéíóúñ ]+", "", s.lower()).strip()


def _request_lang(job: Job) -> str:
    """Idioma del request persistido (CLI corre etapas sueltas); default 'es'."""
    try:
        if job.exists("00-request.json"):
            return job.read_json("00-request.json").get("lang") or "es"
    except Exception:
        pass
    return "es"


def run(job: Job, lang: str | None = None) -> dict:
    # idioma de SALIDA de los facts (el de la ruta). None → el del 00-request.json (o 'es').
    lang = lang or _request_lang(job)
    # fixture opcional: sólo se usa como stub cuando NO hay OPENAI_API_KEY
    fpath = FIXTURES / f"{job.id}.json"
    fixture = json.loads(fpath.read_text(encoding="utf-8")) if fpath.exists() else {}
    facts_by_doc = fixture.get("facts_by_doc", {})

    doc_ids = job.corpus_ids()  # ['jupiter-planeta', 'sistema-solar']
    kept: list[dict] = []
    dropped: list[dict] = []
    # vocabulario de conceptos ACUMULADO cross-doc: se pasa a los docs posteriores para que
    # REUSEN slugs cuando el concepto es el mismo → el merge cross-fuente (pase B) dispara.
    known: dict[str, str] = {}
    # los facts vienen numerados f1..fN POR DOC/CHUNK (el LLM reinicia en f1 cada chunk) → colisionan
    # cross-chunk; los hacemos ÚNICOS globalmente (si no, se pisan React keys, distractores MC, auditoría).
    seen_ids: set[str] = set()

    for doc_id in doc_ids:
        meta, body = job.read_corpus(doc_id)
        full_doc_id = meta.get("id", f"doc-{doc_id}")
        prompt = _pase_a_prompt(meta.get("title", doc_id), body, known,
                                source_kind=meta.get("source_kind", "wikipedia"),
                                lang_original=meta.get("lang", "es"), lang=lang)
        # pase A: en real, el LLM emite estos facts; en stub salen del fixture
        resp = llm.complete_json(job, f"extract.paseA.{doc_id}", prompt, stub=facts_by_doc.get(full_doc_id, []))
        raw_facts = llm.unwrap(resp, "facts")
        for f in raw_facts:
            ok, score = quote_ok(f["quote"], body, QUOTE_THRESHOLD)
            if not ok:
                # el motivo viaja al cliente (inventory.integrityDropped → panel de curaduría) → en el idioma de la ruta
                reason = pick(lang, f"quote no verificable en el corpus (score {score} < {QUOTE_THRESHOLD})",
                              f"quote not verifiable in the source (score {score} < {QUOTE_THRESHOLD})")
                dropped.append({"id": f["id"], "reason": reason, "quote": f["quote"]})
                continue
            fid = f["id"]
            if fid in seen_ids:  # colisión cross-chunk → prefijar por doc para unicidad global
                base = f"{full_doc_id}:{fid}"
                fid = base
                k = 1
                while fid in seen_ids:
                    k += 1
                    fid = f"{base}-{k}"
            seen_ids.add(fid)
            kept.append({
                **f,
                "id": fid,
                "provenance": [{"doc": full_doc_id, "section": f.get("section"), "quote": f["quote"], "score": score}],
            })
            known.setdefault(f["concept"], f.get("concept_label", f["concept"]))

    # ---- pase B: MERGE cross-fuente ----
    # 1) conceptos canónicos: mismo slug en docs distintos → uno solo (provenance múltiple)
    concepts: dict[str, dict] = {}
    for f in kept:
        c = concepts.setdefault(f["concept"], {"id": f["concept"], "label": f["concept_label"], "docs": set(), "fact_ids": []})
        c["docs"].update(p["doc"] for p in f["provenance"])
        c["fact_ids"].append(f["id"])

    # 2) dedup de facts por statement normalizado (consolida provenance)
    by_stmt: dict[str, dict] = {}
    fact_dups = 0
    for f in kept:
        k = _norm_stmt(f["statement"])
        if k in by_stmt:
            by_stmt[k]["provenance"].extend(f["provenance"])
            fact_dups += 1
        else:
            by_stmt[k] = f
    facts = list(by_stmt.values())

    concept_list = [
        {"id": c["id"], "label": c["label"], "docs": sorted(c["docs"]), "multi_source": len(c["docs"]) > 1, "fact_count": len(c["fact_ids"])}
        for c in concepts.values()
    ]
    merged_concepts = [c for c in concept_list if c["multi_source"]]

    out = {"concepts": concept_list, "facts": facts, "dropped": dropped}
    job.write_json("20-facts.json", out)
    summary = {
        "docs": len(doc_ids),
        "facts_kept": len(facts),
        "facts_dropped": len(dropped),
        "fact_dups_merged": fact_dups,
        "concepts": len(concept_list),
        "concepts_merged_cross_source": [c["id"] for c in merged_concepts],
        "llm": "real" if llm.have_key() else "stub",
    }
    job.stamp("extract", summary)
    return summary


def _pase_a_prompt(title: str, body: str, known: dict[str, str],
                   source_kind: str = "wikipedia", lang_original: str = "es", lang: str = "es") -> str:
    """`lang` = idioma de SALIDA (el de la ruta); `lang_original` = el de la fuente (para el quote).
    En 'es' (default) el prompt es byte-idéntico al histórico; en 'en' sale el prompt inglés."""
    if is_en(lang):
        return _pase_a_prompt_en(title, body, known, source_kind=source_kind, lang_original=lang_original)
    vocab = ""
    if known:
        listado = "\n".join(f"- {slug}: {label}" for slug, label in known.items())
        vocab = (
            "\n\nCONCEPTOS YA IDENTIFICADOS en fuentes anteriores. Reusá EXACTAMENTE estos `concept` slugs "
            "cuando el fact trate del mismo concepto (así se consolidan cross-fuente); creá uno nuevo SOLO si "
            f"de verdad no encaja en ninguno:\n{listado}"
        )
    # Fuente = transcript hablado de YouTube: es más ruidoso que un artículo.
    spoken = ""
    if source_kind == "youtube-transcript":
        spoken = (
            "\n\nOJO: la fuente es un TRANSCRIPT DE VIDEO (habla, no artículo). Puede tener relleno "
            "(«eh», «bueno»), repeticiones, frases cortadas, avisos de sponsor / «suscribite», y errores "
            "de transcripción automática. IGNORÁ todo eso: extraé SOLO facts claros, correctos y "
            "autocontenidos que estén BIEN sostenidos por el texto. Ante la duda, no lo incluyas."
        )
    # Fuente en otro idioma: la salida va en español, pero el quote queda literal del original.
    lang_note = ""
    base = (lang_original or "es").split("-")[0]
    if base != "es":
        lang_note = (
            f"\n\nLA FUENTE ESTÁ EN «{lang_original}» (no español). Escribí `concept_label`, `statement`, "
            "`front` y `back` EN ESPAÑOL (para chicos), pero el `quote` DEBE ser una cita LITERAL del texto "
            f"original en «{lang_original}» (así se puede verificar contra la fuente)."
        )
    return (
        "Sos un extractor de FACTS atómicos para material educativo de chicos 8-12, en español.\n"
        f"Documento: «{title}».\n\n"
        "Agrupá el material en POCOS conceptos AMPLIOS (idealmente 3-6 para este documento); cada concepto debe "
        "reunir VARIOS facts (apuntá a 3 o más). NO hagas un concepto por fact ni conceptos ultra-específicos: "
        "el objetivo es que cada concepto dé para una actividad de repaso.\n"
        "Devolvé JSON {facts:[{id, concept (slug corto en kebab-case), concept_label, kind (definition|property|numeric|relation), "
        "statement (una afirmación simple), front (pregunta), back (respuesta corta), section, quote (TEXTUAL del documento)}]}.\n"
        "REGLA DURA: cada `quote` debe ser una cita LITERAL del texto (se valida). Un fact sin cita literal se descarta."
        + spoken
        + lang_note
        + vocab
        + f"\n\nTEXTO:\n{body[:8000]}"
    )


def _pase_a_prompt_en(title: str, body: str, known: dict[str, str],
                      source_kind: str = "wikipedia", lang_original: str = "en") -> str:
    """Pase A con SALIDA EN INGLÉS (ruta en 'en'). Misma estructura/contrato JSON que el castellano;
    el `quote` siempre queda literal en el idioma ORIGINAL de la fuente (no se traduce: se valida)."""
    vocab = ""
    if known:
        listado = "\n".join(f"- {slug}: {label}" for slug, label in known.items())
        vocab = (
            "\n\nCONCEPTS ALREADY IDENTIFIED in earlier sources. Reuse EXACTLY these `concept` slugs "
            "when a fact is about the same concept (that is how they merge across sources); create a new one ONLY if "
            f"it truly doesn't fit any of them:\n{listado}"
        )
    spoken = ""
    if source_kind == "youtube-transcript":
        spoken = (
            "\n\nHEADS UP: the source is a VIDEO TRANSCRIPT (speech, not an article). It may contain filler "
            "(\"uh\", \"so\"), repetitions, cut-off sentences, sponsor plugs / \"subscribe\" messages, and automatic "
            "transcription errors. IGNORE all of that: extract ONLY clear, correct, self-contained facts that are "
            "WELL supported by the text. When in doubt, leave it out."
        )
    base = (lang_original or "en").split("-")[0]
    lang_note = ""
    if base != "en":
        lang_note = (
            f"\n\nTHE SOURCE IS IN «{lang_original}» (not English). Still write `concept_label`, `statement`, "
            "`front` and `back` IN ENGLISH, but the `quote` MUST be a LITERAL quote of the original text in "
            f"«{lang_original}» — do NOT translate it (it is checked against the source)."
        )
    return (
        "You are an extractor of atomic FACTS for educational material for kids around 13, in English.\n"
        f"Document: «{title}».\n\n"
        "LANGUAGE: write `concept_label`, `statement`, `front` and `back` in US English, with a warm, simple tone "
        "a 13-year-old can follow. The `quote` stays in the ORIGINAL language of the document, copied literally "
        "(never translated).\n\n"
        "Group the material into a FEW BROAD concepts (ideally 3-6 for this document); each concept should "
        "gather SEVERAL facts (aim for 3 or more). Do NOT make one concept per fact or ultra-specific concepts: "
        "the goal is that each concept is enough for a review activity.\n"
        "Return JSON {facts:[{id, concept (short kebab-case slug), concept_label, kind (definition|property|numeric|relation), "
        "statement (one simple claim), front (question), back (short answer), section, quote (VERBATIM from the document)}]}.\n"
        "HARD RULE: every `quote` must be a LITERAL quote of the text (it is validated). A fact without a literal quote is discarded."
        + spoken
        + lang_note
        + vocab
        + f"\n\nTEXT:\n{body[:8000]}"
    )
