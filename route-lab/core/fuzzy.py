"""Checker determinista de quotes: ¿la cita del LLM está REALMENTE en el corpus?
Es el control anti-alucinación (un fact sin quote verificable se descarta). Usa
rapidfuzz si está; si no, difflib (stdlib) — mismo contrato."""
from __future__ import annotations
import re
from difflib import SequenceMatcher

try:
    from rapidfuzz import fuzz as _rf  # type: ignore
    _HAVE_RF = True
except Exception:  # pragma: no cover - fallback stdlib
    _HAVE_RF = False


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def quote_score(quote: str, text: str) -> float:
    """Similitud [0,1] de la mejor coincidencia parcial de `quote` dentro de `text`."""
    q, t = _norm(quote), _norm(text)
    if not q:
        return 0.0
    if q in t:
        return 1.0
    if _HAVE_RF:
        return _rf.partial_ratio(q, t) / 100.0
    # fallback stdlib: mejor ventana del tamaño de la quote
    best = 0.0
    step = max(1, len(q) // 2)
    for i in range(0, max(1, len(t) - len(q) + 1), step):
        window = t[i : i + len(q) + 10]
        best = max(best, SequenceMatcher(None, q, window).ratio())
        if best >= 0.99:
            break
    return best


def quote_ok(quote: str, text: str, threshold: float = 0.85) -> tuple[bool, float]:
    s = quote_score(quote, text)
    return s >= threshold, round(s, 3)
