"""Abstract LLM provider interface and factory."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("llm")


class LLMProvider(ABC):
    """Base class for all LLM providers."""

    @abstractmethod
    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Generate text from a prompt. Returns raw text."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check whether this provider is configured and reachable."""
        ...


def get_llm_provider() -> LLMProvider:
    """Factory — returns the appropriate LLM provider based on configuration.

    Supports OpenRouter, Hugging Face, OpenAI/Groq/Ollama, or local transformers.
    """
    settings = get_settings()
    provider_name = settings.llm_provider.lower().strip()

    # Explicit or auto OpenRouter
    if provider_name == "openrouter" or (provider_name == "auto" and settings.openrouter_api_key):
        from app.llm.openrouter_provider import OpenRouterProvider

        logger.info("Using OpenRouter provider (model=%s)", settings.openrouter_model)
        return OpenRouterProvider()

    # Explicit or auto OpenAI / Groq / Ollama
    if provider_name == "openai" or (provider_name == "auto" and settings.openai_api_key):
        from app.llm.openai_provider import OpenAIProvider

        logger.info("Using OpenAI-compatible provider (model=%s)", settings.openai_model)
        return OpenAIProvider()
    # Explicit or auto Gemini
    if provider_name == "gemini" or (provider_name == "auto" and settings.gemini_api_key):
        from app.llm.gemini_provider import GeminiProvider

        logger.info("Using Google Gemini provider (model=%s)", settings.gemini_model)
        return GeminiProvider()

    # Local transformers
    if provider_name == "local":
        from app.llm.local_provider import LocalTransformersProvider

        logger.info("Using local Transformers pipeline provider")
        return LocalTransformersProvider()

    # Hugging Face Inference API
    from app.llm.huggingface_provider import HuggingFaceInferenceProvider

    logger.info("Using Hugging Face Inference API provider (model=%s)", settings.hf_model)
    return HuggingFaceInferenceProvider()
