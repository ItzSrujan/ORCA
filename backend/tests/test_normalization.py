"""Tests for data normalization."""

from app.services.normalization import normalize_weather, normalize_marine


def test_normalize_weather_valid():
    raw = {
        "timestamp": "2025-01-01T12:00",
        "latitude": 21.6,
        "longitude": 87.5,
        "wind_speed_kmh": 18.0,
        "wind_direction_deg": 200.0,
        "wind_direction_label": "SSW",
        "temperature_c": 28.0,
        "precipitation_mm": 0.0,
        "source": "Open-Meteo",
        "is_live": True,
    }
    result = normalize_weather(raw)
    assert result is not None
    assert result.wind_speed_kmh == 18.0
    assert result.source == "Open-Meteo"
    assert result.is_live is True


def test_normalize_weather_none():
    assert normalize_weather(None) is None


def test_normalize_marine_valid():
    raw = {
        "timestamp": "2025-01-01T12:00",
        "latitude": 21.6,
        "longitude": 87.5,
        "wave_height_m": 1.2,
        "wave_direction_deg": 220.0,
        "wave_period_s": 7.0,
        "source": "Open-Meteo Marine",
        "is_live": True,
    }
    result = normalize_marine(raw)
    assert result is not None
    assert result.wave_height_m == 1.2
    assert result.source == "Open-Meteo Marine"


def test_normalize_marine_none():
    assert normalize_marine(None) is None


def test_normalize_weather_partial_data():
    """Normalization should handle missing optional fields."""
    raw = {
        "source": "test",
    }
    result = normalize_weather(raw)
    assert result is not None
    assert result.wind_speed_kmh is None
    assert result.source == "test"
