import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

load_dotenv()

logger = logging.getLogger(__name__)

ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()

# ── Fail-fast: require a strong JWT secret ────────────────────────────────────
SECRET_KEY: str = os.getenv("JWT_SECRET", "")
if not SECRET_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError(
            "JWT_SECRET environment variable must be set and at least 32 characters long. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        )
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning(
        "JWT_SECRET not set; using an ephemeral development-only secret. "
        "Set JWT_SECRET to keep tokens valid across restarts."
    )
elif len(SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET environment variable must be set and at least 32 characters long. "
        'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
    )

ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS: int = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── Dependency ────────────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user
