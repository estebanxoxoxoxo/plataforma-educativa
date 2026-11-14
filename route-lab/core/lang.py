"""Idioma del CONTENIDO generado. La app manda `lang: 'es' | 'en'` por request; todo lo
que viaja al cliente como parte del módulo (prompts → facts/distractores, títulos, motivos de
descarte) sale en ese idioma. Castellano = default: cualquier valor que no sea inglés (o
ausente) cae a 'es', y los textos castellanos quedan byte-idénticos a los de antes."""
from __future__ import annotations


def is_en(lang: str | None) -> bool:
    return (lang or "es").split("-")[0].strip().lower() == "en"


def pick(lang: str | None, es: str, en: str) -> str:
    """Elige el texto según idioma (es por default)."""
    return en if is_en(lang) else es
