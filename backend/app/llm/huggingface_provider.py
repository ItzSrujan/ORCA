"""Hugging Face Inference API provider."""

from __future__ import annotations

from huggingface_hub import InferenceClient

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider

logger = get_logger("llm.hf")


class HuggingFaceInferenceProvider(LLMProvider):
    """Calls Hugging Face Inference API (serverless or dedicated endpoint)."""

    SERVERLESS_FALLBACKS = [
        "Qwen/Qwen2.5-72B-Instruct",
        "meta-llama/Llama-3.1-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.3",
    ]

    def __init__(self) -> None:
        self._refresh()

    def _refresh(self) -> tuple[InferenceClient, str, str | None, str | None]:
        settings = get_settings()
        self._model = settings.hf_model
        token = settings.hf_token or None
        endpoint_url = settings.hf_endpoint_url or None
        if endpoint_url:
            self._client = InferenceClient(base_url=endpoint_url, token=token, timeout=60)
        else:
            self._client = InferenceClient(model=self._model, token=token, timeout=60)
        return self._client, self._model, token, endpoint_url

    async def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        """Send prompt to HF Inference API and return generated text.

        Supports conversational chat models, dedicated endpoints, and automatic serverless fallbacks.
        """
        client, model, token, endpoint_url = self._refresh()

        messages = [
            {
                "role": "system",
                "content": (
                    "You are ORCA, an operational marine weather, oceanographic, and fishing safety advisor "
                    "for coastal communities and vessel operators. Provide direct, evidence-grounded operational guidance "
                    "using verified telemetry data."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        # 1. Try modern chat_completion on configured model / endpoint
        try:
            chat_res = client.chat_completion(
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
            if "401" in err_str or "unauthorized" in err_str.lower() or "expired" in err_str.lower():
                logger.error("Hugging Face User Access Token is expired or invalid (HTTP 401).")
                raise RuntimeError(
                    "Hugging Face User Access Token is expired or invalid (HTTP 401). "
                    "Please generate a new token at https://huggingface.co/settings/tokens and update HF_TOKEN in backend/.env."
                ) from chat_err

            if "402" in err_str or "depleted" in err_str.lower() or "credits" in err_str.lower():
                logger.error("Hugging Face Inference API monthly credits depleted (HTTP 402).")
                raise RuntimeError(
                    "Hugging Face monthly credits depleted (402 Payment Required). "
                    "Please top up credits on Hugging Face."
                ) from chat_err

            logger.debug("Chat completion error on '%s' (%s), attempting fallback", model, chat_err)

        # 2. Fallback to text_generation for completion-only models
        try:
            response = client.text_generation(
                prompt,
                max_new_tokens=max_tokens,
                temperature=0.3,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                return_full_text=False,
            )
            res_str = response.strip() if isinstance(response, str) else str(response).strip()
            if res_str:
                return res_str
        except Exception as gen_err:
            err_str = str(gen_err)
            if "401" in err_str or "unauthorized" in err_str.lower() or "expired" in err_str.lower():
                raise RuntimeError(
                    "Hugging Face User Access Token is expired or invalid (HTTP 401). "
                    "Please generate a new token at https://huggingface.co/settings/tokens and update HF_TOKEN in backend/.env."
                ) from gen_err
            logger.debug("Text generation error on '%s': %s", model, gen_err)

        # 3. If primary model is not serverless-hosted and has no dedicated endpoint, try serverless fallbacks
        if not endpoint_url:
            for fallback_model in self.SERVERLESS_FALLBACKS:
                if fallback_model.lower() == model.lower():
                    continue
                try:
                    logger.info("Attempting serverless fallback model '%s' on Hugging Face...", fallback_model)
                    fb_client = InferenceClient(model=fallback_model, token=token, timeout=60)
                    fb_res = fb_client.chat_completion(
                        messages=messages,
                        max_tokens=max(max_tokens, 1024),
                        temperature=0.3,
                    )
                    if fb_res.choices:
                        msg = fb_res.choices[0].message
                        content = msg.content or ""
                        if not content and getattr(msg, "reasoning_content", None):
                            content = msg.reasoning_content
                        if content:
                            logger.info("Successfully generated live response using serverless fallback '%s'", fallback_model)
                            return content.strip()
                except Exception as fb_err:
                    fb_err_str = str(fb_err).lower()
                    if "401" in fb_err_str or "unauthorized" in fb_err_str or "expired" in fb_err_str:
                        raise RuntimeError(
                            "Hugging Face User Access Token is expired or invalid (HTTP 401). "
                            "Please generate a new token at https://huggingface.co/settings/tokens and update HF_TOKEN in backend/.env."
                        ) from fb_err
                    logger.debug("Serverless fallback '%s' failed: %s", fallback_model, fb_err)

        raise RuntimeError(
            f"Model '{model}' is not hosted on Hugging Face free Serverless Inference. "
            f"If hosting on a dedicated endpoint, set HF_ENDPOINT_URL in backend/.env. "
            f"For free serverless inference, use a serverless-supported model (e.g. Qwen/Qwen2.5-72B-Instruct or meta-llama/Llama-3.1-8B-Instruct)."
        )

    def is_available(self) -> bool:
        settings = get_settings()
        return bool(settings.hf_token)

