"""Etapa 1 — ingest. Títulos de Wikipedia → corpus canónico (un .md por fuente,
front-matter YAML, secciones ancladas para provenance). REAL: pega a la action API
de Wikipedia (plaintext + links para la señal RefD). Cero LLM."""
from __future__ import annotations
import json
import re
import time
import urllib.parse
import urllib.request

from core.job import Job

WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
UA = "route-lab/0.1 (Smarty PoC; educational)"

# secciones que no aportan facts (se descartan)
SKIP = {
    "véase también", "referencias", "enlaces externos", "notas", "bibliografía",
    "notas y referencias", "galería", "fuentes",
}
MAX_SECTIONS = 8
MAX_SECTION_CHARS = 1600


def slugify(title: str) -> str:
    s = title.lower()
    s = s.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def _get(lang: str, title: str) -> dict:
    params = {
        "action": "query", "format": "json", "redirects": 1,
        "prop": "extracts|links", "explaintext": 1, "exsectionformat": "wiki",
        "pllimit": "max", "plnamespace": 0, "titles": title,
    }
    url = WIKI_API.format(lang=lang) + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    pages = data["query"]["pages"]
    page = next(iter(pages.values()))
    if "extract" not in page:
        raise RuntimeError(f"Wikipedia no devolvió texto para '{title}' (¿título inexistente?)")
    return page


def _parse_sections(extract: str) -> list[dict]:
    # intro = todo antes del primer '== H =='; luego cada '== H =='
    parts = re.split(r"^==\s*([^=].*?)\s*==\s*$", extract, flags=re.MULTILINE)
    sections = [{"heading": "Introducción", "text": parts[0].strip()}]
    for i in range(1, len(parts), 2):
        heading = parts[i].strip()
        text = parts[i + 1] if i + 1 < len(parts) else ""
        # colapsar subsecciones '=== ... ===' a texto plano
        text = re.sub(r"^===+\s*(.*?)\s*===+\s*$", r"\1:", text, flags=re.MULTILINE)
        sections.append({"heading": heading, "text": text.strip()})
    out = []
    for s in sections:
        if s["heading"].lower() in SKIP or not s["text"]:
            continue
        s["text"] = s["text"][:MAX_SECTION_CHARS]
        out.append(s)
        if len(out) >= MAX_SECTIONS:
            break
    return out


def run(job: Job, sources: list[str], lang: str = "es") -> dict:
    """Cada source es un título de Wikipedia O un link de YouTube. Un video se chunkea en
    varios corpus (el merge cross-doc de extract los consolida como una sola fuente)."""
    docs = []
    for source in sources:
        if _yt_video_id(source):
            docs.extend(_ingest_youtube(job, source, lang))
        else:
            docs.append(_ingest_wikipedia(job, source, lang))
    job.stamp("ingest", {"docs": docs, "sources": sources})
    return {"docs": docs}


def _ingest_wikipedia(job: Job, title: str, lang: str) -> dict:
    page = _get(lang, title)
    real_title = page.get("title", title)
    doc_id = slugify(real_title)
    sections = _parse_sections(page["extract"])
    wiki_links = sorted({l["title"].lower() for l in page.get("links", [])})[:200]
    body = "\n\n".join(
        f"## {s['heading']} {{#s{i}}}\n{s['text']}" for i, s in enumerate(sections)
    )
    meta = {
        "id": f"doc-{doc_id}",
        "source_kind": "wikipedia",
        "title": real_title,
        "url": f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(real_title.replace(' ', '_'))}",
        "lang": lang,
        "sections": len(sections),
        "wiki_links": len(wiki_links),
        "retrieved_at": int(time.time()),
    }
    job.write_corpus(doc_id, meta, body)
    job.write_json(f"10-corpus/{doc_id}.links.json", wiki_links)
    time.sleep(0.3)  # cortesía con la API
    return {"doc_id": doc_id, "title": real_title, "sections": len(sections), "chars": len(body)}


# ---------- YouTube (transcript) ----------
MAX_TRANSCRIPT_CHARS = 6000   # por chunk, ≤ ventana del prompt de extract (8000)
MAX_TRANSCRIPT_CHUNKS = 8     # cap para videos largos (cubre el principio; marca truncated)


