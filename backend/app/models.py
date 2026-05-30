from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventories = relationship(
        "Inventory", back_populates="owner", cascade="all, delete-orphan"
    )


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="inventories")
    categories = relationship(
        "Category", back_populates="inventory", cascade="all, delete-orphan"
    )


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    inventory_id = Column(String, ForeignKey("inventories.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory = relationship("Inventory", back_populates="categories")
    items = relationship(
        "InventoryItem", back_populates="category", cascade="all, delete-orphan"
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    quantity = Column(Integer, default=0)
    min_stock = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    supplier = Column(String, nullable=True)
    unit = Column(String, default="pieces")
    status = Column(String, default="in-stock")
    image = Column(String, nullable=True)
    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    category = relationship("Category", back_populates="items")
