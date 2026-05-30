"""Shared test fixtures.

Sets up:
- JWT_SECRET (32+ chars) so the fail-fast check in app.auth passes.
- ENVIRONMENT=test and ALLOWED_ORIGINS for CORS tests.
- An in-memory SQLite database overriding get_db for all routes.
- Convenience fixtures for registering users and obtaining auth headers.
"""

import os
import sys
import uuid

# ── Environment must be configured BEFORE any app import ──────────────────────

os.environ["JWT_SECRET"] = "test-secret-key-that-is-at-least-32-characters-long!"
os.environ["ENVIRONMENT"] = "test"
os.environ["ALLOWED_ORIGINS"] = "http://localhost,http://127.0.0.1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure the backend package is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.database import get_db, Base  # noqa: E402
from app.main import app  # noqa: E402
from app.limiter import limiter  # noqa: E402

# ── In-memory SQLite test database ────────────────────────────────────────────
# StaticPool ensures all connections share the same in-memory DB.

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# SQLite needs foreign key enforcement turned on explicitly
@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine
)

# Create all tables
Base.metadata.create_all(bind=test_engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

# ── A strong password that satisfies the new policy ───────────────────────────

STRONG_PASSWORD = "StrongP@ssw0rd!2024"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """Session-scoped TestClient."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def fresh_client():
    """Function-scoped TestClient for isolation-sensitive tests.
    Also resets the rate limiter so each test starts clean."""
    limiter.reset()
    with TestClient(app) as c:
        yield c


def _unique_email(prefix: str = "user") -> str:
    """Generate a unique email address for test isolation."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def registered_user(client):
    """Register a new user and return (email, response_json).
    The response_json contains access_token from registration."""
    email = _unique_email("reg")
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": STRONG_PASSWORD},
    )
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    return email, resp.json()


@pytest.fixture()
def auth_headers(client, registered_user):
    """Return Authorization headers using the token from registration.
    This avoids hitting the rate-limited login endpoint unnecessarily."""
    email, data = registered_user
    token = data["access_token"]
    return {"Authorization": f"Bearer {token}"}
