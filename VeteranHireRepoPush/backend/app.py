import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from flask import Flask, g, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'admin_analytics.db'

app = Flask(__name__)
CORS(app)


def get_db() -> sqlite3.Connection:
    db = getattr(g, '_database', None)
    if db is None:
        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        g._database = db
    return db


@app.teardown_appcontext
def close_connection(_: Any) -> None:
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            aadhaar_number TEXT,
            verification_status TEXT NOT NULL DEFAULT 'Pending',
            skills TEXT NOT NULL DEFAULT '[]',
            match_score INTEGER NOT NULL DEFAULT 0,
            jobs_matched INTEGER NOT NULL DEFAULT 0
        )
        '''
    )
    db.commit()


def mask_aadhaar(aadhaar: str | None) -> str:
    if not aadhaar:
        return 'Not provided'
    digits = ''.join(ch for ch in str(aadhaar) if ch.isdigit())
    if len(digits) < 4:
        return '************'
    return f"XXXXXXXX{digits[-4:]}"


def seed_mock_data() -> None:
    db = get_db()
    count = db.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
    if count > 0:
        return

    mock_users = [
        {
            'name': 'Admin User',
            'email': 'admin@test.com',
            'password': 'admin123',
            'role': 'admin',
            'aadhaar_number': '123412341234',
            'verification_status': 'Verified',
            'skills': ['Leadership', 'Operations', 'Logistics'],
            'match_score': 92,
            'jobs_matched': 44,
        },
        {
            'name': 'John Carter',
            'email': 'john@test.com',
            'password': 'john123',
            'role': 'user',
            'aadhaar_number': '987654321012',
            'verification_status': 'Pending',
            'skills': ['Python', 'Leadership'],
            'match_score': 75,
            'jobs_matched': 25,
        },
        {
            'name': 'Priya Nair',
            'email': 'priya@test.com',
            'password': 'priya123',
            'role': 'user',
            'aadhaar_number': '345678901234',
            'verification_status': 'Verified',
            'skills': ['Data Analysis', 'Communication', 'Excel'],
            'match_score': 81,
            'jobs_matched': 31,
        },
        {
            'name': 'Ravi Singh',
            'email': 'ravi@test.com',
            'password': 'ravi123',
            'role': 'user',
            'aadhaar_number': '456789012345',
            'verification_status': 'Rejected',
            'skills': ['Project Management', 'Teamwork'],
            'match_score': 64,
            'jobs_matched': 19,
        },
    ]

    for user in mock_users:
        db.execute(
            '''
            INSERT INTO users (name, email, password, role, aadhaar_number, verification_status, skills, match_score, jobs_matched)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                user['name'],
                user['email'],
                user['password'],
                user['role'],
                user['aadhaar_number'],
                user['verification_status'],
                json.dumps(user['skills']),
                int(user['match_score']),
                int(user['jobs_matched']),
            ),
        )
    db.commit()


def parse_skills(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return [str(item).strip() for item in parsed if str(item).strip()]
    except (TypeError, json.JSONDecodeError):
        return []


def build_skill_scores(skills: list[str], match_score: int) -> dict[str, int]:
    scores: dict[str, int] = {}
    if not skills:
        return scores

    ceiling = max(55, min(95, int(match_score) + 10))
    floor = max(40, min(85, int(match_score) - 10))
    spread = max(1, ceiling - floor)

    for index, skill in enumerate(skills):
        ratio = (index + 1) / (len(skills) + 1)
        scores[skill] = int(round(floor + ratio * spread))
    return scores


def derive_gap_and_courses(skills: list[str]) -> tuple[list[str], list[str]]:
    gap_bank = {
        'Python': ('AI', 'AI Basics'),
        'Leadership': ('Data Analysis', 'Data Analytics'),
        'Operations': ('Cloud Tools', 'Cloud Foundations'),
        'Logistics': ('ERP', 'ERP for Operations'),
        'Communication': ('Stakeholder Management', 'Business Communication'),
        'Project Management': ('Agile', 'Agile Fundamentals'),
        'Excel': ('BI Tools', 'Power BI Essentials'),
    }

    found_gaps: list[str] = []
    found_courses: list[str] = []

    for skill in skills:
        gap, course = gap_bank.get(skill, ('Digital Skills', 'Digital Skills Bootcamp'))
        if gap not in found_gaps:
            found_gaps.append(gap)
        if course not in found_courses:
            found_courses.append(course)

    if not found_gaps:
        found_gaps = ['AI', 'Data Analysis']
        found_courses = ['AI Basics', 'Data Analytics']

    return found_gaps[:4], found_courses[:4]


@app.before_request
def bootstrap() -> None:
    init_db()
    seed_mock_data()


@app.post('/signup')
def signup() -> Any:
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', '')).strip()
    role = 'admin' if email == 'admin@test.com' else 'user'

    if not name or not email or not password:
        return jsonify({'error': 'name, email and password are required'}), 400

    db = get_db()
    try:
        db.execute(
            '''
            INSERT INTO users (name, email, password, role, verification_status, skills, match_score, jobs_matched)
            VALUES (?, ?, ?, ?, 'Pending', '[]', 0, 0)
            ''',
            (name, email, password, role),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'email already exists'}), 409

    user = db.execute('SELECT id, name, email, role FROM users WHERE email = ?', (email,)).fetchone()
    return jsonify({'message': 'signup successful', 'user': dict(user)}), 201


