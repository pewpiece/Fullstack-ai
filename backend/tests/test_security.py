"""Tests that verify the security hardening fixes are in place.

Validates: Fix 3 (CORS), Fix 4 (rate limiting), Fix 5 (docs disabled),
Fix 9 (security headers).
"""

import os
import uuid
import pytest

from tests.conftest import STRONG_PASSWORD


def _unique_email(prefix: str = "sec") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


class TestCORS:
    """Fix 3: CORS must not allow wildcard origins."""

    def test_cors_does_not_allow_wildcard(self, client):
        resp = client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        acao = resp.headers.get("access-control-allow-origin")
        # Must NOT be "*"
        assert acao != "*"
        # An unknown origin should be blocked (header absent or not matching)
        assert acao is None or acao != "https://evil.example.com"

    def test_cors_allows_configured_origin(self, client):
        """An origin from ALLOWED_ORIGINS should be reflected."""
        resp = client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://localhost",
                "Access-Control-Request-Method": "POST",
            },
        )
        acao = resp.headers.get("access-control-allow-origin")
        assert acao == "http://localhost"


class TestSecurityHeaders:
    """Fix 9: Standard security headers must be present on every response."""

    def test_security_headers_present(self, client, auth_headers):
        resp = client.get("/api/auth/me", headers=auth_headers)
        h = resp.headers
        assert h.get("x-content-type-options") == "nosniff"
        assert h.get("x-frame-options") == "DENY"
        assert "strict-origin" in h.get("referrer-policy", "").lower()

    def test_security_headers_on_public_endpoint(self, client):
        resp = client.get("/")
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"


class TestRateLimiting:
    """Fix 4: Login must be rate-limited to 10/minute."""

    def test_login_rate_limit(self, fresh_client):
        email = _unique_email("ratelim")
        fresh_client.post(
            "/api/auth/register",
            json={"email": email, "password": STRONG_PASSWORD},
        )

        last_status = None
        for i in range(12):
            resp = fresh_client.post(
                "/api/auth/login",
                data={"username": email, "password": STRONG_PASSWORD},
            )
            last_status = resp.status_code
            if last_status == 429:
                break

        # At some point (at or after the 11th), we should see 429
        assert last_status == 429, (
            f"Expected 429 after exceeding rate limit, but got {last_status}"
        )


class TestDocsDisabledInProduction:
    """Fix 5: /docs and /openapi.json must return 404 in production."""

    def test_docs_disabled_in_production(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")

        import importlib
        from app import main as main_module

        importlib.reload(main_module)

        from fastapi.testclient import TestClient
        prod_client = TestClient(main_module.app)

        assert prod_client.get("/docs").status_code == 404
        assert prod_client.get("/openapi.json").status_code == 404

        # Restore the dev environment for other tests
        monkeypatch.setenv("ENVIRONMENT", "test")
        importlib.reload(main_module)
