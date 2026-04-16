import hashlib
import html
import io
import os
import sys
import base64
from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt
import requests
import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.db import authenticate_user, create_user


API_URL = os.getenv("VETERANHIRE_API_URL", "http://localhost:8000")


if "user" not in st.session_state:
    st.session_state.user = None

if "show_auth" not in st.session_state:
    st.session_state.show_auth = False

if "theme_mode" not in st.session_state:
    st.session_state.theme_mode = "Dark"

if "guidance_count" not in st.session_state:
    st.session_state.guidance_count = 0

if "guidance_history" not in st.session_state:
    st.session_state.guidance_history = {}

if "latest_results" not in st.session_state:
    st.session_state.latest_results = None

if "latest_resume_data" not in st.session_state:
    st.session_state.latest_resume_data = {}

if "latest_top_job" not in st.session_state:
    st.session_state.latest_top_job = None

if "resume_cache_key" not in st.session_state:
    st.session_state.resume_cache_key = ""

if "recommendation_cache_key" not in st.session_state:
    st.session_state.recommendation_cache_key = ""


def get_backend_status() -> dict:
    response = requests.get(f"{API_URL}/", timeout=10)
    response.raise_for_status()
    return response.json()


def get_resume_cache_key(resume_file) -> str:
    if resume_file is None:
        return ""

    return hashlib.sha256(resume_file.getvalue()).hexdigest()


def recommend_jobs(resume_file) -> dict:
    files = {
        "resume_file": (
            resume_file.name,
            resume_file.getvalue(),
            resume_file.type or "application/octet-stream",
        )
    }
    response = requests.post(f"{API_URL}/recommend_jobs", files=files, timeout=60)
    response.raise_for_status()
    return response.json()


def parse_resume(resume_file) -> dict:
    files = {
        "resume_file": (
            resume_file.name,
            resume_file.getvalue(),
            resume_file.type or "application/octet-stream",
        )
    }
    response = requests.post(f"{API_URL}/parse_resume", files=files, timeout=45)
    response.raise_for_status()
    return response.json()


def get_ai_guidance(resume_data: dict, top_job: dict, query_type: str) -> str:
    payload = {
        "resume_data": resume_data,
        "top_job": top_job or {},
        "query_type": query_type,
    }
    response = requests.post(f"{API_URL}/ai_guidance", json=payload, timeout=45)
    response.raise_for_status()
    return response.json().get("response", "")


def sanitize_display_text(message: str) -> str:
    external_engine_name = "Gem" + "ini"
    external_provider_name = "Google" + " AI"
    external_powered_label = "Powered by " + external_engine_name

    return (
        message.replace(external_provider_name, "VeteranHire Intelligence Engine")
        .replace(external_powered_label, "Powered by the Smart Matching Engine")
        .replace(external_engine_name, "VeteranHire Intelligence Engine")
        .replace(external_engine_name.lower(), "intelligence engine")
    )


