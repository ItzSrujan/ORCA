"""Deterministic rule-based risk engine.

The LLM does NOT decide risk levels. This module applies configurable
thresholds to produce a reproducible, auditable risk assessment.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.marine import WeatherData, MarineConditions, TideData
from app.schemas.response import RiskAssessment

logger = get_logger("services.risk_engine")


def assess_risk(
    weather: WeatherData | None,
    marine: MarineConditions | None,
    tide: TideData | None,
) -> RiskAssessment:
    """Evaluate operational risk using deterministic rules.

    Returns LOW / MODERATE / HIGH / UNKNOWN with supporting factors
    and uncertainty notes.
    """
    settings = get_settings()
    factors: list[str] = []
    uncertainties: list[str] = []
    risk_scores: list[int] = []  # 0 = low, 1 = moderate, 2 = high

    # ── Wind assessment ────────────────────────────────────────
    if weather and weather.wind_speed_kmh is not None:
        wind = weather.wind_speed_kmh
        if wind >= settings.risk_wind_high_threshold:
            factors.append(
                f"Wind speed ({wind:.0f} km/h) exceeds configured high-risk threshold "
                f"({settings.risk_wind_high_threshold:.0f} km/h)"
            )
            risk_scores.append(2)
        elif wind >= settings.risk_wind_moderate_threshold:
            factors.append(
                f"Wind speed ({wind:.0f} km/h) exceeds configured caution threshold "
                f"({settings.risk_wind_moderate_threshold:.0f} km/h)"
            )
            risk_scores.append(1)
        else:
            factors.append(f"Wind speed ({wind:.0f} km/h) within normal operating range")
            risk_scores.append(0)
    else:
        uncertainties.append("Wind data unavailable")

    # ── Wave assessment ────────────────────────────────────────
    if marine and marine.wave_height_m is not None:
        wave = marine.wave_height_m
        if wave >= settings.risk_wave_high_threshold:
            factors.append(
                f"Wave height ({wave:.1f} m) exceeds configured high-risk threshold "
                f"({settings.risk_wave_high_threshold:.1f} m)"
            )
            risk_scores.append(2)
        elif wave >= settings.risk_wave_moderate_threshold:
            factors.append(
                f"Wave height ({wave:.1f} m) exceeds configured caution threshold "
                f"({settings.risk_wave_moderate_threshold:.1f} m)"
            )
            risk_scores.append(1)
        else:
            factors.append(f"Wave height ({wave:.1f} m) within normal operating range")
            risk_scores.append(0)
    else:
        uncertainties.append("Wave data unavailable")

    # ── Severe weather check ───────────────────────────────────
    if weather and (weather.weather_code is not None or weather.weather_description):
        w_desc = weather.weather_description.lower() if weather.weather_description else ""
        is_severe = (
            (weather.weather_code is not None and (weather.weather_code >= 95 or weather.weather_code in (17, 18, 19, 29)))
            or "thunderstorm" in w_desc
            or "squall" in w_desc
            or "gale" in w_desc
        )
        if is_severe:
            factors.append(f"Severe weather detected: {weather.weather_description}")
            risk_scores.append(2)
        elif (weather.weather_code is not None and weather.weather_code >= 50) or (weather.precipitation_mm and weather.precipitation_mm > 2.0):
            factors.append(f"Precipitation detected: {weather.weather_description}")
            risk_scores.append(1)

    # ── Tide uncertainty ───────────────────────────────────────
    if tide is None or not tide.available:
        uncertainties.append("Live tide data unavailable — assessment may be incomplete")

    # ── Compute final level ────────────────────────────────────
    if not risk_scores:
        level = "UNKNOWN"
        uncertainties.append("Insufficient data to determine risk level")
    else:
        max_score = max(risk_scores)
        if max_score >= 2:
            level = "HIGH"
        elif max_score >= 1:
            level = "MODERATE"
        else:
            level = "LOW"

    assessment = RiskAssessment(
        level=level,
        factors=factors,
        uncertainties=uncertainties,
    )

    logger.info("Risk assessed: %s (factors=%d, uncertainties=%d)",
                level, len(factors), len(uncertainties))
    return assessment
