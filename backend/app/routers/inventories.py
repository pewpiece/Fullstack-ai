from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/api/inventories", tags=["inventories"])


@router.get("", response_model=list[schemas.InventoryOut])
def list_inventories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_inventories(db, current_user.id)


@router.post("", response_model=schemas.InventoryOut, status_code=201)
def create_inventory(
    data: schemas.InventoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.create_inventory(db, data, current_user.id)


@router.get("/{inv_id}", response_model=schemas.InventoryOut)
def get_inventory(
    inv_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    inv = crud.get_inventory(db, inv_id, current_user.id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Inventory {inv_id} not found.")
    return inv


@router.put("/{inv_id}", response_model=schemas.InventoryOut)
def update_inventory(
    inv_id: str,
    data: schemas.InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    inv = crud.update_inventory(db, inv_id, data, current_user.id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Inventory {inv_id} not found.")
    return inv


@router.delete("/{inv_id}", status_code=204)
def delete_inventory(
    inv_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.delete_inventory(db, inv_id, current_user.id):
        raise HTTPException(status_code=404, detail=f"Inventory {inv_id} not found.")


@router.get("/{inv_id}/categories", response_model=list[schemas.CategoryOut])
def list_categories(
    inv_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cats = crud.get_categories(db, inv_id, current_user.id)
    if cats is None:
        raise HTTPException(status_code=404, detail=f"Inventory {inv_id} not found.")
    return cats


@router.post("/{inv_id}/categories", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    inv_id: str,
    data: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cat = crud.create_category(db, inv_id, data, current_user.id)
    if cat is None:
        raise HTTPException(status_code=404, detail=f"Inventory {inv_id} not found.")
    return cat


@router.put("/{inv_id}/categories/{cid}", response_model=schemas.CategoryOut)
def update_category(
    inv_id: str,
    cid: str,
    data: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cat = crud.update_category(db, cid, data, current_user.id)
    if cat is None:
        raise HTTPException(status_code=404, detail=f"Category {cid} not found.")
    return cat


@router.delete("/{inv_id}/categories/{cid}", status_code=204)
def delete_category(
    inv_id: str,
    cid: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.delete_category(db, cid, current_user.id):
        raise HTTPException(status_code=404, detail=f"Category {cid} not found.")
