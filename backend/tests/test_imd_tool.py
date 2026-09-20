"""Tests for IMD Current Weather API tool and parsing."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.tools.imd_tool import (
    IMD_WIND_DIRECTIONS,
    IMD_WEATHER_CODES,
    find_nearest_imd_station,
    parse_imd_wind_direction,
    parse_imd_weather_code,
    fetch_imd_current_weather,
)
from app.agents.weather_agent import run_weather_agent


def test_imd_wind_direction_codes():
    """Verify all defined IMD wind direction codes map accurately."""
    # Test specific keys from user specification
    desc, label, deg = parse_imd_wind_direction(0)
    assert desc == "Calm"

    desc, label, deg = parse_imd_wind_direction(20)
    assert desc == "North-northeasterly"
    assert label == "NNE"

    desc, label, deg = parse_imd_wind_direction(90)
    assert desc == "Easterly"
    assert label == "E"

    desc, label, deg = parse_imd_wind_direction(180)
    assert desc == "Southerly"
    assert label == "S"

    desc, label, deg = parse_imd_wind_direction(270)
    assert desc == "Westerly"
    assert label == "W"

    desc, label, deg = parse_imd_wind_direction(360)
    assert desc == "Northerly"
    assert label == "N"

    # String input support
    desc, label, deg = parse_imd_wind_direction("140")
    assert desc == "Southeasterly"


def test_imd_weather_codes():
    """Verify weather code decoding for 01-99."""
    code, desc = parse_imd_weather_code("01")
    assert code == 1
    assert "dissolving" in desc

    code, desc = parse_imd_weather_code(17)
    assert code == 17
    assert "Thunderstorm" in desc

    code, desc = parse_imd_weather_code(21)
    assert "Rain" in desc

    code, desc = parse_imd_weather_code(99)
    assert code == 99
    assert "Thunderstorm" in desc and "hail" in desc


def test_find_nearest_imd_station():
    """Verify geospatial station matching for Indian coastal points."""
    # Digha coordinates
    st_digha = find_nearest_imd_station(21.62, 87.51)
    assert st_digha["name"] == "Digha"
    assert st_digha["id"] == "42901"

    # Mumbai coordinates
    st_mumbai = find_nearest_imd_station(18.92, 72.82)
    assert "Mumbai" in st_mumbai["name"]

    # Chennai coordinates
    st_chennai = find_nearest_imd_station(13.08, 80.27)
    assert "Chennai" in st_chennai["name"]


@pytest.mark.asyncio
async def test_fetch_imd_current_weather_no_keys():
    """Without API key/token, returns None for clean fallback."""
    with patch("app.tools.imd_tool.get_settings") as mock_settings:
        mock_settings.return_value.imd_api_key = ""
        mock_settings.return_value.imd_auth_token = ""
        mock_settings.return_value.imd_api_url = "https://api.imd.gov.in/api/v1/current_wx"

        result = await fetch_imd_current_weather(lat=21.6, lon=87.5)
        assert result is None


@pytest.mark.asyncio
async def test_fetch_imd_current_weather_mocked_success():
    """Test successful parsing of IMD payload matching official fields."""
    mock_payload = [
        {
            "Station Id": "42901",
            "Station": "Digha",
            "Date of Observation": "2026-09-14",
            "Time of Observation": "06:00",
            "M.S.L.P": "1008.4",
            "Wind Direction": "230",
            "Wind Speed": "22.5",
            "Temperature": "29.2",
            "Weather Code": "03",
            "Nebulosity": "5",
            "Humidity": "84",
            "Last 24 hrs Rainfall": "12.4",
        }
    ]

    with patch("app.tools.imd_tool.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.get") as mock_get:
        mock_settings.return_value.imd_api_key = "test-key"
        mock_settings.return_value.imd_auth_token = "test-token"
        mock_settings.return_value.imd_api_url = "https://api.imd.gov.in/api/v1/current_wx"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_payload
        mock_get.return_value = mock_resp

        data = await fetch_imd_current_weather(lat=21.62, lon=87.5)
        assert data is not None
        assert data["station_id"] == "42901"
        assert data["station_name"] == "Digha"
        assert data["wind_speed_kmh"] == 22.5
        assert data["wind_direction_label"] == "SW"
        assert data["temperature_c"] == 29.2
        assert data["weather_code"] == 3
        assert data["mslp_hpa"] == 1008.4
        assert data["nebulosity"] == 5
        assert data["humidity_pct"] == 84.0
        assert data["rainfall_last_24h_mm"] == 12.4
        assert "IMD (Digha)" in data["source"]


@pytest.mark.asyncio
async def test_weather_agent_uses_imd_when_available():
    """Verify weather agent prioritizes IMD and formats execution step."""
    mock_imd_data = {
        "timestamp": "2026-09-14T06:00:00Z",
        "latitude": 21.6266,
        "longitude": 87.5074,
        "wind_speed_kmh": 20.0,
        "wind_direction_deg": 225.0,
        "wind_direction_label": "SW",
        "temperature_c": 28.5,
        "weather_code": 3,
        "weather_description": "Clouds generally forming or developing",
        "station_id": "42901",
        "station_name": "Digha",
        "mslp_hpa": 1009.0,
        "nebulosity": 4,
        "humidity_pct": 80.0,
        "rainfall_last_24h_mm": 5.0,
        "source": "IMD (Digha)",
        "is_live": True,
    }

    with patch("app.agents.weather_agent.fetch_imd_current_weather", new=AsyncMock(return_value=mock_imd_data)):
        data, step = await run_weather_agent(21.6, 87.5)
        assert data is not None
        assert data.source == "IMD (Digha)"
        assert data.station_name == "Digha"
        assert step.status == "completed"
        assert "IMD" in step.message
