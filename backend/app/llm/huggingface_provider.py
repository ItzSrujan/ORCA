"""Hugging Face Inference API provider."""

from __future__ import annotations

from huggingface_hub import InferenceClient

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.hf")


class HuggingFaceInferenceProvider(LLMProvider):
    """Calls Hugging Face Inference API (serverless or dedicated endpoint)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._model = settings.hf_model
        token = settings.hf_token or None
        self._client = InferenceClient(model=self._model, token=token, timeout=60)

    async def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        """Send prompt to HF Inference API and return generated text.

        Supports both modern conversational chat models (e.g. zai-org/GLM-5.3)
        and legacy text-generation models.
        """
        # 1. Try modern chat_completion (required for conversational/reasoning models like GLM-5.3)
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are ORCA, an operational marine weather, oceanographic, and fishing safety advisor "
                        "for coastal communities and vessel operators."
                    ),
                },
                {"role": "user", "content": prompt},
            ]
            chat_res = self._client.chat_completion(
                messages=messages,
                max_tokens=max(max_tokens, 1024),
                temperature=0.3,
            )
            if chat_res.choices:
                msg = chat_res.choices[0].message
                content = msg.content or ""
                if not content and getattr(msg, "reasoning_content", None):
                    content = msg.reasoning_content
                if content:
                    return content.strip()
        except Exception as chat_err:
            err_str = str(chat_err)
            if "402" in err_str or "depleted" in err_str.lower() or "credits" in err_str.lower():
                logger.error(
                    "Hugging Face Inference API monthly credits depleted (402 Payment Required). "
                    "Please top up credits on Hugging Face or switch to OpenRouter/OpenAI provider."
                )
                raise RuntimeError(
                    "Hugging Face monthly credits depleted (402 Payment Required). "
                    "Top up credits or configure OPENROUTER_API_KEY."
                ) from chat_err

            logger.debug("Chat completion error (%s), attempting text_generation fallback", chat_err)

        # 2. Fallback to legacy text_generation for completion-only models
        try:
            response = self._client.text_generation(
                prompt,
                max_new_tokens=max_tokens,
                temperature=0.3,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                return_full_text=False,
            )
            return response.strip() if isinstance(response, str) else str(response).strip()
        except Exception as exc:
            logger.error("HF Inference API error: %s", exc)
            raise


    def is_available(self) -> bool:
        settings = get_settings()
        return bool(self._model and settings.hf_token)
