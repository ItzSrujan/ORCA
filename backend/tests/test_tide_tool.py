"""Tests for tide tool and WorldTides parser."""

from __future__ import annotations

import pytest
from app.tools.tide_tool import _parse_worldtides, fetch_tide


def test_parse_worldtides():
    mock_data = {
        "status": 200,
        "station": "Vishakhapatnam",
        "heights": [
            {"dt": 1789932600, "date": "2026-09-20T19:30+0000", "height": 0.197},
            {"dt": 1789934400, "date": "2026-09-20T20:00+0000", "height": 0.246},
        ],
        "extremes": [
            {"dt": 1789946094, "date": "2026-09-20T23:14+0000", "height": 0.446, "type": "High"},
            {"dt": 1789970977, "date": "2026-09-21T06:09+0000", "height": -0.025, "type": "Low"},
        ],
    }

    parsed = _parse_worldtides(mock_data, 17.6974, 83.2983, "https://www.worldtides.info/api/v3")

    assert parsed["available"] is True
    assert parsed["is_live"] is True
    assert parsed["tide_status"] in ("Rising", "Falling", "High Tide", "Low Tide", "Normal")
    assert parsed["current_level_m"] is not None
    assert "Vishakhapatnam" in parsed["reason"]
    assert "WorldTides" in parsed["source"]


@pytest.mark.asyncio
async def test_fetch_tide_integration():
    result = await fetch_tide(17.6974, 83.2983)
    assert result is not None
    assert "tide_status" in result
    assert result["available"] is True
