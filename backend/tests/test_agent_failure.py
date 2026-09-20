"""Tests for agent failure handling — one agent failing must not crash the pipeline."""

import pytest
from unittest.mock import patch, AsyncMock

import os
os.environ.setdefault("LLM_PROVIDER", "huggingface")
os.environ.setdefault("HF_MODEL", "test-model")

from app.agents.weather_agent import run_weather_agent
from app.agents.marine_agent import run_marine_agent
from app.agents.tide_agent import run_tide_agent


@pytest.mark.asyncio
async def test_weather_agent_failure_returns_none():
    """If the weather API throws, agent returns None + failed step."""
    with patch("app.agents.weather_agent.fetch_weather", new_callable=AsyncMock) as mock:
        mock.side_effect = Exception("API timeout")
        data, step = await run_weather_agent(21.6, 87.5)

    assert data is None
    assert step.status == "failed"
    assert "failed" in step.message.lower() or "timeout" in step.message.lower()


@pytest.mark.asyncio
async def test_marine_agent_failure_returns_none():
    with patch("app.agents.marine_agent.fetch_marine", new_callable=AsyncMock) as mock:
        mock.side_effect = Exception("Connection refused")
        data, step = await run_marine_agent(21.6, 87.5)

    assert data is None
    assert step.status == "failed"


@pytest.mark.asyncio
async def test_tide_agent_unavailable():
    """Tide agent should return successfully with available=False when provider is unavailable."""
    with patch("app.agents.tide_agent.fetch_tide", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "timestamp": "",
            "latitude": 21.6,
            "longitude": 87.5,
            "tide_status": "",
            "current_level_m": None,
            "next_high": "",
            "next_low": "",
            "available": False,
            "reason": "Tide provider unavailable",
            "source": "",
            "is_live": False,
        }
        data, step = await run_tide_agent(21.6, 87.5)
    assert data is not None
    assert data.available is False
    assert step.status == "completed"


@pytest.mark.asyncio
async def test_tide_agent_live_available():
    """Tide agent should return available=True with valid tide status when live data is returned."""
    with patch("app.agents.tide_agent.fetch_tide", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "timestamp": "2026-09-14T12:00:00Z",
            "latitude": 21.6,
            "longitude": 87.5,
            "tide_status": "Rising",
            "current_level_m": 0.45,
            "next_high": "17:00 (+2.6m)",
            "next_low": "23:00 (-0.8m)",
            "available": True,
            "reason": "High tide at 17:00 (+2.6m)",
            "source": "Open-Meteo Marine (MSL Tide Model)",
            "is_live": True,
        }
        data, step = await run_tide_agent(21.6, 87.5)
    assert data is not None
    assert data.available is True
    assert data.tide_status == "Rising"
    assert step.status == "completed"

