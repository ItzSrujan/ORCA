"""OpenRouter LLM provider."""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.openrouter")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(LLMProvider):
    """Calls OpenRouter Chat Completions API with any specified model."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.openrouter_api_key
        self._model = settings.openrouter_model or "google/gemini-2.0-flash-exp:free"

    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Send prompt to OpenRouter and return generated text."""
        if not self._api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured")

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": "https://github.com/orca-marine/orca",
            "X-Title": "ORCA Marine Safety",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are ORCA, an operational marine weather, oceanographic, and fishing safety "
                        "decision-support advisor for coastal communities and fishermen. Be concise, direct, "
                        "actionable, and cite real numbers."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.4,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "")
            return text.strip()
        return ""

    def is_available(self) -> bool:
        return bool(self._api_key)
