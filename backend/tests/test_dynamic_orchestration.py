"""Tests for ORCA Dynamic Agentic Orchestration."""

import pytest
from app.orchestration.planner import (
    _fallback_parse_intent,
    plan_tasks,
    resolve_location,
    _intelligent_multi_agent_synthesizer,
)
from app.schemas.response import RiskAssessment
from app.schemas.marine import WeatherData, MarineConditions, TideData, PFZAdvisory


def test_dynamic_comparison_intent():
    intent = _fallback_parse_intent("compare conditions between Mumbai and Alibaug")
    assert intent.output_type == "comparison"
    assert "Mumbai" in intent.location or "Alibaug" in intent.secondary_location or "Alibaug" in intent.location
    assert "weather" in intent.required_agents
    assert "marine" in intent.required_agents
    assert intent.objective == "compare_locations"


def test_dynamic_vessel_constraints():
    intent = _fallback_parse_intent("can I go out in a small wooden dinghy today?")
    assert intent.primary_intent == "fishing_safety"
    assert "small_craft" in intent.constraints
    assert "waves" in intent.required_information
    assert intent.output_type == "recommendation"


def test_dynamic_night_timing():
    intent = _fallback_parse_intent("what is the best time for night departure from harbor?")
    assert "night_operations" in intent.constraints
    assert "tide" in intent.required_information
    assert "tide" in intent.required_agents


@pytest.mark.asyncio
async def test_plan_tasks_generates_dynamic_plan():
    intent = _fallback_parse_intent("compare Mumbai and Alibaug")
    state = {
        "original_query": "compare Mumbai and Alibaug",
        "parsed_intent": intent,
        "required_agents": intent.required_agents,
        "is_comparison_query": True,
        "secondary_latitude": 18.6411,
        "secondary_longitude": 72.8722,
        "secondary_location_name": "Alibaug",
    }
    planned = await plan_tasks(state)
    plan = planned["dynamic_plan"]
    assert plan is not None
    assert plan["output_type"] == "comparison"
    assert plan["execution_strategy"] == "parallel"
    # Should contain tasks for primary and secondary locations
    locs = [t["location"] for t in plan["tasks"]]
    assert "primary" in locs
    assert "secondary" in locs


@pytest.mark.asyncio
async def test_resolve_location_resolves_secondary():
    intent = _fallback_parse_intent("compare Mumbai and Alibaug")
    state = {
        "original_query": "compare Mumbai and Alibaug",
        "parsed_intent": intent,
        "location_name": "Mumbai",
        "input_latitude": 18.9167,
        "input_longitude": 72.8258,
    }
    resolved = await resolve_location(state)
    assert resolved["is_comparison_query"] is True
    assert resolved["secondary_location_name"] != ""
    assert resolved["secondary_latitude"] is not None
    assert resolved["secondary_longitude"] is not None


def test_synthesizer_comparison_with_live_telemetry():
    state = {
        "original_query": "compare Mumbai and Alibaug",
        "location_name": "Mumbai (Sassoon Dock)",
        "latitude": 18.9167,
        "longitude": 72.8258,
        "is_comparison_query": True,
        "secondary_location_name": "Alibaug",
        "weather_data": WeatherData(wind_speed_kmh=24.0, weather_description="Choppy", wind_direction_label="NW"),
        "marine_data": MarineConditions(wave_height_m=1.8, wave_period_s=6.0),
        "risk_assessment": RiskAssessment(level="MODERATE"),
        "secondary_weather_data": WeatherData(wind_speed_kmh=12.0, weather_description="Calm", wind_direction_label="W"),
        "secondary_marine_data": MarineConditions(wave_height_m=0.8, wave_period_s=7.0),
        "secondary_risk_assessment": RiskAssessment(level="LOW"),
    }
    answer = _intelligent_multi_agent_synthesizer(state, lang="en")
    assert "Coastal Harbor Comparison" in answer
    assert "Mumbai (Sassoon Dock)" in answer
    assert "Alibaug" in answer
    assert "1.8 m" in answer
    assert "0.8 m" in answer
    assert "Alibaug" in answer  # Should recommend Alibaug as calmer


