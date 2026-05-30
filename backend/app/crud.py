import uuid
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import hash_password


# ── User ──────────────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, data: schemas.UserRegister) -> models.User:
    name = data.name if data.name else data.email.split("@")[0]
    user = models.User(
        id=str(uuid.uuid4()),
        email=data.email,
        hashed_password=hash_password(data.password),
        name=name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Inventory ─────────────────────────────────────────────────────────────────

def get_inventories(db: Session, owner_id: str) -> List[schemas.InventoryOut]:
    inventories = (
        db.query(models.Inventory)
        .filter(models.Inventory.owner_id == owner_id)
        .all()
    )
    result = []
    for inv in inventories:
        cat_count = (
            db.query(func.count(models.Category.id))
            .filter(models.Category.inventory_id == inv.id)
            .scalar()
        )
        item_count = (
            db.query(func.count(models.InventoryItem.id))
            .join(models.Category, models.InventoryItem.category_id == models.Category.id)
            .filter(models.Category.inventory_id == inv.id)
            .scalar()
        )
        result.append(
            schemas.InventoryOut(
                id=inv.id,
                name=inv.name,
                description=inv.description,
                category_count=cat_count or 0,
                item_count=item_count or 0,
                created_at=inv.created_at,
            )
        )
    return result


def get_inventory(
    db: Session, inv_id: str, owner_id: str
) -> Optional[schemas.InventoryOut]:
    inv = (
        db.query(models.Inventory)
        .filter(models.Inventory.id == inv_id, models.Inventory.owner_id == owner_id)
        .first()
    )
    if not inv:
        return None
    cat_count = (
        db.query(func.count(models.Category.id))
        .filter(models.Category.inventory_id == inv.id)
        .scalar()
    )
    item_count = (
        db.query(func.count(models.InventoryItem.id))
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .filter(models.Category.inventory_id == inv.id)
        .scalar()
    )
    return schemas.InventoryOut(
        id=inv.id,
        name=inv.name,
        description=inv.description,
        category_count=cat_count or 0,
        item_count=item_count or 0,
        created_at=inv.created_at,
    )


def create_inventory(
    db: Session, data: schemas.InventoryCreate, owner_id: str
) -> schemas.InventoryOut:
    inv = models.Inventory(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        owner_id=owner_id,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return schemas.InventoryOut(
        id=inv.id,
        name=inv.name,
        description=inv.description,
        category_count=0,
        item_count=0,
        created_at=inv.created_at,
    )


def update_inventory(
    db: Session, inv_id: str, data: schemas.InventoryUpdate, owner_id: str
) -> Optional[schemas.InventoryOut]:
    inv = (
        db.query(models.Inventory)
        .filter(models.Inventory.id == inv_id, models.Inventory.owner_id == owner_id)
        .first()
    )
    if not inv:
        return None
    inv.name = data.name
    inv.description = data.description
    db.commit()
    db.refresh(inv)
    return get_inventory(db, inv_id, owner_id)


def delete_inventory(db: Session, inv_id: str, owner_id: str) -> bool:
    inv = (
        db.query(models.Inventory)
        .filter(models.Inventory.id == inv_id, models.Inventory.owner_id == owner_id)
        .first()
    )
    if not inv:
        return False
    db.delete(inv)
    db.commit()
    return True


# ── Category ──────────────────────────────────────────────────────────────────

def _inventory_owned(db: Session, inv_id: str, owner_id: str) -> bool:
    return (
        db.query(models.Inventory)
        .filter(models.Inventory.id == inv_id, models.Inventory.owner_id == owner_id)
        .first()
    ) is not None


def get_categories(
    db: Session, inv_id: str, owner_id: str
) -> Optional[List[schemas.CategoryOut]]:
    if not _inventory_owned(db, inv_id, owner_id):
        return None
    cats = (
        db.query(models.Category)
        .filter(models.Category.inventory_id == inv_id)
        .all()
    )
    result = []
    for cat in cats:
        item_count = (
            db.query(func.count(models.InventoryItem.id))
            .filter(models.InventoryItem.category_id == cat.id)
            .scalar()
        )
        total_qty = (
            db.query(func.sum(models.InventoryItem.quantity))
            .filter(models.InventoryItem.category_id == cat.id)
            .scalar()
        )
        result.append(
            schemas.CategoryOut(
                id=cat.id,
                name=cat.name,
                description=cat.description,
                inventory_id=cat.inventory_id,
                item_count=item_count or 0,
                total_quantity=total_qty or 0,
                created_at=cat.created_at,
            )
        )
    return result


def get_category(
    db: Session, cat_id: str, owner_id: str
) -> Optional[schemas.CategoryOut]:
    cat = db.query(models.Category).filter(models.Category.id == cat_id).first()
    if not cat:
        return None
    if not _inventory_owned(db, cat.inventory_id, owner_id):
        return None
    item_count = (
        db.query(func.count(models.InventoryItem.id))
        .filter(models.InventoryItem.category_id == cat.id)
        .scalar()
    )
    total_qty = (
        db.query(func.sum(models.InventoryItem.quantity))
        .filter(models.InventoryItem.category_id == cat.id)
        .scalar()
    )
    return schemas.CategoryOut(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        inventory_id=cat.inventory_id,
        item_count=item_count or 0,
        total_quantity=total_qty or 0,
        created_at=cat.created_at,
    )


def create_category(
    db: Session, inv_id: str, data: schemas.CategoryCreate, owner_id: str
) -> Optional[schemas.CategoryOut]:
    if not _inventory_owned(db, inv_id, owner_id):
        return None
    cat = models.Category(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        inventory_id=inv_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return schemas.CategoryOut(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        inventory_id=cat.inventory_id,
        item_count=0,
        total_quantity=0,
        created_at=cat.created_at,
    )


def update_category(
    db: Session, cat_id: str, data: schemas.CategoryUpdate, owner_id: str
) -> Optional[schemas.CategoryOut]:
    cat = db.query(models.Category).filter(models.Category.id == cat_id).first()
    if not cat:
        return None
    if not _inventory_owned(db, cat.inventory_id, owner_id):
        return None
    cat.name = data.name
    cat.description = data.description
    db.commit()
    db.refresh(cat)
    return get_category(db, cat_id, owner_id)


def delete_category(db: Session, cat_id: str, owner_id: str) -> bool:
    cat = db.query(models.Category).filter(models.Category.id == cat_id).first()
    if not cat:
        return False
    if not _inventory_owned(db, cat.inventory_id, owner_id):
        return False
    db.delete(cat)
    db.commit()
    return True


# ── Items ─────────────────────────────────────────────────────────────────────

def get_items(
    db: Session,
    owner_id: str,
    cat_id: Optional[str] = None,
    inv_id: Optional[str] = None,
) -> List[schemas.ItemOut]:
    q = (
        db.query(models.InventoryItem)
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(models.Inventory.owner_id == owner_id)
    )
    if cat_id:
        q = q.filter(models.InventoryItem.category_id == cat_id)
    if inv_id:
        q = q.filter(models.Category.inventory_id == inv_id)
    return [_item_to_out(i) for i in q.all()]


def get_item(
    db: Session, item_id: str, owner_id: str
) -> Optional[schemas.ItemOut]:
    item = (
        db.query(models.InventoryItem)
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(
            models.InventoryItem.id == item_id,
            models.Inventory.owner_id == owner_id,
        )
        .first()
    )
    if not item:
        return None
    return _item_to_out(item)


def create_item(
    db: Session, data: schemas.ItemCreate, owner_id: str
) -> Optional[schemas.ItemOut]:
    # Verify the category belongs to the owner
    cat = db.query(models.Category).filter(models.Category.id == data.category_id).first()
    if not cat:
        return None
    if not _inventory_owned(db, cat.inventory_id, owner_id):
        return None
    item = models.InventoryItem(
        id=str(uuid.uuid4()),
        name=data.name,
        sku=data.sku.strip().upper(),
        category_id=data.category_id,
        quantity=data.quantity,
        min_stock=data.min_stock,
        price=data.price,
        cost=data.cost,
        supplier=data.supplier,
        unit=data.unit,
        status=data.status,
        image=data.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


def update_item(
    db: Session, item_id: str, data: schemas.ItemUpdate, owner_id: str
) -> Optional[schemas.ItemOut]:
    item = (
        db.query(models.InventoryItem)
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(
            models.InventoryItem.id == item_id,
            models.Inventory.owner_id == owner_id,
        )
        .first()
    )
    if not item:
        return None
    item.name = data.name
    item.sku = data.sku.strip().upper()
    item.category_id = data.category_id
    item.quantity = data.quantity
    item.min_stock = data.min_stock
    item.price = data.price
    item.cost = data.cost
    item.supplier = data.supplier
    item.unit = data.unit
    item.status = data.status
    item.image = data.image
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


def delete_item(db: Session, item_id: str, owner_id: str) -> bool:
    item = (
        db.query(models.InventoryItem)
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(
            models.InventoryItem.id == item_id,
            models.Inventory.owner_id == owner_id,
        )
        .first()
    )
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


# ── Dashboard ─────────────────────────────────────────────────────────────────

def get_dashboard_stats(db: Session, owner_id: str) -> schemas.DashboardStats:
    inventory_count = (
        db.query(func.count(models.Inventory.id))
        .filter(models.Inventory.owner_id == owner_id)
        .scalar()
        or 0
    )

    category_count = (
        db.query(func.count(models.Category.id))
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(models.Inventory.owner_id == owner_id)
        .scalar()
        or 0
    )

    items_q = (
        db.query(models.InventoryItem)
        .join(models.Category, models.InventoryItem.category_id == models.Category.id)
        .join(models.Inventory, models.Category.inventory_id == models.Inventory.id)
        .filter(models.Inventory.owner_id == owner_id)
    )
    items = items_q.all()

    total_items = len(items)
    in_stock = sum(1 for i in items if i.status == "in-stock")
    low_stock = sum(1 for i in items if i.status == "low-stock")
    out_of_stock = sum(1 for i in items if i.status == "out-of-stock")
    total_value = sum((i.price * i.quantity) for i in items)
    total_cost = sum((i.cost * i.quantity) for i in items)

    return schemas.DashboardStats(
        total_items=total_items,
        in_stock=in_stock,
        low_stock=low_stock,
        out_of_stock=out_of_stock,
        total_value=round(total_value, 2),
        total_cost=round(total_cost, 2),
        inventory_count=inventory_count,
        category_count=category_count,
    )


# ── Internal helper ───────────────────────────────────────────────────────────

def _item_to_out(item: models.InventoryItem) -> schemas.ItemOut:
    return schemas.ItemOut(
        id=item.id,
        name=item.name,
        sku=item.sku,
        category_id=item.category_id,
        quantity=item.quantity,
        min_stock=item.min_stock,
        price=item.price,
        cost=item.cost,
        supplier=item.supplier,
        unit=item.unit,
        status=item.status,
        image=item.image,
        last_updated=item.last_updated,
    )
