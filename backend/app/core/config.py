"""ORCA core configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings — sourced from .env or environment."""

    # ── LLM ────────────────────────────────────────────────────
    llm_provider: str = Field(default="auto", description="'auto', 'openrouter', 'huggingface', 'openai', or 'local'")
    openrouter_api_key: str = Field(default="")
    openrouter_model: str = Field(default="google/gemini-2.0-flash-exp:free")
    hf_model: str = Field(default="zai-org/GLM-5.3")
    hf_token: str = Field(default="")
    openai_api_key: str = Field(default="")
    openai_base_url: str = Field(default="")
    openai_model: str = Field(default="gpt-4o-mini")
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.0-flash")

    # ── Tide ───────────────────────────────────────────────────
    tide_api_key: str = Field(default="f6d16127-1c5e-47dd-b589-d5ac8b1aacfd")
    tide_api_url: str = Field(default="https://www.worldtides.info/api/v3")

    # ── IMD Weather API ────────────────────────────────────────
    imd_api_url: str = Field(default="https://api.imd.gov.in/api/v1/current_wx")
    imd_api_key: str = Field(default="")
    imd_auth_token: str = Field(default="")

    # ── Open-Meteo Marine API ──────────────────────────────────
    open_meteo_marine_url: str = Field(default="https://marine-api.open-meteo.com/v1/marine")
    open_meteo_customer_url: str = Field(default="https://customer-marine-api.open-meteo.com/v1/marine")
    open_meteo_api_key: str = Field(default="")

    # ── Risk thresholds ────────────────────────────────────────
    risk_wave_moderate_threshold: float = Field(default=1.0)
    risk_wave_high_threshold: float = Field(default=2.5)
    risk_wind_moderate_threshold: float = Field(default=20.0)
    risk_wind_high_threshold: float = Field(default=40.0)

    # ── Server ─────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


# Singleton
_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
