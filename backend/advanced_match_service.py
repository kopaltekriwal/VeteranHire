import json
import os
import re
from typing import Any, Optional

from backend.gemini_config import FALLBACK_GEMINI_MODELS, get_gemini_model
from backend.gemini_rotator import GeminiRotator, load_gemini_keys_from_env


AdvancedMatchResult = dict[str, Any]


class AdvancedMatchService:
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

    def advanced_match(self, resume_data: dict, job_description: str) -> AdvancedMatchResult:
        if not self.rotator:
            raise RuntimeError("Gemini API key is not configured.")

        resume_summary = self._build_resume_summary(resume_data)

        prompt = f"""
The candidate is an Indian ex-serviceman. Map military experience to ALL relevant civilian domains including logistics, operations, HR, training, administration, security, IT support, sales, and coaching roles. Do not limit to logistics roles.
Consider transferable skills such as leadership, discipline, communication, training ability, and technical exposure.

Compare this resume and job description and return structured JSON with match score, matched skills, missing skills, and explanation.

Return ONLY valid JSON in this exact format:
{{
  "match_score": 0,
  "matched_skills": [],
  "missing_skills": [],
  "reasoning": ""
}}

Rules:
- match_score must be a number from 0 to 100.
- matched_skills must include relevant skills found in both the resume and job description, including semantically similar skills.
- missing_skills must include important job requirements not clearly supported by the resume.
- reasoning must be concise and explain why the candidate is or is not a strong match.
- Do not include markdown.
- Do not include extra keys.

Resume summary:
{resume_summary}

Job description:
{job_description}
"""

        response_text = self._generate_content(prompt)
        return self._parse_match_response(response_text)

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

    def _build_resume_summary(self, resume_data: dict) -> str:
        return json.dumps(
            {
                "skills": resume_data.get("skills", []),
                "experience": resume_data.get("experience", []),
                "mapped_skills": resume_data.get("mapped_skills", []),
            },
            ensure_ascii=True,
        )

    def _parse_match_response(self, response_text: str) -> AdvancedMatchResult:
        cleaned_text = self._extract_json(response_text)

        try:
            parsed_response = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            raise ValueError("AI matching returned invalid JSON. Please try again.") from exc

        return {
            "match_score": self._to_score(parsed_response.get("match_score")),
            "matched_skills": self._to_string_list(parsed_response.get("matched_skills")),
            "missing_skills": self._to_string_list(parsed_response.get("missing_skills")),
            "reasoning": str(parsed_response.get("reasoning", "")).strip(),
        }

    def _extract_json(self, response_text: str) -> str:
        match = re.search(r"\{.*\}", response_text.strip(), re.DOTALL)
        return match.group(0) if match else response_text.strip()

    def _to_score(self, value: Any) -> float:
        try:
            score = float(value)
        except (TypeError, ValueError):
            return 0.0

        return max(0.0, min(99.0, score))

    def _to_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []

        return [str(item).strip() for item in value if str(item).strip()]


def advanced_match(resume_data: dict, job_description: str) -> AdvancedMatchResult:
    service = AdvancedMatchService(
        api_key=os.getenv("GEMINI_API_KEY"),
        model_name=get_gemini_model(),
    )
    return service.advanced_match(resume_data=resume_data, job_description=job_description)