def _yt_video_id(source: str) -> str | None:
    """videoId de una URL de YouTube (watch/youtu.be/shorts/embed), o None si no es YouTube."""
    try:
        u = urllib.parse.urlparse(source if "://" in source else "https://" + source)
    except ValueError:
        return None
    host = (u.hostname or "").replace("www.", "").replace("m.", "")
    if host == "youtu.be":
        return u.path.lstrip("/").split("/")[0] or None
    if host not in ("youtube.com", "youtube-nocookie.com"):
        return None
    qs = urllib.parse.parse_qs(u.query)
    if "v" in qs:
        return qs["v"][0]
    parts = u.path.split("/")
    if len(parts) >= 3 and parts[1] in ("shorts", "embed"):
        return parts[2]
    return None


def _yt_title(video_id: str) -> str | None:
    """Título del video vía noembed (sin API key, igual que la app)."""
    try:
        url = "https://noembed.com/embed?url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get("title")
    except Exception:
        return None


def _yt_transcript(video_id: str) -> tuple[str, str, str]:
    """Devuelve (texto, lang_original, caption_kind). Idioma ORIGINAL = el de la pista auto
    (el ASR se genera del audio); se prefiere la MANUAL en ese idioma, si no la auto."""
    from youtube_transcript_api import YouTubeTranscriptApi  # dep opcional, solo para video
    api = YouTubeTranscriptApi()
    try:
        tracks = list(api.list(video_id))
    except Exception as e:
        raise ValueError(f"no pude leer subtítulos del video ({type(e).__name__}): puede no tenerlos, ser privado o estar bloqueado")
    if not tracks:
        raise ValueError("el video no tiene subtítulos disponibles")
    asr = [t for t in tracks if t.is_generated]
    orig_lang = (asr[0].language_code if asr else tracks[0].language_code)
    base = orig_lang.split("-")[0]
    manual_orig = [t for t in tracks if not t.is_generated and t.language_code.split("-")[0] == base]
    if manual_orig:
        chosen, caption_kind = manual_orig[0], "manual"
    elif asr:
        chosen, caption_kind = asr[0], "asr"
    else:
        chosen, caption_kind = tracks[0], "manual"
    fetched = chosen.fetch()
    parts = []
    for s in fetched:
        t = (s.text or "").replace("\n", " ").strip()
        if t and not t.startswith("["):  # descarta cues tipo [Música]/[Aplausos]
            parts.append(t)
    text = re.sub(r"\s+", " ", " ".join(parts)).strip()
    if len(text) < 200:
        raise ValueError("el transcript del video es demasiado corto para generar un módulo")
    return text, chosen.language_code, caption_kind


def _chunk_text(text: str, size: int, max_chunks: int) -> tuple[list[str], bool]:
    chunks: list[str] = []
    i = 0
    while i < len(text) and len(chunks) < max_chunks:
        end = min(i + size, len(text))
        if end < len(text):
            sp = text.rfind(" ", i, end)  # no cortar palabra
            if sp > i:
                end = sp
        chunks.append(text[i:end].strip())
        i = end
    return chunks, i < len(text)


def _ingest_youtube(job: Job, url: str, lang: str) -> list[dict]:
    video_id = _yt_video_id(url)
    if not video_id:
        raise ValueError(f"no pude extraer el video de la URL: {url}")
    text, orig_lang, caption_kind = _yt_transcript(video_id)
    title = _yt_title(video_id) or f"Video {video_id}"
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    chunks, truncated = _chunk_text(text, MAX_TRANSCRIPT_CHARS, MAX_TRANSCRIPT_CHUNKS)
    docs = []
    for i, chunk in enumerate(chunks):
        doc_id = f"video-{video_id}-c{i}"
        meta = {
            "id": f"doc-{doc_id}",
            "source_kind": "youtube-transcript",
            "title": title,
            "url": watch_url,
            "lang": orig_lang,
            "video_id": video_id,
            "caption_kind": caption_kind,
            "part": i,
            "truncated": truncated,
            "retrieved_at": int(time.time()),
        }
        body = f"## {title} (parte {i + 1}) {{#s0}}\n{chunk}"
        job.write_corpus(doc_id, meta, body)
        docs.append({"doc_id": doc_id, "title": title, "chars": len(chunk), "caption_kind": caption_kind, "part": i})
    return docs
