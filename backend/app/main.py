import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app import models
from app.database import engine
from app.limiter import limiter

load_dotenv()

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# ── App ───────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan context manager – replaces @app.on_event('startup')."""
    # ── Startup ──
    models.Base.metadata.create_all(bind=engine)
    yield
    # ── Shutdown (add cleanup here if needed) ──


# Fix 5 (High): Disable API docs in production to prevent reconnaissance
if ENVIRONMENT == "production":
    app = FastAPI(
        title="InvenTrack API",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
else:
    app = FastAPI(title="InvenTrack API", lifespan=lifespan)

# ── Rate Limiter (Fix 4 – High) ──────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Security Headers Middleware (Fix 9 – Medium) ─────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; object-src 'none';"
        )
        if ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# ── CORS (Fix 3 – High) ──────────────────────────────────────────────────────
# Replaces allow_origins=["*"] with an explicit whitelist from env.

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)



# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "InvenTrack API"}


# ── Routers (imported after app is created) ───────────────────────────────────

from app.routers.auth import router as auth_router        # noqa: E402
from app.routers.dashboard import router as dashboard_router  # noqa: E402
from app.routers.inventories import router as inventories_router  # noqa: E402
from app.routers.items import router as items_router      # noqa: E402

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(inventories_router)
app.include_router(items_router)
