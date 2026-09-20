"""PFZ agent — checks Potential Fishing Zone advisories."""

from __future__ import annotations

import time

from app.core.logging import get_logger
from app.tools.pfz_tool import fetch_pfz
from app.schemas.marine import PFZAdvisory
from app.schemas.query import ExecutionStep

logger = get_logger("agents.pfz")


async def run_pfz_agent(lat: float, lon: float) -> tuple[PFZAdvisory | None, ExecutionStep]:
    """Execute the PFZ advisory agent.

    Returns (normalised data, execution step).
    """
    step = ExecutionStep(step="pfz_agent", status="pending")
    t0 = time.perf_counter()

    try:
        raw = await fetch_pfz(lat, lon)
        data = PFZAdvisory(**raw)
        elapsed = (time.perf_counter() - t0) * 1000

        if data.available:
            step.status = "completed"
            step.message = f"Advisory available: {data.zone}"
        else:
            step.status = "completed"
            step.message = data.summary or "No PFZ advisory available"

        step.duration_ms = round(elapsed, 1)
        logger.info("PFZ agent completed in %.0f ms (available=%s)", elapsed, data.available)
        return data, step

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "failed"
        step.message = f"PFZ advisory retrieval failed: {exc}"
        step.duration_ms = round(elapsed, 1)
        logger.error("PFZ agent failed: %s", exc)
        return None, step
