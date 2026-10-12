"""Seam del LLM. Contrato estable; implementación intercambiable. Con OPENAI_API_KEY
hace un POST HTTP crudo a la Responses/Chat API (sin SDK = cero comportamiento oculto).
Sin key corre en modo STUB devolviendo el valor canned que la etapa cargó del fixture.
El prompt resuelto SIEMPRE se guarda en el job (auditoría), corra real o stub."""
from __future__ import annotations
import json
import os
import urllib.request

from .job import Job

MODEL_DEFAULT = os.environ.get("ROUTELAB_MODEL", "gpt-5.4-mini")


def have_key() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def unwrap(resp, key: str) -> list:
    """OpenAI en json_object mode devuelve un objeto {key: [...]}; los stubs devuelven
    la lista pelada. Normaliza ambos a lista."""
    if isinstance(resp, dict):
        return resp.get(key, [])
    return resp or []


def complete_json(job: Job, prompt_id: str, prompt: str, *, stub, model: str = MODEL_DEFAULT):
    """Devuelve un dict/list parseado de la respuesta del LLM. En stub devuelve `stub`."""
    job.save_prompt(prompt_id, prompt)
    if not have_key():
        return stub
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = json.loads(resp.read())
    return json.loads(payload["choices"][0]["message"]["content"])
