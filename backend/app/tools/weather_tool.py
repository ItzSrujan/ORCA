"""Weather tool — retrieves weather data from Open-Meteo."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.core.logging import get_logger

logger = get_logger("tools.weather")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather interpretation codes
WMO_CODES: dict[int, str] = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
}


def _wind_direction_label(deg: float | None) -> str:
    """Convert degrees to compass label."""
    if deg is None:
        return ""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(deg / 22.5) % 16
    return dirs[idx]


async def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from Open-Meteo.

    Returns raw dict with normalised-friendly keys.
    Raises on network / API errors.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
            "wind_direction_10m",
            "visibility",
        ]),
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    current = data.get("current", {})
    wcode = current.get("weather_code")
    wind_deg = current.get("wind_direction_10m")

    result = {
        "timestamp": current.get("time", datetime.now(timezone.utc).isoformat()),
        "latitude": lat,
        "longitude": lon,
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": wind_deg,
        "wind_direction_label": _wind_direction_label(wind_deg),
        "temperature_c": current.get("temperature_2m"),
        "precipitation_mm": current.get("precipitation"),
        "visibility_km": (current.get("visibility") or 0) / 1000 if current.get("visibility") else None,
        "humidity_pct": current.get("relative_humidity_2m"),
        "weather_code": wcode,
        "weather_description": WMO_CODES.get(wcode, "Unknown") if wcode is not None else "",
        "source": "Open-Meteo",
        "is_live": True,
    }

    logger.info("Weather fetched for (%.2f, %.2f): wind=%.1f km/h, temp=%.1f°C",
                lat, lon, result["wind_speed_kmh"] or 0, result["temperature_c"] or 0)
    return result
