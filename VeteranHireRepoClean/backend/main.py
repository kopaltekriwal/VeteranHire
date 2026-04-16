import hashlib
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.advanced_match_service import AdvancedMatchService
from backend.ai_guidance_service import configure_guidance_service, get_guidance
from backend.course_service import get_courses_for_skills
from backend.gemini_config import get_gemini_model
from backend.job_service import get_all_jobs
from backend.resume_parser import ResumeParserError, extract_resume_text
from backend.resume_service import ResumeAnalysisService


MAX_MATCH_SCORE = 99
TOP_RESULTS_PER_SECTOR = 6
MIN_RECOMMENDATION_SCORE = 40
RESUME_CACHE_SIZE = 64

SKILL_KEYWORDS = {
    "administration",
    "communication",
    "coaching",
    "compliance",
    "coordination",
    "data analysis",
    "discipline",
    "emergency response",
    "erp",
    "hr",
    "inventory management",
    "leadership",
    "learning",
    "logistics",
    "maintenance",
    "mentoring",
    "networking",
    "operations",
    "planning",
    "procurement",
    "reporting",
    "risk management",
    "safety",
    "sales",
    "security",
    "stakeholder management",
    "supply chain",
    "supervision",
    "team management",
    "technical support",
    "training",
    "transport",
    "troubleshooting",
    "vendor management",
    "warehouse operations",
}

DOMAIN_TO_SKILLS = {
    "logistics": ["logistics", "supply chain", "inventory management", "transport"],
    "operations": ["operations", "planning", "coordination", "reporting"],
    "hr": ["hr", "communication", "team management", "training"],
    "security": ["security", "risk management", "emergency response", "compliance"],
    "it": ["technical support", "networking", "troubleshooting", "data analysis"],
    "coaching": ["coaching", "mentoring", "discipline", "training"],
    "sales": ["sales", "communication", "stakeholder management", "reporting"],
    "administration": ["administration", "coordination", "planning", "reporting"],
}


class MatchResponse(BaseModel):
    match_score: int = Field(..., ge=0, le=MAX_MATCH_SCORE)
    fit: str
    matched_skills: list[str]
    missing_skills: list[str]
    reasoning: str


class JobRecommendation(BaseModel):
    title: str
    sector: str
    match_score: int = Field(..., ge=0, le=MAX_MATCH_SCORE)
    fit: str
    link: str
    location: str
    salary: str
    level: str
    matched_skills: list[str]
    missing_skills: list[str]
    skill_gap: list[str]
    recommended_courses: list[dict[str, str]]
    reasoning: str


class JobRecommendationsResponse(BaseModel):
    Government: list[JobRecommendation]
    Private: list[JobRecommendation]
    resume_data: dict = Field(default_factory=dict)


class AIGuidanceRequest(BaseModel):
    resume_data: dict
    top_job: dict = Field(default_factory=dict)
    query_type: str


class AIGuidanceResponse(BaseModel):
    response: str


class ResumeAnalysisRequest(BaseModel):
    resume_text: str = Field(..., min_length=10)


class ExperienceItem(BaseModel):
    title: str
    description: str


class ResumeAnalysisResponse(BaseModel):
    skills: list[str]
    experience: list[ExperienceItem]
    mapped_skills: list[str]


class HealthResponse(BaseModel):
    status: str
    gemini_configured: bool


app = FastAPI(
    title="VeteranHire API",
    description="AI-powered veteran-to-job matching backend using Gemini.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

advanced_match_service = AdvancedMatchService(api_key=os.getenv("GEMINI_API_KEY"), model_name=get_gemini_model())
resume_analysis_service = ResumeAnalysisService(api_key=os.getenv("GEMINI_API_KEY"), model_name=get_gemini_model())
configure_guidance_service(advanced_match_service)

_resume_cache_lock = threading.Lock()
_resume_analysis_cache: dict[str, dict] = {}


@app.on_event("startup")
def preload_datasets() -> None:
    get_all_jobs()


@app.get("/", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="VeteranHire backend is running",
        gemini_configured=resume_analysis_service.rotator is not None,
    )


def _make_resume_cache_key(filename: str, file_bytes: bytes) -> str:
    digest = hashlib.sha256()
    digest.update((filename or "").encode("utf-8", errors="ignore"))
    digest.update(file_bytes)
    return digest.hexdigest()


def _get_cached_resume_analysis(cache_key: str) -> Optional[dict]:
    with _resume_cache_lock:
        return _resume_analysis_cache.get(cache_key)


def _cache_resume_analysis(cache_key: str, resume_data: dict) -> None:
    with _resume_cache_lock:
        _resume_analysis_cache[cache_key] = resume_data
        while len(_resume_analysis_cache) > RESUME_CACHE_SIZE:
            oldest_key = next(iter(_resume_analysis_cache))
            _resume_analysis_cache.pop(oldest_key, None)


async def process_resume(file: UploadFile) -> dict:
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="A resume file is required.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded resume file is empty.")

    cache_key = _make_resume_cache_key(file.filename, file_bytes)
    cached_resume_data = _get_cached_resume_analysis(cache_key)
    if cached_resume_data is not None:
        return cached_resume_data

    try:
        resume_text = extract_resume_text(file.filename, file_bytes)
    except ResumeParserError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read the uploaded resume: {exc}") from exc

    try:
        resume_data = resume_analysis_service.analyze_resume(resume_text)
        _cache_resume_analysis(cache_key, resume_data)
        return resume_data
    except RuntimeError as exc:
        status_code = 500 if "API key is not configured" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Resume analysis failed: {exc}",
        ) from exc


