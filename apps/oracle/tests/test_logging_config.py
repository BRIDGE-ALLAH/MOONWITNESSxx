from __future__ import annotations

import json
import logging

from oracle.logging_config import JsonLogFormatter


def test_json_formatter_uses_operational_allowlist() -> None:
    record = logging.LogRecord(
        name="oracle.jobs",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ORACLE job succeeded",
        args=(),
        exc_info=None,
    )
    record.event = "job_succeeded"
    record.job_id = "job-1"
    record.payload = "must-not-be-logged"

    rendered = JsonLogFormatter().format(record)
    parsed = json.loads(rendered)

    assert parsed["event"] == "job_succeeded"
    assert parsed["job_id"] == "job-1"
    assert "payload" not in parsed
    assert "must-not-be-logged" not in rendered
