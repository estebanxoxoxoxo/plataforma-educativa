"""Loader minimal de .env (stdlib, cero deps). Carga OPENAI_API_KEY y demás al entorno
si existe un .env en la raíz de route-lab. Una env var real siempre gana (setdefault)."""
from __future__ import annotations
import os
from pathlib import Path

_ENV = Path(__file__).resolve().parent.parent / ".env"


def load_env() -> None:
    if not _ENV.exists():
        return
    for raw in _ENV.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        if v:  # no pisar con vacío
            os.environ.setdefault(k.strip(), v)