def _normalize_skill(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _title_case_skill(skill: str) -> str:
    return " ".join(part.capitalize() for part in skill.split())


def _extract_phrase_keywords(text: str) -> set[str]:
    normalized = _normalize_skill(text)
    found = set()

    for keyword in SKILL_KEYWORDS:
        if keyword in normalized:
            found.add(keyword)

    return found


def _build_resume_profile(resume_data: dict) -> dict:
    resume_skills = {
        _normalize_skill(skill)
        for skill in [*resume_data.get("skills", []), *resume_data.get("mapped_skills", [])]
        if _normalize_skill(skill)
    }

    experience_blob = " ".join(
        f"{item.get('title', '')} {item.get('description', '')}"
        for item in resume_data.get("experience", [])
        if isinstance(item, dict)
    )
    resume_blob = _normalize_skill(
        " ".join(
            [
                " ".join(resume_data.get("skills", [])),
                " ".join(resume_data.get("mapped_skills", [])),
                experience_blob,
            ]
        )
    )

    resume_skills.update(_extract_phrase_keywords(resume_blob))

    return {
        "skills": resume_skills,
        "blob": resume_blob,
        "experience_count": len(resume_data.get("experience", [])),
    }


def get_fit_label(match_score: int) -> str:
    if match_score >= 80:
        return "High Fit"
    if match_score >= 60:
        return "Medium Fit"
    return "Low Fit"


def detect_rank_level(resume_data: dict) -> str:
    resume_blob = " ".join(
        [
            " ".join(resume_data.get("skills", [])),
            " ".join(resume_data.get("mapped_skills", [])),
            " ".join(
                f"{item.get('title', '')} {item.get('description', '')}"
                for item in resume_data.get("experience", [])
                if isinstance(item, dict)
            ),
        ]
    ).lower()

    if "officer" in resume_blob:
        return "Officer"
    if "jco" in resume_blob:
        return "Mid"
    if "sepoy" in resume_blob:
        return "Entry"
    return ""


def build_match_response(match_result: dict) -> MatchResponse:
    match_score = int(round(float(match_result.get("match_score", 0))))
    match_score = min(match_score, MAX_MATCH_SCORE)

    return MatchResponse(
        match_score=match_score,
        fit=get_fit_label(match_score),
        matched_skills=match_result.get("matched_skills", []),
        missing_skills=match_result.get("missing_skills", []),
        reasoning=match_result.get("reasoning", ""),
    )


def _extract_job_skill_requirements(job: dict) -> set[str]:
    domain = _normalize_skill(job.get("domain", ""))
    title = _normalize_skill(job.get("title", ""))
    description = _normalize_skill(job.get("description", ""))

    skills = set(DOMAIN_TO_SKILLS.get(domain, []))
    skills.update(_extract_phrase_keywords(title))
    skills.update(_extract_phrase_keywords(description))

    if not skills and domain:
        skills.add(domain)

    return skills


def _skill_matches(skill: str, resume_skills: set[str]) -> bool:
    for resume_skill in resume_skills:
        if skill == resume_skill or skill in resume_skill or resume_skill in skill:
            return True
    return False


def _analyze_skill_gap(missing_skills: list[str]) -> dict[str, list]:
    normalized_missing = []
    seen = set()

    for skill in missing_skills:
        clean_skill = _normalize_skill(skill)
        if clean_skill and clean_skill not in seen:
            seen.add(clean_skill)
            normalized_missing.append(_title_case_skill(clean_skill))

    recommended_courses = get_courses_for_skills(normalized_missing) if normalized_missing else []

    return {
        "missing_skills": normalized_missing,
        "recommended_courses": recommended_courses,
    }


def _score_job(job: dict, resume_profile: dict, detected_rank: str) -> dict:
    resume_skills: set[str] = resume_profile["skills"]
    required_skills = _extract_job_skill_requirements(job)

    matched_skills = sorted(_title_case_skill(skill) for skill in required_skills if _skill_matches(skill, resume_skills))
    missing_skills = sorted(_title_case_skill(skill) for skill in required_skills if not _skill_matches(skill, resume_skills))

    required_count = max(1, len(required_skills))
    coverage = len(matched_skills) / required_count

    experience_bonus = min(resume_profile["experience_count"] * 4, 12)
    breadth_bonus = min(len(resume_skills), 10)
    raw_score = int(round((coverage * 72) + experience_bonus + breadth_bonus))

    if len(matched_skills) == 0 and len(resume_skills) > 0:
        raw_score = max(raw_score, 25)

    if detected_rank and str(job.get("level", "")).strip() == detected_rank:
        raw_score += 8

    match_score = max(0, min(MAX_MATCH_SCORE, raw_score))

    skill_gap = _analyze_skill_gap(missing_skills)
    reasoning = (
        f"Matched {len(matched_skills)} of {required_count} key job skills "
        f"with {len(skill_gap['missing_skills'])} identified gaps."
    )

    return {
        "match_score": match_score,
        "matched_skills": matched_skills,
        "skill_gap": skill_gap,
        "reasoning": reasoning,
    }


def _build_job_recommendation(job: dict, resume_profile: dict, detected_rank: str) -> Optional[JobRecommendation]:
    scored = _score_job(job, resume_profile, detected_rank)
    if scored["match_score"] < MIN_RECOMMENDATION_SCORE:
        return None

    return JobRecommendation(
        title=str(job.get("title", "")).strip(),
        sector=str(job.get("sector", "")).strip(),
        match_score=scored["match_score"],
        fit=get_fit_label(scored["match_score"]),
        link=str(job.get("link", "")).strip(),
        location=str(job.get("location", "")).strip(),
        salary=str(job.get("salary", "")).strip(),
        level=str(job.get("level", "")).strip(),
        matched_skills=scored["matched_skills"],
        missing_skills=scored["skill_gap"]["missing_skills"],
        skill_gap=scored["skill_gap"]["missing_skills"],
        recommended_courses=scored["skill_gap"]["recommended_courses"],
        reasoning=scored["reasoning"],
    )


def recommend_jobs_from_resume(resume_data: dict) -> JobRecommendationsResponse:
    detected_rank = detect_rank_level(resume_data)
    jobs = get_all_jobs()
    resume_profile = _build_resume_profile(resume_data)

    grouped_results: dict[str, list[JobRecommendation]] = {
        "Government": [],
        "Private": [],
    }

    max_workers = min(16, max(4, os.cpu_count() or 4))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        recommendations = list(
            executor.map(
                lambda job: _build_job_recommendation(job, resume_profile, detected_rank),
                jobs,
            )
        )

    for recommendation in recommendations:
        if recommendation is None:
            continue

        if recommendation.sector in grouped_results:
            grouped_results[recommendation.sector].append(recommendation)

    for sector in grouped_results:
        grouped_results[sector] = sorted(
            grouped_results[sector],
            key=lambda item: item.match_score,
            reverse=True,
        )[:TOP_RESULTS_PER_SECTOR]

    return JobRecommendationsResponse(**grouped_results, resume_data=resume_data)


@app.post("/match", response_model=MatchResponse)
async def match_veteran_to_job(
    resume_file: UploadFile = File(...),
    job_description: str = Form(...),
) -> MatchResponse:
    if len(job_description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Job description must be at least 10 characters long.")

    try:
        resume_data = await process_resume(resume_file)
        match_result = advanced_match_service.advanced_match(resume_data, job_description.strip())
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except RuntimeError as exc:
        status_code = 500 if "API key is not configured" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI matching failed: {exc}",
        ) from exc

    return build_match_response(match_result)


@app.post("/recommend_jobs", response_model=JobRecommendationsResponse)
async def recommend_jobs(resume_file: UploadFile = File(...)) -> JobRecommendationsResponse:
    try:
        resume_data = await process_resume(resume_file)
        return recommend_jobs_from_resume(resume_data)
    except HTTPException:
        raise
    except RuntimeError as exc:
        status_code = 500 if "API key is not configured" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Job recommendation failed: {exc}",
        ) from exc


@app.post("/parse_resume", response_model=ResumeAnalysisResponse)
async def parse_resume(resume_file: UploadFile = File(...)) -> ResumeAnalysisResponse:
    resume_data = await process_resume(resume_file)
    return ResumeAnalysisResponse(**resume_data)


@app.post("/ai_guidance", response_model=AIGuidanceResponse)
def ai_guidance(request: AIGuidanceRequest) -> AIGuidanceResponse:
    try:
        guidance = get_guidance(
            resume_data=request.resume_data,
            top_job=request.top_job,
            query_type=request.query_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        status_code = 500 if "API key is not configured" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI guidance failed: {exc}",
        ) from exc

    return AIGuidanceResponse(response=guidance)


@app.post("/analyze_resume", response_model=ResumeAnalysisResponse)
def analyze_resume(request: ResumeAnalysisRequest) -> ResumeAnalysisResponse:
    try:
        analysis = resume_analysis_service.analyze_resume(request.resume_text)
    except RuntimeError as exc:
        status_code = 500 if "API key is not configured" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini request failed for model '{resume_analysis_service.model_name}': {exc}",
        ) from exc

    return ResumeAnalysisResponse(**analysis)
