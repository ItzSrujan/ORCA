"""Schemas for the final ORCA API response."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .query import ParsedIntent, ExecutionStep
from .marine import WeatherData, MarineConditions, TideData, PFZAdvisory


class RiskAssessment(BaseModel):
    """Deterministic risk assessment output."""

    level: str = "UNKNOWN"  # LOW | MODERATE | HIGH | UNKNOWN
    factors: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    """Provenance record for one data source."""

    source: str = ""
    data_type: str = ""
    timestamp: str = ""
    claim: str = ""
    metric: str = ""
    is_live: bool = True


class DataPayload(BaseModel):
    """All retrieved marine data."""

    weather: WeatherData | None = None
    marine: MarineConditions | None = None
    tide: TideData | None = None
    pfz: PFZAdvisory | None = None


class OrcaResponse(BaseModel):
    """Complete response returned by POST /api/query."""

    query: str
    intent: ParsedIntent
    execution_trace: list[ExecutionStep] = Field(default_factory=list)
    data: DataPayload = Field(default_factory=DataPayload)
    risk_assessment: RiskAssessment = Field(default_factory=RiskAssessment)
    recommendation: str = ""
    evidence: list[EvidenceItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    llm_provider: str = ""
    llm_model: str = ""
    llm_status: str = "fallback"  # live | fallback
