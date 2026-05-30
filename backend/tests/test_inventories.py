"""Tests for inventory CRUD endpoints.

Validates ownership isolation (user A cannot access user B's inventories).
"""

import uuid
import pytest

from tests.conftest import STRONG_PASSWORD


def _unique_email(prefix: str = "inv") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register_and_get_headers(client, email: str) -> dict:
    """Helper: register and return auth headers using the registration token."""
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": STRONG_PASSWORD},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestInventoryCRUD:
    def test_create_inventory(self, client, auth_headers):
        resp = client.post(
            "/api/inventories",
            json={"name": "Warehouse A"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Warehouse A"

    def test_list_inventories(self, client, auth_headers):
        client.post(
            "/api/inventories",
            json={"name": "Inv1"},
            headers=auth_headers,
        )
        client.post(
            "/api/inventories",
            json={"name": "Inv2"},
            headers=auth_headers,
        )
        resp = client.get("/api/inventories", headers=auth_headers)
        assert resp.status_code == 200
        names = [inv["name"] for inv in resp.json()]
        assert "Inv1" in names
        assert "Inv2" in names

    def test_update_inventory(self, client, auth_headers):
        create = client.post(
            "/api/inventories",
            json={"name": "OldName"},
            headers=auth_headers,
        )
        inv_id = create.json()["id"]
        upd = client.put(
            f"/api/inventories/{inv_id}",
            json={"name": "NewName"},
            headers=auth_headers,
        )
        assert upd.status_code == 200
        assert upd.json()["name"] == "NewName"

    def test_delete_inventory(self, client, auth_headers):
        create = client.post(
            "/api/inventories",
            json={"name": "ToDelete"},
            headers=auth_headers,
        )
        inv_id = create.json()["id"]
        del_resp = client.delete(
            f"/api/inventories/{inv_id}",
            headers=auth_headers,
        )
        assert del_resp.status_code == 204

        # Subsequent GET should 404
        get_resp = client.get(
            f"/api/inventories/{inv_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 404


class TestInventoryOwnership:
    def test_cannot_access_another_users_inventory(self, client):
        """User B must not be able to read User A's inventory."""
        user_a_headers = _register_and_get_headers(client, _unique_email("owner_a"))
        user_b_headers = _register_and_get_headers(client, _unique_email("owner_b"))

        # User A creates an inventory
        create = client.post(
            "/api/inventories",
            json={"name": "SecretInv"},
            headers=user_a_headers,
        )
        inv_id = create.json()["id"]

        # User B tries to access it
        resp = client.get(
            f"/api/inventories/{inv_id}",
            headers=user_b_headers,
        )
        assert resp.status_code == 404
