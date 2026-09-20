"""Weather agent — fetches and normalises weather data."""

from __future__ import annotations

import time

from app.core.logging import get_logger
from app.tools.weather_tool import fetch_weather
from app.tools.imd_tool import fetch_imd_current_weather
from app.schemas.marine import WeatherData
from app.schemas.query import ExecutionStep

logger = get_logger("agents.weather")


async def run_weather_agent(lat: float, lon: float, station_id: str | None = None) -> tuple[WeatherData | None, ExecutionStep]:
    """Execute the weather agent.

    Tries official IMD Current Weather API first.
    Falls back gracefully to Open-Meteo if IMD is unavailable or unconfigured.

    Returns (normalised data, execution step).
    """
    step = ExecutionStep(step="weather_agent", status="pending")
    t0 = time.perf_counter()

    try:
        # 1. Attempt IMD Current Weather API
        imd_data = await fetch_imd_current_weather(station_id=station_id, lat=lat, lon=lon)
        if imd_data:
            data = WeatherData(**imd_data)
            elapsed = (time.perf_counter() - t0) * 1000
            step.status = "completed"
            step.message = f"IMD ({data.station_name or data.station_id}): Wind {data.wind_speed_kmh or 0:.0f} km/h {data.wind_direction_label}, {data.weather_description or 'Normal'}"
            step.duration_ms = round(elapsed, 1)
            logger.info("IMD weather agent completed in %.0f ms: %s", elapsed, step.message)
            return data, step

        # 2. Fallback to Open-Meteo weather
        raw = await fetch_weather(lat, lon)
        data = WeatherData(**raw)
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "completed"
        step.message = f"Open-Meteo: Wind {data.wind_speed_kmh or 0:.0f} km/h, {data.weather_description}"
        step.duration_ms = round(elapsed, 1)
        logger.info("Weather agent (fallback) completed in %.0f ms", elapsed)
        return data, step

    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        step.status = "failed"
        step.message = f"Weather data retrieval failed: {exc}"
        step.duration_ms = round(elapsed, 1)
        logger.error("Weather agent failed: %s", exc)
        return None, step
