import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import create_access_token, get_current_user, verify_password
from app.database import get_db
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=201)
def register(data: schemas.UserRegister, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email must be unique: provided email is already registered.",
        )
    user = crud.create_user(db, data)
    token = create_access_token({"sub": user.id})
    logger.info("User registered: user_id=%s email=%s", user.id, user.email)
    return schemas.Token(access_token=token, token_type="bearer")


@router.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_email(db, form_data.username)
    if not user:
        logger.warning("Login failure: email=%s reason=user_not_found", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(form_data.password, user.hashed_password):
        logger.warning("Login failure: email=%s reason=wrong_password", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user.id})
    logger.info("Login success: user_id=%s", user.id)
    return schemas.Token(access_token=token, token_type="bearer")


@router.get("/me", response_model=schemas.UserPublic)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