def test_synthesizer_hindi_weather():
    state = {
        "original_query": "वर्तमान स्थान का मौसम कैसा है",
        "location_name": "दीघा",
        "weather_data": WeatherData(wind_speed_kmh=15.0, weather_description="साफ आकाश", temperature_c=28.5),
        "marine_data": MarineConditions(wave_height_m=0.6),
        "risk_assessment": RiskAssessment(level="LOW"),
    }
    answer = _intelligent_multi_agent_synthesizer(state, lang="hi")
    assert "मौसम व हवामान स्थिति" in answer or "दीघा" in answer
    assert "15 किमी/घंटा" in answer or "28.5°C" in answer


def test_synthesizer_marathi_vessel():
    state = {
        "original_query": "लहान होडी घेऊन समुद्रात जाऊ शकतो का?",
        "location_name": "मालवण",
        "weather_data": WeatherData(wind_speed_kmh=10.0, weather_description="स्वच्छ हवामान", temperature_c=27.0),
        "marine_data": MarineConditions(wave_height_m=0.7),
        "risk_assessment": RiskAssessment(level="LOW"),
    }
    answer = _intelligent_multi_agent_synthesizer(state, lang="mr")
    assert "लहान होडी" in answer
    assert "मालवण" in answer
    assert "सुरक्षित" in answer


def test_compare_current_port_intent():
    intent = _fallback_parse_intent("compare current port and mumbai port")
    assert intent.output_type == "comparison"
    assert intent.primary_intent == "comparison"
    assert "Mumbai" in intent.secondary_location
    assert intent.is_current_location is True


def test_current_location_identity_intent():
    for q in ["what is my current location", "where am i", "my location", "what is my current port", "मेरा वर्तमान स्थान क्या है", "मी कुठे आहे"]:
        intent = _fallback_parse_intent(q)
        assert intent.primary_intent == "current_location"
        assert intent.is_current_location is True


def test_synthesizer_current_location_response():
    state = {
        "original_query": "what is my current location",
        "location_name": "Digha",
        "latitude": 21.6266,
        "longitude": 87.5074,
        "weather_data": WeatherData(wind_speed_kmh=12.0, weather_description="Clear skies", temperature_c=28.0),
        "marine_data": MarineConditions(wave_height_m=0.8),
        "risk_assessment": RiskAssessment(level="LOW"),
    }
    answer = _intelligent_multi_agent_synthesizer(state, lang="en")
    assert "Current Location" in answer
    assert "Digha" in answer
    assert "21.6266°N, 87.5074°E" in answer
    assert "SAFE TO OPERATE" in answer


def test_nearest_port_intent_custom_queries():
    for q in [
        "nearest port from my location",
        "closest port to me",
        "which is the nearest harbor",
        "port near me",
        "nearby harbor",
        "pass ka port",
        "jawalche bandar",
    ]:
        intent = _fallback_parse_intent(q)
        assert intent.primary_intent == "nearest_port", f"Failed on query: {q}"
        assert intent.is_current_location is True
        assert "marine" in intent.required_agents


def test_custom_queries_not_hijacked_by_my_location():
    intent_safe = _fallback_parse_intent("is it safe at my location")
    assert intent_safe.primary_intent == "fishing_safety"

    intent_weather = _fallback_parse_intent("what is the weather at my location")
    assert intent_weather.primary_intent == "weather_check"

    intent_wave = _fallback_parse_intent("how high are the waves at my location")
    assert intent_wave.primary_intent == "marine_conditions"


def test_synthesizer_nearest_port_response():
    # Lat: 18.4525, Lon: 73.8930 (from user screenshot)
    state = {
        "original_query": "nearest port from my location",
        "location_name": "Your Current Location",
        "latitude": 18.4525,
        "longitude": 73.8930,
        "weather_data": WeatherData(wind_speed_kmh=9.2, wind_direction_label="W", weather_description="Clear skies"),
        "marine_data": MarineConditions(wave_height_m=0.8),
        "risk_assessment": RiskAssessment(level="LOW"),
    }
    answer_en = _intelligent_multi_agent_synthesizer(state, lang="en")
    assert "Nearest Port from Your Location" in answer_en
    assert "km away" in answer_en
    assert "0.8 m" in answer_en or "0.8m" in answer_en
    assert "9.2 km/h" in answer_en

    answer_hi = _intelligent_multi_agent_synthesizer(state, lang="hi")
    assert "निकटतम बंदरगाह" in answer_hi
    assert "किमी" in answer_hi

    answer_mr = _intelligent_multi_agent_synthesizer(state, lang="mr")
    assert "जवळचे बंदर" in answer_mr
    assert "किमी" in answer_mr


