"""LangGraph state definition for the ORCA orchestration pipeline."""

from __future__ import annotations

from typing import TypedDict

from app.schemas.query import ParsedIntent, ExecutionStep
from app.schemas.marine import WeatherData, MarineConditions, TideData, PFZAdvisory
from app.schemas.response import RiskAssessment, EvidenceItem


class OrcaState(TypedDict, total=False):
    """Typed state flowing through the LangGraph."""

    # Input
    original_query: str
    input_latitude: float | None
    input_longitude: float | None
    language: str

    # Intent
    parsed_intent: ParsedIntent

    # Location & Spatial Context
    location_name: str
    latitude: float
    longitude: float
    location_resolved: bool
    spatial_context: dict | None

    # Agent selection
    required_agents: list[str]

    # Dynamic plan
    dynamic_plan: dict | None

    # Agent results
    weather_data: WeatherData | None
    marine_data: MarineConditions | None
    tide_data: TideData | None
    pfz_data: PFZAdvisory | None

    # Comparison / secondary location data
    is_comparison_query: bool
    secondary_location_name: str
    secondary_latitude: float | None
    secondary_longitude: float | None
    secondary_weather_data: WeatherData | None
    secondary_marine_data: MarineConditions | None
    secondary_tide_data: TideData | None
    secondary_risk_assessment: RiskAssessment | None
    comparison_note: str | None

    # Validation
    validation_notes: list[str]

    # Risk
    risk_assessment: RiskAssessment

    # Evidence
    evidence: list[EvidenceItem]

    # Response
    recommendation: str

    # Execution trace
    execution_trace: list[ExecutionStep]

    # Errors
    errors: list[str]
