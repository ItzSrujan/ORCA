"""Tests for the deterministic risk engine."""

import os
os.environ.setdefault("LLM_PROVIDER", "huggingface")
os.environ.setdefault("HF_MODEL", "test-model")

from app.schemas.marine import WeatherData, MarineConditions, TideData
from app.services.risk_engine import assess_risk


def test_low_risk():
    weather = WeatherData(wind_speed_kmh=10.0, weather_code=0, weather_description="Clear sky")
    marine = MarineConditions(wave_height_m=0.5)
    tide = TideData(available=True)
    result = assess_risk(weather, marine, tide)
    assert result.level == "LOW"


def test_moderate_wind():
    weather = WeatherData(wind_speed_kmh=25.0)
    marine = MarineConditions(wave_height_m=0.5)
    result = assess_risk(weather, marine, None)
    assert result.level == "MODERATE"
    assert any("wind" in f.lower() for f in result.factors)


def test_moderate_waves():
    weather = WeatherData(wind_speed_kmh=10.0)
    marine = MarineConditions(wave_height_m=1.5)
    result = assess_risk(weather, marine, None)
    assert result.level == "MODERATE"


def test_high_risk_wind():
    weather = WeatherData(wind_speed_kmh=45.0)
    marine = MarineConditions(wave_height_m=0.5)
    result = assess_risk(weather, marine, None)
    assert result.level == "HIGH"


def test_high_risk_waves():
    weather = WeatherData(wind_speed_kmh=10.0)
    marine = MarineConditions(wave_height_m=3.0)
    result = assess_risk(weather, marine, None)
    assert result.level == "HIGH"


def test_thunderstorm_raises_risk():
    weather = WeatherData(wind_speed_kmh=15.0, weather_code=95, weather_description="Thunderstorm")
    marine = MarineConditions(wave_height_m=0.5)
    result = assess_risk(weather, marine, None)
    assert result.level == "HIGH"


def test_unknown_when_no_data():
    result = assess_risk(None, None, None)
    assert result.level == "UNKNOWN"
    assert len(result.uncertainties) > 0


def test_tide_unavailable_adds_uncertainty():
    weather = WeatherData(wind_speed_kmh=10.0)
    marine = MarineConditions(wave_height_m=0.5)
    result = assess_risk(weather, marine, None)
    assert any("tide" in u.lower() for u in result.uncertainties)


def test_tide_available_no_uncertainty():
    weather = WeatherData(wind_speed_kmh=10.0)
    marine = MarineConditions(wave_height_m=0.5)
    tide = TideData(available=True)
    result = assess_risk(weather, marine, tide)
    assert not any("tide" in u.lower() for u in result.uncertainties)
