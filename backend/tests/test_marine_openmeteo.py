"""Tests for Open-Meteo Marine tool integration."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.schemas.marine import MarineConditions
from app.tools.marine_tool import (
    fetch_marine,
    fetch_marine_dataframe,
    MARINE_CURRENT_VARIABLES,
    MARINE_HOURLY_VARIABLES,
)


def test_marine_variables_configured():
    """Ensure all required Open-Meteo current and hourly variables are configured."""
    assert "sea_surface_temperature" in MARINE_CURRENT_VARIABLES
    assert "sea_level_height_msl" in MARINE_CURRENT_VARIABLES
    assert "wave_peak_period" in MARINE_CURRENT_VARIABLES
    assert "wind_wave_height" in MARINE_CURRENT_VARIABLES
    assert "wind_wave_direction" in MARINE_CURRENT_VARIABLES

    assert "wave_height" in MARINE_HOURLY_VARIABLES
    assert "sea_surface_temperature" in MARINE_HOURLY_VARIABLES


def test_marine_conditions_extended_schema():
    """Verify MarineConditions schema parses full oceanographic parameters."""
    data = {
        "timestamp": "2026-09-14T12:00:00Z",
        "latitude": 21.6266,
        "longitude": 87.5074,
        "wave_height_m": 1.2,
        "wave_direction_deg": 180.0,
        "wave_period_s": 8.5,
        "wave_peak_period_s": 9.2,
        "wind_wave_height_m": 0.4,
        "wind_wave_direction_deg": 195.0,
        "wind_wave_period_s": 3.5,
        "wind_wave_peak_period_s": 4.1,
        "sea_surface_temperature_c": 31.1,
        "sea_level_height_msl_m": -0.65,
        "swell_height_m": 0.8,
        "swell_direction_deg": 175.0,
        "swell_period_s": 8.2,
        "current_velocity_ms": 0.45,
        "source": "Open-Meteo Marine",
        "is_live": True,
    }
    conditions = MarineConditions(**data)
    assert conditions.wave_height_m == 1.2
    assert conditions.sea_surface_temperature_c == 31.1
    assert conditions.sea_level_height_msl_m == -0.65
    assert conditions.wave_peak_period_s == 9.2
    assert conditions.wind_wave_height_m == 0.4


@pytest.mark.asyncio
async def test_fetch_marine_mocked_success():
    """Verify fetch_marine extracts fields from raw API payload."""
    mock_payload = {
        "current": {
            "time": "2026-09-14T12:15",
            "wave_direction": 170,
            "wave_height": 0.85,
            "wave_peak_period": 9.0,
            "wave_period": 11.2,
            "sea_surface_temperature": 30.5,
            "wind_wave_height": 0.2,
            "wind_wave_direction": 180,
            "wind_wave_period": 3.0,
            "wind_wave_peak_period": 3.5,
            "sea_level_height_msl": -0.5,
            "swell_wave_height": 0.65,
            "swell_wave_direction": 168,
            "swell_wave_period": 8.5,
        },
        "hourly": {
            "time": ["2026-09-14T12:00"],
            "wave_height": [0.85],
            "sea_surface_temperature": [30.5],
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await fetch_marine(21.62, 87.50)

    assert res["wave_height_m"] == 0.85
    assert res["sea_surface_temperature_c"] == 30.5
    assert res["sea_level_height_msl_m"] == -0.5
    assert res["wind_wave_height_m"] == 0.2
    assert res["source"] == "Open-Meteo Marine"
