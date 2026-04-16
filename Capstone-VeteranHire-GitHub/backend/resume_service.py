import json
import re
from typing import Any, Optional

from backend.gemini_config import FALLBACK_GEMINI_MODELS
from backend.gemini_rotator import GeminiRotator, load_gemini_keys_from_env


ExperienceItem = dict[str, str]
ResumeAnalysis = dict[str, Any]


class ResumeAnalysisService:
    def __init__(self, api_key: Optional[str], model_name: str):
        self.model_name = model_name
        self.fallback_model_names = [name for name in FALLBACK_GEMINI_MODELS if name != model_name]
        configured_keys = [key for key in load_gemini_keys_from_env() if key]
        if not configured_keys and api_key:
            configured_keys = [api_key]
        self.rotator = GeminiRotator(keys=configured_keys, model_name=model_name) if configured_keys else None

    def analyze_resume(self, resume_text: str) -> ResumeAnalysis:
        if not self.rotator:
            raise RuntimeError("Gemini API key is not configured.")

        prompt = f"""
Extract structured resume insights in JSON format:

{{
  "skills": [],
  "experience": [
    {{
      "title": "",
      "description": ""
    }}
  ],
  "mapped_skills": []
}}

Rules:
- Return ONLY JSON
- Do NOT return strings for objects
- Ensure experience is a list of objects, not strings
- Normalize skills to concise lowercase canonical names (for example: "inventory management", "technical support")
- Avoid duplicates and synonyms in the skills/mapped_skills output

Resume:
{resume_text}
"""

        text_output = self._generate_content(prompt)

        return self._parse_json_response(text_output)

    def analyze_resume_hybrid(self, resume_text: str) -> dict[str, Any]:
        if not self.rotator:
            raise RuntimeError("Gemini API key is not configured.")

        prompt = f"""
You are an expert career recommendation engine for ex-servicemen transitioning to civilian jobs.
Analyze this resume and return ONLY valid JSON in this exact schema:

{{
  "skills": [],
  "roles": [
    {{
      "title": "",
      "match_score": 0,
      "skills_aligned": []
    }}
  ],
  "skill_gap": {{
    "missing_skills": []
  }},
  "courses": [
    {{
      "name": "",
      "platform": "",
      "link": ""
    }}
  ]
}}

Rules:
- Return only JSON, no markdown.
- Normalize skills to concise canonical names.
- roles must be realistic civilian roles inferred from experience.
- match_score must be integer from 0 to 99.
- skill_gap.missing_skills should contain meaningful missing skills.
- courses should directly address missing skills.
- Max 8 roles, max 10 courses.

Resume:
{resume_text}
"""

        text_output = self._generate_content(prompt)
        return self._parse_hybrid_response(text_output)

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

    def _parse_json_response(self, response_text: str) -> ResumeAnalysis:
        cleaned_text = self._extract_json(response_text)

        try:
            parsed_response = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            raise ValueError("Gemini returned invalid JSON. Try again or use a shorter resume.") from exc

        return {
            "skills": self._to_string_list(parsed_response.get("skills")),
            "experience": self._to_experience_list(parsed_response.get("experience")),
            "mapped_skills": self._to_string_list(parsed_response.get("mapped_skills")),
        }

    def _parse_hybrid_response(self, response_text: str) -> dict[str, Any]:
        cleaned_text = self._extract_json(response_text)

        try:
            parsed_response = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            raise ValueError("Gemini hybrid output returned invalid JSON. Try again.") from exc

        roles = []
        raw_roles = parsed_response.get("roles", [])
        if isinstance(raw_roles, list):
            for role in raw_roles[:8]:
                if not isinstance(role, dict):
                    continue

                title = str(role.get("title", "")).strip()
                if not title:
                    continue

                try:
                    score = int(round(float(role.get("match_score", 0))))
                except (TypeError, ValueError):
                    score = 0

                roles.append(
                    {
                        "title": title,
                        "match_score": max(0, min(99, score)),
                        "skills_aligned": self._to_string_list(role.get("skills_aligned")),
                    }
                )

        skill_gap = parsed_response.get("skill_gap", {})
        if not isinstance(skill_gap, dict):
            skill_gap = {}

        missing_skills = self._to_string_list(skill_gap.get("missing_skills"))

        courses = []
        raw_courses = parsed_response.get("courses", [])
        if isinstance(raw_courses, list):
            for course in raw_courses[:10]:
                if not isinstance(course, dict):
                    continue

                name = str(course.get("name", "")).strip()
                platform = str(course.get("platform", "")).strip()
                link = str(course.get("link", "")).strip()
                if not name:
                    continue

                courses.append(
                    {
                        "name": name,
                        "provider": platform or "Google Search",
                        "link": link,
                    }
                )

        return {
            "skills": self._to_string_list(parsed_response.get("skills")),
            "roles": roles,
            "skill_gap": {
                "missing_skills": missing_skills,
                "recommended_courses": courses,
            },
            "courses": courses,
        }

    def _extract_json(self, response_text: str) -> str:
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        return match.group(0) if match else response_text

    def _to_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    def _to_experience_list(self, value: Any) -> list[ExperienceItem]:
        if not isinstance(value, list):
            return []

        experience_items: list[ExperienceItem] = []

        for item in value:
            if not isinstance(item, dict):
                continue

            title = str(item.get("title", "")).strip()
            description = str(item.get("description", "")).strip()

            if title or description:
                experience_items.append(
                    {
                        "title": title,
                        "description": description,
                    }
                )

        return experience_items