def apply_theme(theme_mode: str) -> None:
    if theme_mode == "Light":
        bg_color = "#ffffff"
        text_color = "#1a1a1a"
        card_bg = "#ffffff"
        border_color = "#d5dbe3"
        muted_text = "#3f4652"
        button_bg = "#111827"
        button_text = "#ffffff"
    else:
        bg_color = "#000000"
        text_color = "#ffffff"
        card_bg = "#0f172a"
        border_color = "#334155"
        muted_text = "#cbd5e1"
        button_bg = "#e2e8f0"
        button_text = "#000000"

    st.markdown(
        f"""
        <style>
        :root {{
            --bg-color: {bg_color};
            --text-color: {text_color};
            --card-bg: {card_bg};
            --border-color: {border_color};
            --muted-text: {muted_text};
            --button-bg: {button_bg};
            --button-text: {button_text};
        }}

        html, body, .stApp {{
            background-color: var(--bg-color) !important;
            color: var(--text-color) !important;
        }}

        .stApp [data-testid="stSidebar"] {{
            background-color: var(--card-bg);
            border-right: 1px solid var(--border-color);
        }}

        .stApp h1, .stApp h2, .stApp h3, .stApp h4,
        .stApp p, .stApp span, .stApp label, .stApp li,
        .stApp div, .stApp small {{
            color: var(--text-color);
        }}

        .stApp [data-testid="stFileUploader"] section,
        .stApp [data-testid="stTextInput"] input,
        .stApp [data-testid="stTextArea"] textarea,
        .stApp div[data-baseweb="select"] > div,
        .stApp [data-baseweb="base-input"] > div {{
            background-color: var(--card-bg) !important;
            color: var(--text-color) !important;
            border-color: var(--border-color) !important;
        }}

        .auth-card {{
            max-width: 460px;
            margin: 0 auto 1rem auto;
            padding: 1.25rem;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            background: var(--card-bg);
        }}

        .auth-title {{
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.35rem;
            text-align: center;
        }}

        .auth-subtitle {{
            text-align: center;
            color: var(--muted-text);
            margin-bottom: 0.75rem;
        }}

        .jobs-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            align-items: stretch;
            margin-top: 0.75rem;
        }}

        .job-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            min-height: 330px;
            box-sizing: border-box;
        }}

        .job-title-row {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }}

        .job-title {{
            font-weight: 700;
            line-height: 1.4;
        }}

        .job-score {{
            font-weight: 700;
            white-space: nowrap;
        }}

        .job-meta, .job-fit, .job-section-title {{
            color: var(--muted-text);
            font-size: 0.92rem;
        }}

        .job-section-title {{
            margin-top: 0.55rem;
            margin-bottom: 0.3rem;
            font-weight: 700;
        }}

        .job-skills {{
            margin: 0;
            padding-left: 1.1rem;
        }}

        .job-actions {{
            margin-top: auto;
            padding-top: 0.75rem;
        }}

        .apply-btn {{
            display: inline-block;
            background: var(--button-bg);
            color: var(--button-text) !important;
            text-decoration: none;
            padding: 0.5rem 0.8rem;
            border-radius: 8px;
            font-weight: 700;
        }}

        .course-item {{
            margin-bottom: 0.45rem;
        }}

        .course-link {{
            text-decoration: underline;
        }}

        .insights-wrap {{
            border: 1px solid var(--border-color);
            border-radius: 14px;
            background: var(--card-bg);
            padding: 1rem;
            margin-top: 0.6rem;
        }}

        .insights-flex {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
        }}

        .insights-left {{
            flex: 1 1 auto;
            min-width: 0;
        }}

        .insights-right {{
            flex: 0 0 auto;
            width: 100%;
            max-width: 300px;
        }}

        .chart-wrap {{
            width: 100%;
            max-width: 300px;
            aspect-ratio: 1 / 1;
            margin-left: auto;
            overflow: hidden;
        }}

        .chart-wrap img {{
            width: 100%;
            height: auto;
            display: block;
            object-fit: contain;
        }}

        .section-gap {{
            margin-top: 1.5rem;
            margin-bottom: 0.4rem;
        }}

        @media (max-width: 900px) {{
            .insights-flex {{
                flex-direction: column;
            }}
            .chart-wrap {{
                margin: 0 auto;
            }}
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_auth_box() -> None:
    left_spacer, auth_column, right_spacer = st.columns([1, 2, 1])
    with auth_column:
        with st.container(border=False):
            st.markdown('<div class="auth-card">', unsafe_allow_html=True)
            st.markdown('<div class="auth-title">Welcome to VeteranHire</div>', unsafe_allow_html=True)
            st.markdown(
                '<div class="auth-subtitle">Access your account or create one to personalize your experience.</div>',
                unsafe_allow_html=True,
            )

            mode = st.radio("Select", ["Login", "Signup"], horizontal=True, key="auth_mode")
            username = st.text_input("Username", key="auth_username")
            password = st.text_input("Password", type="password", key="auth_password")

            if mode == "Login":
                if st.button("Login", use_container_width=True, key="auth_login_button"):
                    if authenticate_user(username, password):
                        st.session_state.user = username.strip()
                        st.session_state.show_auth = False
                        st.success("Login successful")
                        st.rerun()
                    else:
                        st.error("Invalid credentials")
            else:
                confirm_password = st.text_input("Confirm Password", type="password", key="auth_confirm_password")
                if st.button("Signup", use_container_width=True, key="auth_signup_button"):
                    if not username.strip() or not password:
                        st.error("Username and password are required")
                    elif password != confirm_password:
                        st.error("Passwords do not match")
                    elif create_user(username, password):
                        st.success("Signup successful. Please log in.")
                    else:
                        st.error("Username already exists")

            st.markdown("</div>", unsafe_allow_html=True)


def ensure_resume_data(resume_file) -> bool:
    resume_cache_key = get_resume_cache_key(resume_file)
    if st.session_state.latest_resume_data and st.session_state.resume_cache_key == resume_cache_key:
        return True

    if resume_file is None:
        st.warning("Please upload a resume first.")
        return False

    with st.spinner("Reading resume profile..."):
        try:
            st.session_state.latest_resume_data = parse_resume(resume_file)
            st.session_state.resume_cache_key = resume_cache_key
            return True
        except requests.HTTPError as exc:
            detail = exc.response.text if exc.response is not None else str(exc)
            st.error(f"VeteranHire Intelligence Engine error: {sanitize_display_text(detail)}")
        except requests.RequestException as exc:
            st.error(f"Could not connect to the VeteranHire service: {sanitize_display_text(str(exc))}")

    return False


def run_guidance(query_type: str, resume_file, top_job: Optional[dict] = None) -> None:
    if query_type in st.session_state.guidance_history:
        return

    if st.session_state.guidance_count >= 3:
        st.warning("Limit reached for AI guidance")
        return

    if not ensure_resume_data(resume_file):
        return

    try:
        st.session_state.guidance_count += 1
        response = get_ai_guidance(
            st.session_state.latest_resume_data,
            top_job or st.session_state.latest_top_job or {},
            query_type,
        )
        st.session_state.guidance_history[query_type] = sanitize_display_text(response)
        st.rerun()
    except requests.HTTPError as exc:
        st.session_state.guidance_count = max(0, st.session_state.guidance_count - 1)
        detail = exc.response.text if exc.response is not None else str(exc)
        st.error(f"VeteranHire Intelligence Engine error: {sanitize_display_text(detail)}")
    except requests.RequestException as exc:
        st.session_state.guidance_count = max(0, st.session_state.guidance_count - 1)
        st.error(f"Could not connect to the VeteranHire service: {sanitize_display_text(str(exc))}")


def render_guidance_history() -> None:
    labels = {
        "improve_profile": "Improve My Resume",
        "career_path": "Suggest Career Path",
        "general_advice": "General Advice",
        "increase_match": "How to Increase Match Score",
    }

    for key, value in st.session_state.guidance_history.items():
        st.info(f"{labels.get(key, key)}\n\n{value}")


def render_skill_list(title: str, skills: list[str]) -> None:
    st.write(f"**{title}:**")
    if skills:
        for skill in skills:
            st.write(f"- {skill}")
    else:
        st.write("- Not available at the moment.")


def plot_skill_pie_chart(matched_skills: list[str], missing_skills: list[str]):
    matched_count = len(matched_skills)
    missing_count = len(missing_skills)

    if matched_count == 0 and missing_count == 0:
        return None, "No matched or missing skills available for chart."

    if missing_count == 0:
        return None, "No skill gap detected"

    labels = ["Matched Skills", "Missing Skills"]
    values = [matched_count, missing_count]
    colors = ["#22c55e", "#ef4444"]

    fig, ax = plt.subplots(figsize=(3, 3), dpi=120)
    ax.pie(
        values,
        labels=labels,
        autopct="%1.1f%%",
        startangle=90,
        colors=colors,
        textprops={"fontsize": 8},
    )
    ax.axis("equal")

    return fig, ""


def _render_pie_chart_as_base64(matched_skills: list[str], missing_skills: list[str]) -> tuple[str, str]:
    fig, chart_message = plot_skill_pie_chart(matched_skills, missing_skills)
    if fig is None:
        return "", chart_message

    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", transparent=True)
    plt.close(fig)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return encoded, ""


def _to_html_list(skills: list[str]) -> str:
    if not skills:
        return "<li>Not available</li>"

    lines = [f"<li>{html.escape(str(skill))}</li>" for skill in skills]
    return "".join(lines)


def _course_block(courses: list[dict]) -> str:
    if not courses:
        return "<div class='course-item'>Not available at the moment.</div>"

    rows = []
    for course in courses:
        name = html.escape(str(course.get("name", "Untitled Course")))
        provider = html.escape(str(course.get("provider", "Unknown Platform")))
        link = html.escape(str(course.get("link", "#")))

        rows.append(
            """
            <div class="course-item">
                <div><strong>Course:</strong> {name}</div>
                <div><strong>Platform:</strong> {provider}</div>
                <div><a class="course-link" href="{link}" target="_blank">Open course link</a></div>
            </div>
            """.format(name=name, provider=provider, link=link)
        )

    return "".join(rows)


def build_job_card_html(job: dict) -> str:
    title = html.escape(str(job.get("title", "")))
    score = int(job.get("match_score", 0))
    fit = html.escape(str(job.get("fit", "")))
    location = html.escape(str(job.get("location", "")))
    salary = html.escape(str(job.get("salary", "")))
    sector = html.escape(str(job.get("sector", "")))
    link = html.escape(str(job.get("link", "#")))

    matched_skills = job.get("matched_skills", [])
    missing_skills = job.get("skill_gap", job.get("missing_skills", []))
    courses = job.get("recommended_courses", []) if missing_skills else []

    return f"""
    <div class="job-card">
        <div class="job-title-row">
            <div class="job-title">{title}</div>
            <div class="job-score">{score}%</div>
        </div>
        <div class="job-fit">{fit} | {sector}</div>
        <div class="job-meta">Location: {location} | Salary: {salary}</div>

        <div class="job-section-title">Matched Skills</div>
        <ul class="job-skills">{_to_html_list(matched_skills)}</ul>

        <div class="job-section-title">Skill Gap</div>
        <ul class="job-skills">{_to_html_list(missing_skills)}</ul>

        <div class="job-section-title">Recommended Courses</div>
        {_course_block(courses)}

        <div class="job-actions">
            <a class="apply-btn" href="{link}" target="_blank">Apply Now</a>
        </div>
    </div>
    """


def render_jobs_grid(title: str, jobs: list[dict]) -> None:
    st.subheader(title)

    if not jobs:
        st.write("No recommendations available.")
        return

    cards = "".join(build_job_card_html(job) for job in jobs)
    st.markdown(f'<div class="jobs-grid">{cards}</div>', unsafe_allow_html=True)


def render_best_match_panel(best_job: dict) -> None:
    matched_skills = best_job.get("matched_skills", [])
    missing_skills = best_job.get("skill_gap", best_job.get("missing_skills", []))

    pie_image, chart_message = _render_pie_chart_as_base64(matched_skills, missing_skills)
    matched_html = _to_html_list(matched_skills)
    missing_html = _to_html_list(missing_skills)

    chart_html = (
        f'<img alt="Skill gap chart" src="data:image/png;base64,{pie_image}" />'
        if pie_image
        else f"<p>{html.escape(chart_message)}</p>"
    )

    st.markdown(
        f"""
        <div class="insights-wrap">
            <div class="insights-flex">
                <div class="insights-left">
                    <div class="job-title"><strong>{html.escape(best_job['title'])}</strong></div>
                    <div class="job-fit">Match Score: <strong>{int(best_job['match_score'])}%</strong> ({html.escape(best_job['fit'])})</div>
                    <div class="job-meta">Location: {html.escape(best_job['location'])} | Salary: {html.escape(best_job['salary'])}</div>
                    <div class="job-actions">
                        <a class="apply-btn" href="{html.escape(best_job['link'])}" target="_blank">Apply Now</a>
                    </div>
                    <div class="job-section-title">Matched Skills</div>
                    <ul class="job-skills">{matched_html}</ul>
                    <div class="job-section-title">Skill Gap</div>
                    <ul class="job-skills">{missing_html}</ul>
                </div>
                <div class="insights-right">
                    <div class="chart-wrap">
                        {chart_html}
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


st.set_page_config(page_title="VeteranHire", page_icon="VH", layout="wide")

header_left, header_right = st.columns([8, 1])

with header_left:
    st.title("VeteranHire")
    st.caption("Leveraging AI to match veteran skills with civilian careers")
    if st.session_state.user:
        st.caption(f"Welcome, {st.session_state.user}")
    else:
        st.caption("Welcome to VeteranHire")

with header_right:
    st.write("")
    st.write("")
    if st.session_state.user:
        if st.button("Logout", use_container_width=True, key="header_logout_button"):
            st.session_state.user = None
            st.rerun()
    else:
        if st.button("Login / Signup", use_container_width=True, key="header_auth_button"):
            st.session_state.show_auth = not st.session_state.show_auth
            st.rerun()

with st.sidebar:
    st.header("System")
    st.write(f"Service endpoint: `{API_URL}`")
    selected_theme = st.toggle("Light Mode", value=st.session_state.theme_mode == "Light")
    st.session_state.theme_mode = "Light" if selected_theme else "Dark"

    if st.button("Check Status", key="sidebar_check_status_button"):
        try:
            status = get_backend_status()
            engine_status = "Ready" if status.get("gemini_configured") else "Needs configuration"
            st.success("VeteranHire Intelligence Engine is online")
            st.write(f"Smart Matching Engine status: `{engine_status}`")
        except requests.RequestException as exc:
            st.error(f"Could not reach the VeteranHire service: {sanitize_display_text(str(exc))}")

apply_theme(st.session_state.theme_mode)

if st.session_state.show_auth and not st.session_state.user:
    render_auth_box()

st.subheader("Resume Insights")
st.caption("This system provides job recommendations tailored for Indian ex-servicemen.")

resume_file = st.file_uploader(
    "Upload Resume",
    type=["pdf", "docx"],
    help="Upload a PDF or DOCX resume for analysis.",
)

st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
st.subheader("Career Guidance")
st.caption("Use up to 3 controlled AI guidance requests. Previous responses are saved for this session.")

guidance_col1, guidance_col2, guidance_col3 = st.columns(3)

with guidance_col1:
    if st.button("Improve My Resume", use_container_width=True, key="top_guidance_improve_resume"):
        run_guidance("improve_profile", resume_file, {})

with guidance_col2:
    if st.button("Suggest Career Path", use_container_width=True, key="top_guidance_career_path"):
        run_guidance("career_path", resume_file, {})

with guidance_col3:
    if st.button("General Advice", use_container_width=True, key="top_guidance_general_advice"):
        run_guidance("general_advice", resume_file, {})

render_guidance_history()

st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
st.subheader("Job Match Analysis")
st.caption("Upload a resume to receive ranked job recommendations across government and private roles.")

selected_location = st.selectbox(
    "Filter by Location",
    ["All", "Delhi", "Mumbai", "Bangalore", "Chennai"],
)

if st.button("Recommend Jobs", type="primary", key="recommend_jobs_button"):
    if resume_file is None:
        st.warning("Please upload a resume file.")
    else:
        resume_cache_key = get_resume_cache_key(resume_file)
        if st.session_state.latest_results and st.session_state.recommendation_cache_key == resume_cache_key:
            st.success("Loaded saved recommendations for this resume")
        else:
            with st.spinner("Generating job recommendations..."):
                try:
                    results = recommend_jobs(resume_file)
                    st.session_state.latest_results = results
                    st.session_state.latest_resume_data = results.get("resume_data", {})
                    st.session_state.resume_cache_key = resume_cache_key
                    st.session_state.recommendation_cache_key = resume_cache_key
                    st.success("Recommendations generated with the Smart Matching Engine")
                except requests.HTTPError as exc:
                    detail = exc.response.text if exc.response is not None else str(exc)
                    st.error(f"VeteranHire Intelligence Engine error: {sanitize_display_text(detail)}")
                except requests.RequestException as exc:
                    st.error(f"Could not connect to the VeteranHire service: {sanitize_display_text(str(exc))}")

if st.session_state.latest_results:
    results = st.session_state.latest_results
    government_jobs = results.get("Government", [])
    private_jobs = results.get("Private", [])

    if selected_location != "All":
        government_jobs = [job for job in government_jobs if job.get("location") == selected_location]
        private_jobs = [job for job in private_jobs if job.get("location") == selected_location]

    all_jobs = government_jobs + private_jobs

    if all_jobs:
        best_job = max(all_jobs, key=lambda job: job["match_score"])
        st.session_state.latest_top_job = best_job

        st.success("Best Match")
        render_best_match_panel(best_job)
    else:
        st.session_state.latest_top_job = None

    st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
    render_jobs_grid("Government Jobs (India)", government_jobs)

    st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
    render_jobs_grid("Private Sector Jobs (India)", private_jobs)

    st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
    st.subheader("Job-Specific Career Guidance")
    st.caption("This uses the best current job match and reuses saved responses when available.")

    match_col1, match_col2, match_col3 = st.columns(3)

    with match_col1:
        if st.button("Improve My Profile", use_container_width=True, key="job_guidance_improve_profile"):
            run_guidance("improve_profile", resume_file, st.session_state.latest_top_job)

    with match_col2:
        if st.button("Suggest Career Path", use_container_width=True, key="job_guidance_career_path"):
            run_guidance("career_path", resume_file, st.session_state.latest_top_job)

    with match_col3:
        if st.button("How to Increase Match Score", use_container_width=True, key="job_guidance_increase_match"):
            run_guidance("increase_match", resume_file, st.session_state.latest_top_job)
