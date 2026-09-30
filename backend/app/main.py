"""
EVARA — Backend entrypoint (Phase 2: Conversation Engine).

Provides:
    GET    /health
    POST   /api/auth/register
    POST   /api/auth/login
    GET    /api/auth/me
    POST   /api/conversations
    GET    /api/conversations
    GET    /api/conversations/{conversation_id}
    POST   /api/conversations/{conversation_id}/messages
    DELETE /api/conversations/{conversation_id}

Later phases will register additional routers (analysis, dashboard,
planner, progress, professionals) from app/api/*.py without modifying
this file's structure.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.conversations import router as conversations_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.database.connection import close_mongo_connection, connect_to_mongo

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Starting EVARA backend...")
    await connect_to_mongo()
    yield
    # --- Shutdown ---
    await close_mongo_connection()
    logger.info("EVARA backend shut down cleanly.")


settings = get_settings()

app = FastAPI(
    title="EVARA API",
    description=(
        "Backend API for EVARA — an NLP-driven conversational "
        "wellbeing-support and reflection system. This is a prototype "
        "and is not a substitute for professional mental-health care."
    ),
    version="0.2.0-phase2",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Centralized error handling -------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # pydantic v2 error dicts can carry the raw exception instance in
    # ctx.error (e.g. from a custom field_validator that raises
    # ValueError), which json.dumps cannot serialize on its own.
    # jsonable_encoder converts anything non-JSON-native into a safe
    # representation; the human-readable message is preserved in "msg"
    # regardless. Without this, a validation failure on a custom
    # validator crashes this very handler with a 500 instead of a 422.
    safe_errors = jsonable_encoder(exc.errors())
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, safe_errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request data.", "errors": safe_errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# --- Routers -----------------------------------------------------------------

app.include_router(auth_router)
app.include_router(conversations_router)


# --- Health --------------------------------------------------------------

@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {
        "status": "ok",
        "service": "evara-backend",
        "environment": settings.environment,
        "mock_slm": settings.mock_slm,
    }
