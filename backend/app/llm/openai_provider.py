"""OpenAI / compatible LLM provider (supports Groq, Ollama, OpenAI)."""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.openai")


class OpenAIProvider(LLMProvider):
    """Calls OpenAI-compatible /chat/completions endpoint."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.openai_api_key
        self._base_url = (settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
        self._model = settings.openai_model or "gpt-4o-mini"

    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are ORCA, an operational marine safety and fishing advisor for coastal communities."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.4,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "")
            return text.strip()
        return ""

    def is_available(self) -> bool:
        return bool(self._api_key or (self._base_url and "localhost" in self._base_url))
