import json
from typing import Any, Optional

from backend.gemini_config import FALLBACK_GEMINI_MODELS
from backend.gemini_rotator import GeminiRotator, load_gemini_keys_from_env


class BatchRecommendationService:
    def __init__(self, api_key: Optional[str], model_name: str):
        self.model_name = model_name
        self.fallback_model_names = [name for name in FALLBACK_GEMINI_MODELS if name != model_name]
        configured_keys = [key for key in load_gemini_keys_from_env() if key]
        if not configured_keys and api_key:
            configured_keys = [api_key]
        self.rotator = GeminiRotator(keys=configured_keys, model_name=model_name) if configured_keys else None

    @property
    def is_configured(self) -> bool:
        return self.rotator is not None

    def recommend_jobs(self, resume_data: dict, jobs: list[dict]) -> list[dict]:
        if not self.rotator:
            raise RuntimeError("Gemini API key is not configured.")

        compact_resume_data = self._compact_resume(resume_data)
        compact_jobs = self._compact_jobs(jobs)

        prompt = f"""
The candidate is an Indian ex-serviceman. Map military experience to ALL relevant civilian domains including logistics, operations, HR, training, administration, security, IT support, sales, and coaching roles. Do not limit to logistics roles.
Consider transferable skills such as leadership, discipline, communication, training ability, and technical exposure.

Compare the resume summary against all listed jobs and rank them by fit.

Return ONLY valid JSON in this exact format:
{{
  "recommendations": [
    {{
      "id": 0,
      "title": "",
      "sector": "",
      "match_score": 0,
      "matched_skills": [],
      "missing_skills": [],
      "reasoning": ""
    }}
  ]
}}

Rules:
- Score every job from 0 to 100.
- Return the exact id, exact title, and exact sector from the provided job entry.
- Do not invent, rename, or swap job titles, ids, or sectors.
- matched_skills should reflect resume-job overlap.
- missing_skills should highlight meaningful gaps.
- reasoning should be concise.
- Do not include markdown.
- Do not include extra keys.

Resume summary:
{json.dumps(compact_resume_data, ensure_ascii=True)}

Jobs:
{json.dumps(compact_jobs, ensure_ascii=True)}
"""

        response_text = self._generate_content(prompt)
        return self._parse_response(response_text)

    def _generate_content(self, prompt: str) -> str:
        last_error: Optional[Exception] = None

        for model_name in [self.model_name, *self.fallback_model_names]:
            try:
                self.rotator.model_name = model_name
                self.model_name = model_name
                return self.rotator.generate_response(prompt)
            except Exception as exc:
                last_error = exc

        raise RuntimeError(f"Gemini request failed for all configured models: {last_error}") from last_error

    def _parse_response(self, response_text: str) -> list[dict]:
        cleaned_text = self._extract_json(response_text)

        try:
            payload = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            raise ValueError("AI recommendations returned invalid JSON. Please try again.") from exc

        recommendations = payload.get("recommendations", [])
        if not isinstance(recommendations, list):
            return []

        normalized: list[dict] = []
        for item in recommendations:
            if not isinstance(item, dict):
                continue

            normalized.append(
                {
                    "id": self._to_int(item.get("id")),
                    "title": str(item.get("title", "")).strip(),
                    "sector": str(item.get("sector", "")).strip(),
                    "match_score": self._to_score(item.get("match_score")),
                    "matched_skills": self._to_string_list(item.get("matched_skills")),
                    "missing_skills": self._to_string_list(item.get("missing_skills")),
                    "reasoning": str(item.get("reasoning", "")).strip(),
                }
            )

        return normalized

    def _extract_json(self, response_text: str) -> str:
        start = response_text.find("{")
        end = response_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return response_text[start : end + 1]
        return response_text.strip()

    def _compact_resume(self, resume_data: dict) -> dict:
        return {
            "skills": self._limit_list(resume_data.get("skills", []), 15),
            "mapped_skills": self._limit_list(resume_data.get("mapped_skills", []), 15),
            "experience": self._compact_experience(resume_data.get("experience", [])),
        }

    def _compact_experience(self, experience: Any) -> list[dict[str, str]]:
        if not isinstance(experience, list):
            return []

        compact_items = []
        for item in experience[:3]:
            if isinstance(item, dict):
                compact_items.append(
                    {
                        "title": str(item.get("title", "")).strip()[:80],
                        "description": str(item.get("description", "")).strip()[:220],
                    }
                )
            elif str(item).strip():
                compact_items.append({"title": "", "description": str(item).strip()[:220]})

        return compact_items

    def _compact_jobs(self, jobs: list[dict]) -> list[dict]:
        return [
            {
                "id": job.get("id", 0),
                "title": str(job.get("title", "")).strip(),
                "sector": str(job.get("sector", "")).strip(),
                "domain": str(job.get("domain", "")).strip(),
                "description": str(job.get("description", "")).strip()[:320],
                "level": str(job.get("level", "")).strip(),
            }
            for job in jobs
        ]

    def _limit_list(self, value: Any, limit: int) -> list[str]:
        if not isinstance(value, list):
            return []

        return [str(item).strip() for item in value if str(item).strip()][:limit]

    def _to_score(self, value: Any) -> int:
        try:
            score = int(round(float(value)))
        except (TypeError, ValueError):
            return 0

        return max(0, min(99, score))

    def _to_int(self, value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    def _to_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []

        return [str(item).strip() for item in value if str(item).strip()]
