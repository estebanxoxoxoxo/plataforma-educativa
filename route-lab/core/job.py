"""Job = carpeta de artefactos. Cada etapa lee/escribe archivos por su ruta relativa;
el estado del run vive en manifest.json. Front-matter YAML de subconjunto plano
(escrito y leído a mano → cero dependencias)."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "jobs"


class Job:
    def __init__(self, job_id: str):
        self.id = job_id
        self.dir = JOBS / job_id
        self.dir.mkdir(parents=True, exist_ok=True)

    # ---- artefactos JSON ----
    def write_json(self, rel: str, data) -> Path:
        p = self.dir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return p

    def read_json(self, rel: str):
        return json.loads((self.dir / rel).read_text(encoding="utf-8"))

    def exists(self, rel: str) -> bool:
        return (self.dir / rel).exists()

    # ---- corpus (markdown + front-matter YAML plano) ----
    def write_corpus(self, doc_id: str, meta: dict, body_md: str) -> Path:
        p = self.dir / "10-corpus" / f"{doc_id}.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        fm = "\n".join(f"{k}: {_yaml_scalar(v)}" for k, v in meta.items())
        p.write_text(f"---\n{fm}\n---\n\n{body_md}\n", encoding="utf-8")
        return p

    def read_corpus(self, doc_id: str) -> tuple[dict, str]:
        raw = (self.dir / "10-corpus" / f"{doc_id}.md").read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.DOTALL)
        if not m:
            return {}, raw
        meta = {}
        for line in m.group(1).splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        return meta, m.group(2).strip()

    def corpus_ids(self) -> list[str]:
        d = self.dir / "10-corpus"
        return sorted(p.stem for p in d.glob("*.md")) if d.exists() else []

    # ---- prompts resueltos (auditoría / iterabilidad) ----
    def save_prompt(self, name: str, text: str) -> None:
        p = self.dir / "prompts" / f"{name}.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    # ---- manifest (estado + costos) ----
    def stamp(self, stage: str, info: dict) -> None:
        man = self.read_json("manifest.json") if self.exists("manifest.json") else {"jobId": self.id, "stages": {}}
        man["stages"][stage] = info
        self.write_json("manifest.json", man)


def _yaml_scalar(v) -> str:
    if isinstance(v, list):
        return "[" + ", ".join(str(x) for x in v) + "]"
    return str(v)


def section_anchors(body_md: str) -> list[dict]:
    """Parsea el cuerpo en secciones `## Titulo {#sN}` → [{anchor, heading, text}]."""
    out = []
    cur = None
    for line in body_md.splitlines():
        h = re.match(r"^##\s+(.*?)\s*\{#(s\d+)\}\s*$", line)
        if h:
            if cur:
                out.append(cur)
            cur = {"anchor": h.group(2), "heading": h.group(1), "text": ""}
        elif cur is not None:
            cur["text"] += line + "\n"
    if cur:
        out.append(cur)
    for s in out:
        s["text"] = s["text"].strip()
    return out
