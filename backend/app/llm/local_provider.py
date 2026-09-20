"""Local Transformers pipeline provider (CPU-friendly fallback)."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.local")


class LocalTransformersProvider(LLMProvider):
    """Runs a local Hugging Face model via the transformers pipeline."""

    def __init__(self) -> None:
        settings = get_settings()
        self._model_name = settings.hf_model
        self._pipeline = None  # Lazy-load to avoid import time cost

    def _load_pipeline(self):
        if self._pipeline is None:
            logger.info("Loading local model: %s (this may take a moment)", self._model_name)
            from transformers import pipeline  # type: ignore

            self._pipeline = pipeline(
                "text-generation",
                model=self._model_name,
                device_map="auto",
                torch_dtype="auto",
            )
            logger.info("Local model loaded successfully")

    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Generate text using local transformers pipeline."""
        try:
            self._load_pipeline()
            results = self._pipeline(
                prompt,
                max_new_tokens=max_tokens,
                temperature=0.3,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                return_full_text=False,
            )
            text = results[0]["generated_text"] if results else ""
            return text.strip()
        except Exception as exc:
            logger.error("Local pipeline error: %s", exc)
            raise

    def is_available(self) -> bool:
        return bool(self._model_name)
