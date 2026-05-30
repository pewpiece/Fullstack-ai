import os
import logging

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

SQLITE_URL = "sqlite:///./sql_app.db"


def _build_engine():
    """Build the SQLAlchemy engine.

    In test / local-development mode (DATABASE_URL unset), fall back to a local
    SQLite file.  In any other scenario the configured DATABASE_URL is used and
    failures are treated as fatal so that silent data-integrity issues cannot
    occur (Fix 7 – Medium).
    """
    if DATABASE_URL:
        try:
            engine = create_engine(DATABASE_URL)
            # Verify connectivity immediately
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Connected to the configured database.")
            return engine
        except Exception as e:
            logger.critical(
                "Cannot connect to the configured database. "
                "Refusing to start. Error type: %s",
                type(e).__name__,
            )
            raise RuntimeError(
                "Database connection failed. Check DATABASE_URL and ensure "
                "the database is reachable before starting the application."
            ) from e
    else:
        logger.warning(
            "DATABASE_URL not set. Using local SQLite at %s. "
            "This is only suitable for development / testing.",
            SQLITE_URL,
        )
        return create_engine(SQLITE_URL, connect_args={"check_same_thread": False})


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
