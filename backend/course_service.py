from urllib.parse import quote_plus


COURSE_MAP = {
    "erp software": [
        {
            "name": "SAP ERP Basics",
            "provider": "Udemy",
        },
        {
            "name": "ERP Fundamentals",
            "provider": "Coursera",
        },
    ],
    "data analysis": [
        {
            "name": "Google Data Analytics",
            "provider": "Coursera",
        },
        {
            "name": "Data Analysis for Decision Making",
            "provider": "Udemy",
        },
    ],
    "inventory management": [
        {
            "name": "Supply Chain Fundamentals",
            "provider": "Coursera",
        },
        {
            "name": "Inventory Management A-Z",
            "provider": "Udemy",
        },
    ],
    "logistics planning": [
        {
            "name": "Logistics and Supply Chain Management",
            "provider": "Coursera",
        }
    ],
    "vendor management": [
        {
            "name": "Procurement and Sourcing Introduction",
            "provider": "Coursera",
        }
    ],
    "warehouse operations": [
        {
            "name": "Warehouse Management Essentials",
            "provider": "Udemy",
        }
    ],
    "supply chain": [
        {
            "name": "Supply Chain Management Specialization",
            "provider": "Coursera",
        }
    ],
    "administration": [
        {
            "name": "Business Administration Basics",
            "provider": "Coursera",
        }
    ],
    "security": [
        {
            "name": "Security Operations Fundamentals",
            "provider": "Udemy",
        }
    ],
}


def get_courses_for_skills(missing_skills: list[str]) -> list[dict[str, str]]:
    selected_courses: list[dict[str, str]] = []
    seen_courses: set[tuple[str, str]] = set()

    for skill in missing_skills:
        normalized_skill = str(skill).strip().lower()
        if not normalized_skill:
            continue

        matched_courses = _lookup_courses(normalized_skill)
        if not matched_courses:
            fallback_provider = "Coursera" if len(selected_courses) % 2 == 0 else "Udemy"
            matched_courses = [
                {
                    "name": f"{_title_case_skill(normalized_skill)} Fundamentals",
                    "provider": fallback_provider,
                }
            ]

        for course in matched_courses:
            course_key = (course["name"], course["provider"])
            if course_key in seen_courses:
                continue

            selected_courses.append(
                {
                    "name": course["name"],
                    "provider": course["provider"],
                    "skill": _title_case_skill(normalized_skill),
                    "link": _build_search_link(normalized_skill, course["provider"]),
                }
            )
            seen_courses.add(course_key)

            if len(selected_courses) >= 6:
                return selected_courses

    return selected_courses


def _lookup_courses(skill: str) -> list[dict[str, str]]:
    direct_match = COURSE_MAP.get(skill)
    if direct_match:
        return direct_match

    for key, courses in COURSE_MAP.items():
        if key in skill or skill in key:
            return courses

    return []


def _build_search_link(skill: str, provider: str) -> str:
    encoded_skill = quote_plus(skill.strip())
    provider_key = str(provider or "").strip().lower()
    if provider_key == "coursera":
        return f"https://www.coursera.org/search?query={encoded_skill}"
    return f"https://www.udemy.com/courses/search/?q={encoded_skill}"


def _title_case_skill(skill: str) -> str:
    return " ".join(part.capitalize() for part in skill.split())
