import os

from backend.env_loader import load_project_env


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
FALLBACK_GEMINI_MODELS = ("gemini-2.5-flash-lite",)


def get_gemini_model() -> str:
    load_project_env()
    return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
