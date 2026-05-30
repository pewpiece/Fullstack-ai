"""Tests for authentication endpoints.

Validates: Fix 2 (JWT fail-fast), Fix 6 (password policy),
plus all standard auth flows.
"""

import os
import uuid
import pytest

# Import the strong password from conftest
from tests.conftest import STRONG_PASSWORD


def _unique_email(prefix: str = "auth") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


# ── Registration ──────────────────────────────────────────────────────────────

class TestRegister:
    def test_register_success(self, client):
        email = _unique_email("reg_success")
        resp = client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Password must never be echoed back
        assert "password" not in data

    def test_register_duplicate_email(self, client):
        email = _unique_email("dup")
        client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )
        dup = client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )
        assert dup.status_code == 400

    def test_register_weak_password_too_short(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": _unique_email(), "password": "Sh0rt!"},
        )
        assert resp.status_code == 422

    def test_register_weak_password_no_uppercase(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": _unique_email(), "password": "nouppercase1!xx"},
        )
        assert resp.status_code == 422
        assert "uppercase" in resp.text.lower()

    def test_register_weak_password_no_digit(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": _unique_email(), "password": "NoDigitHere!!xx"},
        )
        assert resp.status_code == 422
        assert "digit" in resp.text.lower()

    def test_register_weak_password_no_special(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": _unique_email(), "password": "NoSpecial1chars"},
        )
        assert resp.status_code == 422
        assert "special" in resp.text.lower()


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client):
        email = _unique_email("login_ok")
        client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )
        resp = client.post(
            "/api/auth/login",
            data={"username": email, "password": STRONG_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        email = _unique_email("login_bad")
        client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )
        resp = client.post(
            "/api/auth/login",
            data={"username": email, "password": "WrongP@ssw0rd!!"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/login",
            data={"username": "nobody@example.com", "password": STRONG_PASSWORD},
        )
        assert resp.status_code == 401


# ── /me ───────────────────────────────────────────────────────────────────────

class TestMe:
    def test_get_me_authenticated(self, client, registered_user, auth_headers):
        email, _ = registered_user
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == email

    def test_get_me_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


# ── JWT fail-fast (Fix 2) ────────────────────────────────────────────────────

class TestJWTFailFast:
    def test_missing_jwt_secret_raises_on_startup(self, monkeypatch):
        """If JWT_SECRET is unset or too short, importing app.auth must raise."""
        monkeypatch.setenv("JWT_SECRET", "tooshort")
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            import importlib
            import app.auth as auth_mod
            importlib.reload(auth_mod)
        # Restore valid secret so subsequent tests work
        monkeypatch.setenv(
            "JWT_SECRET",
            "test-secret-key-that-is-at-least-32-characters-long!",
        )
        import importlib
        import app.auth as auth_mod
        importlib.reload(auth_mod)
