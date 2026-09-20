"""Marine tool — retrieves ocean / wave data from Open-Meteo Marine API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("tools.marine")

OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
OPEN_METEO_CUSTOMER_URL = "https://customer-marine-api.open-meteo.com/v1/marine"

MARINE_CURRENT_VARIABLES = [
    "wave_direction",
    "wave_height",
    "wave_peak_period",
    "wave_period",
    "sea_surface_temperature",
    "wind_wave_height",
    "wind_wave_direction",
    "wind_wave_period",
    "wind_wave_peak_period",
    "sea_level_height_msl",
    "swell_wave_height",
    "swell_wave_direction",
    "swell_wave_period",
]

MARINE_HOURLY_VARIABLES = [
    "wave_height",
    "wave_direction",
    "wave_peak_period",
    "wind_wave_height",
    "wind_wave_direction",
    "wind_wave_period",
    "wind_wave_peak_period",
    "sea_surface_temperature",
]


async def fetch_marine(lat: float, lon: float) -> dict:
    """Fetch current marine conditions and 7-day hourly forecast from Open-Meteo Marine API.

    Returns raw dict with normalised-friendly keys matching MarineConditions schema.
    Gracefully uses customer-marine-api if API key is provided, falling back to marine-api.
    """
    settings = get_settings()

    params: dict[str, Any] = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join(MARINE_CURRENT_VARIABLES),
        "hourly": ",".join(MARINE_HOURLY_VARIABLES),
        "forecast_days": 7,
        "timezone": "auto",
    }

    url = OPEN_METEO_MARINE_URL
    if settings.open_meteo_api_key:
        url = settings.open_meteo_customer_url
        params["apikey"] = settings.open_meteo_api_key

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            # Fallback to public marine-api if customer URL failed (e.g. invalid key or 401)
            if url != OPEN_METEO_MARINE_URL:
                logger.warning("Customer marine API failed (%s), falling back to public endpoint", exc)
                params.pop("apikey", None)
                resp = await client.get(OPEN_METEO_MARINE_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            else:
                raise

    current = data.get("current", {})
    hourly = data.get("hourly", {})

    result = {
        "timestamp": current.get("time", datetime.now(timezone.utc).isoformat()),
        "latitude": lat,
        "longitude": lon,
        # Wave metrics
        "wave_height_m": current.get("wave_height"),
        "wave_direction_deg": current.get("wave_direction"),
        "wave_period_s": current.get("wave_period"),
        "wave_peak_period_s": current.get("wave_peak_period"),
        # Wind wave metrics
        "wind_wave_height_m": current.get("wind_wave_height"),
        "wind_wave_direction_deg": current.get("wind_wave_direction"),
        "wind_wave_period_s": current.get("wind_wave_period"),
        "wind_wave_peak_period_s": current.get("wind_wave_peak_period"),
        # Sea surface temperature and MSL sea level
        "sea_surface_temperature_c": current.get("sea_surface_temperature"),
        "sea_level_height_msl_m": current.get("sea_level_height_msl"),
        # Swell metrics
        "swell_height_m": current.get("swell_wave_height"),
        "swell_direction_deg": current.get("swell_wave_direction"),
        "swell_period_s": current.get("swell_wave_period"),
        "current_velocity_ms": None,
        # Hourly 7-day forecast series
        "hourly_forecast": hourly if hourly else None,
        "source": "Open-Meteo Marine",
        "is_live": True,
    }

    logger.info(
        "Marine fetched for (%.2f, %.2f): wave=%.1fm, sst=%.1f°C, sea_level=%.2fm",
        lat, lon,
        result["wave_height_m"] or 0,
        result["sea_surface_temperature_c"] or 0,
        result["sea_level_height_msl_m"] or 0,
    )
    return result


def fetch_marine_dataframe(
    lat: float,
    lon: float,
    api_key: str = "",
    forecast_days: int = 7,
) -> Any:
    """Fetch marine forecast as a pandas DataFrame using openmeteo_requests client.

    Uses requests_cache and retry_requests with Open-Meteo protobuf response client.
    """
    import openmeteo_requests
    import pandas as pd
    import requests_cache
    from retry_requests import retry

    cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = OPEN_METEO_CUSTOMER_URL if api_key else OPEN_METEO_MARINE_URL
    params: dict[str, Any] = {
        "latitude": lat,
        "longitude": lon,
        "hourly": MARINE_HOURLY_VARIABLES,
        "current": [
            "wave_direction",
            "wave_height",
            "wave_peak_period",
            "wave_period",
            "sea_surface_temperature",
            "wind_wave_height",
            "wind_wave_direction",
            "wind_wave_period",
            "wind_wave_peak_period",
            "sea_level_height_msl",
        ],
        "forecast_days": forecast_days,
    }
    if api_key:
        params["apikey"] = api_key

    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]
    hourly = response.Hourly()

    hourly_data = {
        "date": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left",
        ),
        "wave_height": hourly.Variables(0).ValuesAsNumpy(),
        "wave_direction": hourly.Variables(1).ValuesAsNumpy(),
        "wave_peak_period": hourly.Variables(2).ValuesAsNumpy(),
        "wind_wave_height": hourly.Variables(3).ValuesAsNumpy(),
        "wind_wave_direction": hourly.Variables(4).ValuesAsNumpy(),
        "wind_wave_period": hourly.Variables(5).ValuesAsNumpy(),
        "wind_wave_peak_period": hourly.Variables(6).ValuesAsNumpy(),
        "sea_surface_temperature": hourly.Variables(7).ValuesAsNumpy(),
    }

    return pd.DataFrame(data=hourly_data)
