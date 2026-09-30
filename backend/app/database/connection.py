"""
MongoDB Atlas connection handling.

Uses Motor (the async MongoDB driver) so database calls don't block the
FastAPI event loop. A single client is created at startup and reused for
the lifetime of the application.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


database = Database()


async def connect_to_mongo() -> None:
    settings = get_settings()
    logger.info("Connecting to MongoDB Atlas...")

    database.client = AsyncIOMotorClient(settings.mongodb_uri)
    database.db = database.client[settings.mongodb_db_name]

    # Fail fast if the connection / credentials are invalid.
    await database.client.admin.command("ping")
    logger.info("MongoDB connection established (db=%s)", settings.mongodb_db_name)

    await _ensure_indexes()


async def close_mongo_connection() -> None:
    if database.client is not None:
        database.client.close()
        logger.info("MongoDB connection closed")


async def _ensure_indexes() -> None:
    """
    Create indexes required so far.
    Later phases will add indexes for analyses/reports/plans/etc.
    """
    if database.db is None:
        return
    await database.db["users"].create_index("email", unique=True)

    # Phase 2: conversations are always queried scoped to their owner and
    # listed most-recently-updated first, so a single compound index
    # covers both the ownership lookup and the sort.
    await database.db["conversations"].create_index([("user_id", 1), ("updated_at", -1)])

    # Phase 3: analyses are always queried scoped to owner + conversation,
    # and the "latest analysis" lookup sorts by created_at descending.
    await database.db["analyses"].create_index(
        [("conversation_id", 1), ("user_id", 1), ("created_at", -1)]
    )

    # Phase 4: reports follow the exact same access pattern as analyses
    # (scoped to owner + conversation, latest-first).
    await database.db["reports"].create_index(
        [("conversation_id", 1), ("user_id", 1), ("created_at", -1)]
    )
    # A user's own reports are also listed on their own (dashboard "recent
    # reports"), independent of any one conversation.
    await database.db["reports"].create_index([("user_id", 1), ("created_at", -1)])

    # Phase 4: plans are queried scoped to owner, optionally filtered by
    # status, and listed newest-first.
    await database.db["plans"].create_index([("user_id", 1), ("status", 1), ("created_at", -1)])


def get_database() -> AsyncIOMotorDatabase:
    """
    FastAPI dependency-friendly accessor for the database instance.
    Raises a clear error if called before startup has run.
    """
    if database.db is None:
        raise RuntimeError("Database has not been initialized. Did the app start correctly?")
    return database.db
