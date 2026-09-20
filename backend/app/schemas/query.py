"""Schemas for query input and intent parsing."""

from __future__ import annotations

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    """Incoming user query."""

    query: str = Field(..., min_length=1, max_length=1000, description="Natural-language marine query")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    language: str | None = Field(default="en", description="Language code: en, hi, mr")
    location_name: str | None = Field(default=None, description="Optional location label")


class LocationAnalysisRequest(BaseModel):
    """Request for location-specific marine condition and risk assessment."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    language: str = Field(default="en", description="en, hi, mr")
    location_name: str | None = None


class CompareLocationsRequest(BaseModel):
    """Request for comparing current location with nearby coastal spots."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    language: str = Field(default="en", description="en, hi, mr")



class ParsedIntent(BaseModel):
    """Structured intent extracted from the user query."""

    primary_intent: str = Field(
        default="general_marine_query",
        description="One of: fishing_safety, marine_conditions, fishing_zone, weather_check, tide_check, general_marine_query",
    )
    location: str = Field(default="")
    exclude_location: str = Field(default="")
    is_current_location: bool = Field(default=False)
    latitude: float | None = None
    longitude: float | None = None
    time: str = Field(default="current", description="current, today, tomorrow, tomorrow_morning, etc.")
    required_agents: list[str] = Field(default_factory=lambda: ["weather", "marine"])


class ExecutionStep(BaseModel):
    """One step in the execution trace."""

    step: str
    status: str = "pending"  # pending | completed | failed | skipped
    message: str = ""
    duration_ms: float | None = None
