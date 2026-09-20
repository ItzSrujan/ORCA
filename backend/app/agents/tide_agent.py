"""Tide agent — fetches tide data from configured provider."""

from __future__ import annotations

import time

from app.core.logging import get_logger
from app.tools.tide_tool import fetch_tide
from app.schemas.marine import TideData
from app.schemas.query import ExecutionStep

logger = get_logger("agents.tide")


async def run_tide_agent(lat: float, lon: float) -> tuple[TideData | None, ExecutionStep]:
    """Execute the tide agent.

    Returns (normalised data, execution step).
    """
    step = ExecutionStep(step="tide_agent", status="pending")
    t0 = time.perf_counter()

    try:
        raw = await fetch_tide(lat, lon)
        data = TideData(**raw)
        elapsed = (time.perf_counter() - t0) * 1000

        if data.available:
            step.status = "completed"
            step.message = f"Tide: {data.tide_status}"
        else:
            step.status = "completed"
            step.message = data.reason or "Tide data unavailable"

        step.duration_ms = round(elapsed, 1)
        logger.info("Tide agent completed in %.0f ms (available=%s)", elapsed, data.available)
        return data, step

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "failed"
        step.message = f"Tide data retrieval failed: {exc}"
        step.duration_ms = round(elapsed, 1)
        logger.error("Tide agent failed: %s", exc)
        return None, step
