from __future__ import annotations

import math

from oracle.analysis import describe_statistics, profile_text
from oracle.schemas import StatisticsInput, TextProfileInput


def test_statistics_description_is_deterministic() -> None:
    result = describe_statistics(StatisticsInput(values=[1, 2, 3, 4]))

    assert result["count"] == 4
    assert result["minimum"] == 1
    assert result["maximum"] == 4
    assert result["mean"] == 2.5
    assert result["median"] == 2.5
    assert result["population_variance"] == 1.25
    assert math.isclose(result["population_standard_deviation"], math.sqrt(1.25))


def test_statistics_single_value_has_zero_population_spread() -> None:
    result = describe_statistics(StatisticsInput(values=[9]))

    assert result["population_variance"] == 0
    assert result["population_standard_deviation"] == 0


def test_text_profile_returns_only_aggregate_metrics() -> None:
    result = profile_text(TextProfileInput(text="Moon witness. Moon observes!"))

    assert result["character_count"] == 28
    assert result["word_count"] == 4
    assert result["unique_word_count"] == 3
    assert result["sentence_count_heuristic"] == 2
    assert "text" not in result
