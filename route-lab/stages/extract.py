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

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
QUOTE_THRESHOLD = 0.85


def _norm_stmt(s: str) -> str:
    return re.sub(r"[^\wáéíóúñ ]+", "", s.lower()).strip()


def run(job: Job) -> dict:
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
                                lang_original=meta.get("lang", "es"))
        # pase A: en real, el LLM emite estos facts; en stub salen del fixture
        resp = llm.complete_json(job, f"extract.paseA.{doc_id}", prompt, stub=facts_by_doc.get(full_doc_id, []))
        raw_facts = llm.unwrap(resp, "facts")
        for f in raw_facts:
            ok, score = quote_ok(f["quote"], body, QUOTE_THRESHOLD)
            if not ok:
                dropped.append({"id": f["id"], "reason": f"quote no verificable en el corpus (score {score} < {QUOTE_THRESHOLD})", "quote": f["quote"]})
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
                   source_kind: str = "wikipedia", lang_original: str = "es") -> str:
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