@app.post('/login')
def login() -> Any:
    payload = request.get_json(silent=True) or {}
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', '')).strip()

    db = get_db()
    row = db.execute(
        'SELECT id, name, email, role FROM users WHERE email = ? AND password = ?',
        (email, password),
    ).fetchone()

    if not row:
        return jsonify({'error': 'invalid credentials'}), 401

    return jsonify({'message': 'login successful', 'user': dict(row)})


@app.get('/api/users')
def api_users() -> Any:
    db = get_db()
    rows = db.execute(
        '''
        SELECT id, name, email, role, aadhaar_number, verification_status, skills, match_score, jobs_matched
        FROM users
        ORDER BY id DESC
        '''
    ).fetchall()

    users = []
    for row in rows:
        item = dict(row)
        item['skills'] = parse_skills(item.get('skills'))
        item['aadhaar_masked'] = mask_aadhaar(item.get('aadhaar_number'))
        users.append(item)

    return jsonify({'users': users})


@app.get('/api/verification')
def api_verification() -> Any:
    db = get_db()
    rows = db.execute(
        '''
        SELECT id, name, email, role, aadhaar_number, verification_status
        FROM users
        WHERE verification_status = 'Pending'
        ORDER BY id DESC
        '''
    ).fetchall()

    pending = []
    for row in rows:
        item = dict(row)
        item['aadhaar_masked'] = mask_aadhaar(item.get('aadhaar_number'))
        pending.append(item)

    return jsonify({'users': pending})


@app.post('/api/verify/<int:user_id>')
def api_verify(user_id: int) -> Any:
    payload = request.get_json(silent=True) or {}
    status = str(payload.get('status', 'Pending')).strip().title()
    if status not in {'Pending', 'Verified', 'Rejected'}:
        return jsonify({'error': 'status must be Pending, Verified or Rejected'}), 400

    db = get_db()
    result = db.execute('UPDATE users SET verification_status = ? WHERE id = ?', (status, user_id))
    db.commit()

    if result.rowcount == 0:
        return jsonify({'error': 'user not found'}), 404

    return jsonify({'message': 'verification updated', 'id': user_id, 'status': status})


@app.get('/api/admin/user/<int:user_id>')
def api_admin_user(user_id: int) -> Any:
    db = get_db()
    row = db.execute(
        '''
        SELECT id, name, email, aadhaar_number, verification_status, skills, match_score, jobs_matched
        FROM users
        WHERE id = ?
        ''',
        (user_id,),
    ).fetchone()

    if not row:
        return jsonify({'error': 'user not found'}), 404

    data = dict(row)
    skills = parse_skills(data.get('skills'))
    match_score = int(data.get('match_score') or 0)
    skill_scores = build_skill_scores(skills, match_score)
    skill_gap, recommended_courses = derive_gap_and_courses(skills)

    payload = {
        'name': data.get('name'),
        'email': data.get('email'),
        'skills': skills,
        'skill_scores': skill_scores,
        'match_score': match_score,
        'skill_gap': skill_gap,
        'recommended_courses': recommended_courses,
        'jobs_matched': int(data.get('jobs_matched') or 0),
        'verification_status': data.get('verification_status') or 'Pending',
    }

    return jsonify(payload)


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    app.run(host='0.0.0.0', port=port, debug=True)
