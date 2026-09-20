"""Data normalization service.

Ensures all raw API responses are converted to standardised Pydantic schemas
before they reach downstream consumers.
"""

from __future__ import annotations

from app.core.logging import get_logger
from app.schemas.marine import WeatherData, MarineConditions, TideData, PFZAdvisory

logger = get_logger("services.normalization")


def normalize_weather(raw: dict | None) -> WeatherData | None:
    """Normalise raw weather dict into WeatherData schema."""
    if raw is None:
        return None
    try:
        return WeatherData(**raw)
    except Exception as exc:
        logger.error("Weather normalization failed: %s", exc)
        return None


def normalize_marine(raw: dict | None) -> MarineConditions | None:
    """Normalise raw marine dict into MarineConditions schema."""
    if raw is None:
        return None
    try:
        return MarineConditions(**raw)
    except Exception as exc:
        logger.error("Marine normalization failed: %s", exc)
        return None


def normalize_tide(raw: dict | None) -> TideData | None:
    """Normalise raw tide dict into TideData schema."""
    if raw is None:
        return None
    try:
        return TideData(**raw)
    except Exception as exc:
        logger.error("Tide normalization failed: %s", exc)
        return None


def normalize_pfz(raw: dict | None) -> PFZAdvisory | None:
    """Normalise raw PFZ dict into PFZAdvisory schema."""
    if raw is None:
        return None
    try:
        return PFZAdvisory(**raw)
    except Exception as exc:
        logger.error("PFZ normalization failed: %s", exc)
        return None
