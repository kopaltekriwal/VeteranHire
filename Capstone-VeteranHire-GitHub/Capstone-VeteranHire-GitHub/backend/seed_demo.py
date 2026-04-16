import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.flask_app import app, db, _seed_demo_data


def run() -> None:
    with app.app_context():
        db.create_all()
        _seed_demo_data()
    print("Demo data seeded successfully.")


if __name__ == "__main__":
    run()
