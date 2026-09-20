"""Marine agent — fetches and normalises ocean / wave data."""

from __future__ import annotations

import time

from app.core.logging import get_logger
from app.tools.marine_tool import fetch_marine
from app.schemas.marine import MarineConditions
from app.schemas.query import ExecutionStep

logger = get_logger("agents.marine")


async def run_marine_agent(lat: float, lon: float) -> tuple[MarineConditions | None, ExecutionStep]:
    """Execute the marine agent.

    Returns (normalised data, execution step).
    """
    step = ExecutionStep(step="marine_agent", status="pending")
    t0 = time.perf_counter()

    try:
        raw = await fetch_marine(lat, lon)
        data = MarineConditions(**raw)
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "completed"
        step.message = f"Wave height {data.wave_height_m or 0:.1f} m"
        step.duration_ms = round(elapsed, 1)
        logger.info("Marine agent completed in %.0f ms", elapsed)
        return data, step

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "failed"
        step.message = f"Marine data retrieval failed: {exc}"
        step.duration_ms = round(elapsed, 1)
        logger.error("Marine agent failed: %s", exc)
        return None, step
