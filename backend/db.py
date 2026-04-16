import hashlib
import sqlite3
import tempfile
from pathlib import Path


DB_ROOT = Path(tempfile.gettempdir())
DB_PATH = DB_ROOT / "VeteranHire" / "users.db"


def _get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DB_PATH))
    connection.row_factory = sqlite3.Row
    return connection


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _initialize_database() -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
            """
        )
        connection.commit()


def create_user(username: str, password: str) -> bool:
    normalized_username = username.strip()
    if not normalized_username or not password:
        return False

    try:
        with _get_connection() as connection:
            connection.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (normalized_username, _hash_password(password)),
            )
            connection.commit()
            return True
    except sqlite3.IntegrityError:
        return False


def authenticate_user(username: str, password: str) -> bool:
    normalized_username = username.strip()
    if not normalized_username or not password:
        return False

    with _get_connection() as connection:
        row = connection.execute(
            "SELECT password FROM users WHERE username = ?",
            (normalized_username,),
        ).fetchone()

    if row is None:
        return False

    return row["password"] == _hash_password(password)


_initialize_database()
