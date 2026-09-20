"""Google Gemini LLM provider using direct Google AI API."""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.gemini")

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiProvider(LLMProvider):
    """Calls Google Generative Language API (free tier on AI Studio)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.gemini_api_key
        self._model = settings.gemini_model or "gemini-2.0-flash"

    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Send prompt to Gemini API and return generated text."""
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY is not configured")

        url = f"{GEMINI_BASE_URL}/{self._model}:generateContent?key={self._api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.3,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "").strip()
        return ""

    def is_available(self) -> bool:
        return bool(self._api_key)
