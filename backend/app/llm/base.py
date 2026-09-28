"""Abstract LLM provider interface and factory — Hugging Face Only."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("llm")


class LLMProvider(ABC):
    """Base class for LLM providers."""

    @abstractmethod
    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Generate text from a prompt. Returns raw text."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check whether this provider is configured and reachable."""
        ...


def get_llm_provider() -> LLMProvider:
    """Factory — returns the Hugging Face Inference API provider."""
    from app.llm.huggingface_provider import HuggingFaceInferenceProvider

    settings = get_settings()
    logger.info("Using Hugging Face Inference API provider (model=%s)", settings.hf_model)
    return HuggingFaceInferenceProvider()
