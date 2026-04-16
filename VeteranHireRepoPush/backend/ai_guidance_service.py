import json
from typing import Any, Optional


_guidance_service = None


QUERY_PROMPTS = {
    "improve_profile": "Given this candidate profile, suggest 3 ways to improve their resume for better job matching.",
    "career_path": "Suggest suitable career paths in India for this ex-serviceman based on skills.",
    "increase_match": "Suggest specific skills or certifications to increase match score for this job.",
    "general_advice": "Give practical career advice for this Indian ex-serviceman based on their resume profile.",
}


def configure_guidance_service(gemini_service) -> None:
    global _guidance_service
    _guidance_service = gemini_service


def get_guidance(resume_data: dict, top_job: Optional[dict], query_type: str) -> str:
    if query_type not in QUERY_PROMPTS:
        raise ValueError("Invalid guidance query type.")

    if _guidance_service is None:
        raise RuntimeError("AI guidance service is not configured.")

    prompt = _build_prompt(resume_data, top_job, query_type)
    return _guidance_service._generate_content(prompt).strip()


def _build_prompt(resume_data: dict, top_job: Optional[dict], query_type: str) -> str:
    top_job = top_job or {}
    compact_resume = {
        "skills": _limit_list(resume_data.get("skills", []), 8),
        "mapped_skills": _limit_list(resume_data.get("mapped_skills", []), 8),
        "experience": _compact_experience(resume_data.get("experience", [])),
    }
    compact_job = {
        "title": top_job.get("title", ""),
        "sector": top_job.get("sector", ""),
        "match_score": top_job.get("match_score", ""),
        "fit": top_job.get("fit", ""),
        "missing_skills": _limit_list(top_job.get("missing_skills", top_job.get("skill_gap", [])), 6),
    }

    return f"""
{QUERY_PROMPTS[query_type]}
Keep answer under 100 words. Use bullet points.
Tailor suggestions specifically to this candidate's skills and experience.
If no top job is provided, give resume-based guidance only.

Candidate:
{json.dumps(compact_resume, ensure_ascii=True)}

Top job:
{json.dumps(compact_job, ensure_ascii=True)}
"""


def _limit_list(items: Any, limit: int) -> list[str]:
    if not isinstance(items, list):
        return []

    return [str(item).strip() for item in items if str(item).strip()][:limit]


def _compact_experience(experience: Any) -> list[dict[str, str]]:
    if not isinstance(experience, list):
        return []

    compact_items = []
    for item in experience[:2]:
        if isinstance(item, dict):
            compact_items.append(
                {
                    "title": str(item.get("title", "")).strip()[:80],
                    "description": str(item.get("description", "")).strip()[:180],
                }
            )
        elif str(item).strip():
            compact_items.append({"title": "", "description": str(item).strip()[:180]})

    return compact_items
