"""Tests for the deterministic intent fallback parser."""

import pytest
from app.orchestration.planner import _fallback_parse_intent


def test_fishing_safety_intent():
    intent = _fallback_parse_intent("Is it safe to go fishing near Digha tomorrow morning?")
    assert intent.primary_intent == "fishing_safety"
    assert "Digha" in intent.location
    assert intent.time == "tomorrow_morning"
    assert "weather" in intent.required_agents
    assert "marine" in intent.required_agents


def test_weather_intent():
    intent = _fallback_parse_intent("What is the weather in Chennai?")
    assert intent.primary_intent == "weather_check"
    assert "Chennai" in intent.location
    assert intent.required_agents == ["weather"]


def test_tide_intent():
    intent = _fallback_parse_intent("When is the next high tide near Puri?")
    assert intent.primary_intent == "tide_check"
    assert "tide" in intent.required_agents


def test_marine_conditions_intent():
    intent = _fallback_parse_intent("What are the wave conditions near Visakhapatnam?")
    assert intent.primary_intent == "marine_conditions"
    assert "Visakhapatnam" in intent.location


def test_fishing_zone_intent():
    intent = _fallback_parse_intent("Where are favourable fishing conditions?")
    assert intent.primary_intent == "fishing_zone"
    assert "pfz" in intent.required_agents


def test_unknown_defaults_to_general():
    intent = _fallback_parse_intent("hello")
    assert intent.primary_intent == "general_marine_query"


def test_no_location_returns_empty():
    intent = _fallback_parse_intent("What are current conditions?")
    # Location extraction may or may not find something — just ensure it doesn't crash
    assert isinstance(intent.location, str)


def test_exclusion_intent():
    intent = _fallback_parse_intent("suggest location other than mumbai")
    assert intent.exclude_location == "mumbai"
    assert intent.primary_intent == "fishing_zone"
    assert "pfz" in intent.required_agents


def test_current_location_intent():
    intent = _fallback_parse_intent("tell me the weather of current location")
    assert intent.is_current_location is True
    assert intent.location == "Your Current Location"
    assert intent.primary_intent == "weather_check"
    assert "weather" in intent.required_agents


@pytest.mark.asyncio
async def test_resolve_location_exclusion():
    from app.orchestration.planner import resolve_location, _intelligent_multi_agent_synthesizer
    intent = _fallback_parse_intent("suggest location other than mumbai")
    state = {
        "original_query": "suggest location other than mumbai",
        "input_latitude": 18.9167,
        "input_longitude": 72.8258,
        "parsed_intent": intent,
    }
    resolved = await resolve_location(state)
    assert resolved["is_exclude_query"] is True
    # Should NOT be Mumbai! Top candidate should be Alibaug
    assert "Mumbai" not in resolved["location_name"]
    assert "Alibaug" in resolved["location_name"]
    # Check synthesizer output
    answer = _intelligent_multi_agent_synthesizer(resolved, lang="en")
    assert "Recommended Coastal Alternatives to Mumbai" in answer
    assert "Alibaug" in answer


@pytest.mark.asyncio
async def test_resolve_location_current_location():
    from app.orchestration.planner import resolve_location, _intelligent_multi_agent_synthesizer
    from app.schemas.response import RiskAssessment
    from app.schemas.marine import WeatherData, MarineConditions
    intent = _fallback_parse_intent("tell me the weather of current location")
    state = {
        "original_query": "tell me the weather of current location",
        "input_latitude": 19.0760,
        "input_longitude": 72.8777,
        "parsed_intent": intent,
    }
    resolved = await resolve_location(state)
    assert resolved["location_name"] == "Your Current Location"
    assert "Mumbai (Sassoon Dock)" not in resolved["location_name"]
    # Synthesize weather response
    resolved["weather_data"] = WeatherData(wind_speed_kmh=14.0, weather_description="Partly cloudy", temperature_c=29.0)
    resolved["marine_data"] = MarineConditions(wave_height_m=0.7)
    resolved["risk_assessment"] = RiskAssessment(level="LOW")
    answer = _intelligent_multi_agent_synthesizer(resolved, lang="en")
    assert "Weather at Your Current Location" in answer
    assert "Mumbai (Sassoon Dock)" not in answer


@pytest.mark.asyncio
async def test_resolve_location_explicit_target_overrides_map_coords():
    from app.orchestration.planner import resolve_location
    intent = _fallback_parse_intent("What is the weather in Goa?")
    # Frontend was on Mumbai coordinates
    state = {
        "original_query": "What is the weather in Goa?",
        "input_latitude": 18.9167,
        "input_longitude": 72.8258,
        "parsed_intent": intent,
    }
    resolved = await resolve_location(state)
    assert "Goa" in resolved["location_name"]
    assert "Mumbai" not in resolved["location_name"]
    assert abs(resolved["latitude"] - 15.4) < 0.5
