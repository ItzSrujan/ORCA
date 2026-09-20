"""Schemas for marine, weather, tide and PFZ data."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GeoLocation(BaseModel):
    """Resolved geographic location."""

    name: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    resolved: bool = False


class WeatherData(BaseModel):
    """Normalised weather conditions."""

    timestamp: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    wind_direction_label: str = ""
    temperature_c: float | None = None
    precipitation_mm: float | None = None
    visibility_km: float | None = None
    humidity_pct: float | None = None
    weather_code: int | None = None
    weather_description: str = ""
    # IMD (India Meteorological Department) specific fields
    station_id: str | None = None
    station_name: str | None = None
    mslp_hpa: float | None = None  # Mean Sea Level Pressure in hPa
    nebulosity: int | None = None  # Cloud coverage 0-8
    rainfall_last_24h_mm: float | None = None  # Rainfall in last 24 hrs
    source: str = ""
    is_live: bool = True


class MarineConditions(BaseModel):
    """Normalised marine / ocean conditions."""

    timestamp: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    wave_height_m: float | None = None
    wave_direction_deg: float | None = None
    wave_period_s: float | None = None
    wave_peak_period_s: float | None = None
    wind_wave_height_m: float | None = None
    wind_wave_direction_deg: float | None = None
    wind_wave_period_s: float | None = None
    wind_wave_peak_period_s: float | None = None
    sea_surface_temperature_c: float | None = None
    sea_level_height_msl_m: float | None = None
    swell_height_m: float | None = None
    swell_direction_deg: float | None = None
    swell_period_s: float | None = None
    current_velocity_ms: float | None = None
    hourly_forecast: dict | None = None
    source: str = ""
    is_live: bool = True


class TideData(BaseModel):
    """Normalised tide information."""

    timestamp: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    tide_status: str = ""  # Rising / Falling / High / Low
    current_level_m: float | None = None
    next_high: str = ""
    next_low: str = ""
    available: bool = False
    reason: str = ""
    source: str = ""
    is_live: bool = False


class PFZAdvisory(BaseModel):
    """Potential Fishing Zone advisory."""

    available: bool = False
    zone: str = ""
    summary: str = ""
    issued_at: str = ""
    latitude: float | None = None
    longitude: float | None = None
    source: str = ""
    is_live: bool = False
