"""Tests for item CRUD endpoints and dashboard stats.

Items live under categories → inventories, so the fixtures
create the full hierarchy for each test.
"""

import uuid
import pytest

from tests.conftest import STRONG_PASSWORD


def _unique_email(prefix: str = "item") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def item_test_context(client):
    """
    Create a fresh user → inventory → category and return
    (auth_headers, inventory_id, category_id).
    Uses the token from registration to avoid hitting the rate-limited
    login endpoint.
    """
    email = _unique_email("itemctx")
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": STRONG_PASSWORD},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    inv = client.post(
        "/api/inventories",
        json={"name": "ItemTestInv"},
        headers=headers,
    )
    inv_id = inv.json()["id"]

    cat = client.post(
        f"/api/inventories/{inv_id}/categories",
        json={"name": "TestCategory"},
        headers=headers,
    )
    cat_id = cat.json()["id"]

    return headers, inv_id, cat_id


class TestItemCRUD:
    def test_create_item(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context
        resp = client.post(
            "/api/items",
            json={
                "name": "Widget A",
                "sku": "widget-a",
                "category_id": cat_id,
                "quantity": 10,
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["sku"] == "WIDGET-A"  # SKU upper-cased

    def test_sku_is_uppercased_on_create(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context
        resp = client.post(
            "/api/items",
            json={
                "name": "Lowsku Item",
                "sku": "lower-sku",
                "category_id": cat_id,
                "quantity": 1,
            },
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["sku"] == "LOWER-SKU"

    def test_list_items_by_category(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context

        # Create a second category in the same inventory
        cat2 = client.post(
            f"/api/inventories/{inv_id}/categories",
            json={"name": "SecondCategory"},
            headers=headers,
        )
        cat2_id = cat2.json()["id"]

        # Create items in both categories
        client.post(
            "/api/items",
            json={
                "name": "Cat1 Item",
                "sku": "C1-1",
                "category_id": cat_id,
                "quantity": 5,
            },
            headers=headers,
        )
        client.post(
            "/api/items",
            json={
                "name": "Cat2 Item",
                "sku": "C2-1",
                "category_id": cat2_id,
                "quantity": 7,
            },
            headers=headers,
        )

        # Filter by the first category
        resp = client.get(
            f"/api/items?cat_id={cat_id}",
            headers=headers,
        )
        assert resp.status_code == 200
        items = resp.json()
        assert all(i["category_id"] == cat_id for i in items)

    def test_update_item(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context
        create = client.post(
            "/api/items",
            json={
                "name": "ToUpdate",
                "sku": "UPD-1",
                "category_id": cat_id,
                "quantity": 3,
            },
            headers=headers,
        )
        item_id = create.json()["id"]

        upd = client.put(
            f"/api/items/{item_id}",
            json={
                "name": "ToUpdate",
                "sku": "UPD-1",
                "category_id": cat_id,
                "quantity": 15,
            },
            headers=headers,
        )
        assert upd.status_code == 200
        assert upd.json()["quantity"] == 15

    def test_delete_item(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context
        create = client.post(
            "/api/items",
            json={
                "name": "ToDelete",
                "sku": "DEL-1",
                "category_id": cat_id,
                "quantity": 1,
            },
            headers=headers,
        )
        item_id = create.json()["id"]

        del_resp = client.delete(f"/api/items/{item_id}", headers=headers)
        assert del_resp.status_code == 204

        get_resp = client.get(f"/api/items/{item_id}", headers=headers)
        assert get_resp.status_code == 404


class TestDashboardStats:
    def test_dashboard_stats_accuracy(self, client, item_test_context):
        headers, inv_id, cat_id = item_test_context
        quantities = [10, 20, 5]
        for idx, q in enumerate(quantities):
            client.post(
                "/api/items",
                json={
                    "name": f"StatItem{idx}",
                    "sku": f"STAT-{idx}",
                    "category_id": cat_id,
                    "quantity": q,
                },
                headers=headers,
            )

        resp = client.get("/api/dashboard/stats", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        # At least the items we just created should be counted
        assert data["total_items"] >= 3
