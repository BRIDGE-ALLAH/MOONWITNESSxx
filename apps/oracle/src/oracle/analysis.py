"""Deterministic, bounded first-stage analysis tasks."""

from __future__ import annotations

import re
import statistics
from typing import Any

from .schemas import StatisticsInput, TextProfileInput

METHODS: dict[str, tuple[str, str, list[str]]] = {
    "statistics.describe": (
        "oracle.statistics.describe",
        "1.0.0",
        ["Describes the supplied numeric sample only; it does not infer causality."],
    ),
    "text.profile": (
        "oracle.text.profile",
        "1.0.0",
        [
            "Token and sentence counts use deterministic lexical heuristics.",
            "This task is not named-entity recognition, semantic analysis, or translation.",
        ],
    ),
}


def run_analysis(task_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if task_type == "statistics.describe":
        return describe_statistics(StatisticsInput.model_validate(payload))
    if task_type == "text.profile":
        return profile_text(TextProfileInput.model_validate(payload))
    raise ValueError("Unsupported task type")


def describe_statistics(payload: StatisticsInput) -> dict[str, Any]:
    values = payload.values
    return {
        "label": payload.label,
        "count": len(values),
        "minimum": min(values),
        "maximum": max(values),
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "population_variance": statistics.pvariance(values),
        "population_standard_deviation": statistics.pstdev(values),
    }


def profile_text(payload: TextProfileInput) -> dict[str, Any]:
    normalized = payload.text.casefold()
    words = re.findall(r"\b[\w']+\b", normalized, flags=re.UNICODE)
    sentences = re.findall(r"[.!?](?:\s|$)", payload.text)
    unique_words = len(set(words))
    average_word_length = round(sum(len(word) for word in words) / len(words), 4) if words else 0.0
    return {
        "language_hint": payload.language_hint,
        "character_count": len(payload.text),
        "line_count": len(payload.text.splitlines()) or 1,
        "word_count": len(words),
        "unique_word_count": unique_words,
        "sentence_count_heuristic": len(sentences),
        "average_word_length": average_word_length,
    }
