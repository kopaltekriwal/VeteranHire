import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Optional

from google import genai

from backend.env_loader import load_project_env


DEFAULT_MODEL = "gemini-2.0-flash"
DEFAULT_REQUEST_DELAY_SECONDS = 3.0
DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 60.0
MAX_RETRIES = 2
MAX_BACKOFF_SECONDS = 30.0

LOGGER = logging.getLogger(__name__)


@dataclass
class KeyState:
    key: str
    key_label: str
    cooldown_until: float = 0.0
    invalid: bool = False

    @property
    def available(self) -> bool:
        return (not self.invalid) and time.monotonic() >= self.cooldown_until


class GeminiRotator:
    def __init__(
        self,
        keys: list[str],
        model_name: str = DEFAULT_MODEL,
        request_delay_seconds: float = DEFAULT_REQUEST_DELAY_SECONDS,
        rate_limit_cooldown_seconds: float = DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        normalized_keys = [key.strip() for key in keys if key and key.strip()]
        if not normalized_keys:
            raise ValueError("At least one Gemini API key is required.")

        self.model_name = model_name
        self.request_delay_seconds = max(0.0, request_delay_seconds)
        self.rate_limit_cooldown_seconds = max(1.0, rate_limit_cooldown_seconds)
        self.logger = logger or LOGGER

        self._keys = [
            KeyState(key=key, key_label=f"key-{index + 1}")
            for index, key in enumerate(normalized_keys)
        ]
        self._lock = threading.RLock()
        self._next_index = 0
        self._last_request_at = 0.0

    @classmethod
    def from_env(
        cls,
        env_var_names: Optional[list[str]] = None,
        model_name: str = DEFAULT_MODEL,
    ) -> "GeminiRotator":
        env_names = env_var_names or [
            "GEMINI_API_KEY_1",
            "GEMINI_API_KEY_2",
            "GEMINI_API_KEY_3",
        ]
        keys = [os.getenv(name, "") for name in env_names]
        return cls(keys=keys, model_name=model_name)

    def get_next_key(self) -> KeyState:
        with self._lock:
            available_key = self._find_available_key()
            if available_key is not None:
                self.logger.info("Using Gemini API %s", available_key.key_label)
                return available_key

            next_available_delay = self._get_next_available_delay()
            if next_available_delay > 0:
                self.logger.warning(
                    "All Gemini API keys are cooling down. Waiting %.2f seconds before retrying.",
                    next_available_delay,
                )

        if next_available_delay > 0:
            time.sleep(next_available_delay)

        with self._lock:
            available_key = self._find_available_key()
            if available_key is None:
                raise RuntimeError("No available Gemini API keys. All keys are exhausted or invalid.")

            self.logger.info("Using Gemini API %s", available_key.key_label)
            return available_key

    def generate_response(self, prompt: str) -> str:
        if not prompt or not prompt.strip():
            raise ValueError("Prompt must not be empty.")

        last_error: Optional[Exception] = None
        backoff_seconds = 1.0

        for attempt in range(1, MAX_RETRIES + 1):
            key_state = self.get_next_key()

            try:
                self._apply_request_delay()
                response = self._generate_with_key(key_state, prompt)
                return response.text or ""
            except Exception as exc:
                last_error = exc
                error_type = self._classify_error(exc)

                if error_type == "rate_limit":
                    self._mark_key_rate_limited(key_state)
                    self.logger.warning(
                        "Gemini API %s was rate-limited. Switching keys. Attempt %s/%s.",
                        key_state.key_label,
                        attempt,
                        MAX_RETRIES,
                    )
                elif error_type == "invalid_key":
                    self._mark_key_invalid(key_state)
                    self.logger.error(
                        "Gemini API %s appears invalid. Removing it from rotation.",
                        key_state.key_label,
                    )
                elif error_type == "network":
                    self.logger.warning(
                        "Network error with Gemini API %s on attempt %s/%s: %s",
                        key_state.key_label,
                        attempt,
                        MAX_RETRIES,
                        exc,
                    )
                else:
                    self.logger.error(
                        "Gemini request failed with %s on attempt %s/%s: %s",
                        key_state.key_label,
                        attempt,
                        MAX_RETRIES,
                        exc,
                    )

                if attempt >= MAX_RETRIES:
                    break

                self.logger.info("Retrying Gemini request in %.2f seconds.", backoff_seconds)
                time.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 2, MAX_BACKOFF_SECONDS)

        self.logger.error("Gemini request failed after %s attempts.", MAX_RETRIES)
        raise RuntimeError(f"Gemini request failed after {MAX_RETRIES} attempts: {last_error}") from last_error

    def _find_available_key(self) -> Optional[KeyState]:
        total_keys = len(self._keys)
        for offset in range(total_keys):
            index = (self._next_index + offset) % total_keys
            key_state = self._keys[index]
            if key_state.available:
                self._next_index = (index + 1) % total_keys
                return key_state
        return None

    def _get_next_available_delay(self) -> float:
        active_cooldowns = [
            max(0.0, key_state.cooldown_until - time.monotonic())
            for key_state in self._keys
            if not key_state.invalid
        ]
        return min(active_cooldowns) if active_cooldowns else 0.0

    def _apply_request_delay(self) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last_request_at
            if elapsed < self.request_delay_seconds:
                time.sleep(self.request_delay_seconds - elapsed)
            self._last_request_at = time.monotonic()

    def _generate_with_key(self, key_state: KeyState, prompt: str):
        client = genai.Client(api_key=key_state.key)
        return client.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )

    def _mark_key_rate_limited(self, key_state: KeyState) -> None:
        with self._lock:
            key_state.cooldown_until = time.monotonic() + self.rate_limit_cooldown_seconds
            self.logger.warning(
                "Marked %s as rate-limited for %.0f seconds.",
                key_state.key_label,
                self.rate_limit_cooldown_seconds,
            )

    def _mark_key_invalid(self, key_state: KeyState) -> None:
        with self._lock:
            key_state.invalid = True

    def _classify_error(self, error: Exception) -> str:
        error_text = str(error).lower()
        if "429" in error_text or "resource_exhausted" in error_text or "rate limit" in error_text:
            return "rate_limit"
        if "api key not valid" in error_text or "invalid api key" in error_text or "permission_denied" in error_text:
            return "invalid_key"
        if "connection" in error_text or "timeout" in error_text or "unavailable" in error_text:
            return "network"
        return "other"


def load_gemini_keys_from_env() -> list[str]:
    load_project_env()
    key_names = [
        "GEMINI_API_KEY",
        "GEMINI_API_KEY_1",
        "GEMINI_API_KEY_2",
        "GEMINI_API_KEY_3",
    ]
    seen_keys = set()
    keys = []

    for key_name in key_names:
        key = os.getenv(key_name, "").strip()
        if key and key not in seen_keys:
            seen_keys.add(key)
            keys.append(key)

    return keys


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    keys = load_gemini_keys_from_env()
    
    keys = load_gemini_keys_from_env()
    print("Loaded Gemini Keys:", keys)
    
    rotator = GeminiRotator(keys)
    print(rotator.generate_response("Explain AI in simple terms"))
