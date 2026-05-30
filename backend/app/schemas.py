from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


class UserRegister(BaseModel):
    email: str
    password: str = Field(..., min_length=12, max_length=128)
    name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must contain at least one special character.")
        return value


class UserLogin(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: Optional[str] = None


# ── Inventory ─────────────────────────────────────────────────────────────────

class InventoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class InventoryUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    category_count: int = 0
    item_count: int = 0
    created_at: datetime


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    inventory_id: str
    item_count: int = 0
    total_quantity: int = 0
    created_at: datetime


# ── Item ──────────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str
    sku: str
    category_id: str
    quantity: int = 0
    min_stock: int = 0
    price: float = 0.0
    cost: float = 0.0
    supplier: Optional[str] = None
    unit: str = "pieces"
    status: str = "in-stock"
    image: Optional[str] = None


class ItemUpdate(BaseModel):
    name: str
    sku: str
    category_id: str
    quantity: int = 0
    min_stock: int = 0
    price: float = 0.0
    cost: float = 0.0
    supplier: Optional[str] = None
    unit: str = "pieces"
    status: str = "in-stock"
    image: Optional[str] = None


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    sku: str
    category_id: str
    quantity: int
    min_stock: int
    price: float
    cost: float
    supplier: Optional[str] = None
    unit: str
    status: str
    image: Optional[str] = None
    last_updated: datetime


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_items: int
    in_stock: int
    low_stock: int
    out_of_stock: int
    total_value: float
    total_cost: float
    inventory_count: int
    category_count: int
