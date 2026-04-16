import json
from functools import lru_cache
from pathlib import Path


JOBS_FILE = Path(__file__).resolve().parent / "data" / "jobs.json"


@lru_cache(maxsize=1)
def get_all_jobs() -> list[dict]:
    with JOBS_FILE.open("r", encoding="utf-8") as jobs_file:
        jobs = json.load(jobs_file)

    return jobs if isinstance(jobs, list) else []
