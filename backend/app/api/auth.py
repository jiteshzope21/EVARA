"""
Authentication API.

Endpoints:
    POST /api/auth/register
    POST /api/auth/login
    GET  /api/auth/me

Also exposes `get_current_user`, a FastAPI dependency that later routers
(conversations, analysis, etc.) will use to restrict access to the owning
user's data (see PRIVACY requirements in the project spec).
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logging import get_logger
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.database.connection import get_database
from app.models.user import Token, UserCreate, UserInDB, UserLogin, UserOut

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple HTTP Bearer scheme: Swagger's "Authorize" dialog shows a single
# token field ("Value: <JWT>") and sends `Authorization: Bearer <JWT>`.
# We issue tokens ourselves via POST /api/auth/login (JSON email+password),
# so we intentionally do NOT use OAuth2PasswordBearer — that scheme makes
# Swagger render the OAuth2 password-flow form (username/password/
# client_id/client_secret), which does not match how this API issues or
# expects tokens.
bearer_scheme = HTTPBearer(auto_error=False)


def _user_doc_to_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        created_at=doc["created_at"],
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)) -> Token:
    existing = await db["users"].find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }

    result = await db["users"].insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    logger.info("New user registered: %s", user_doc["email"])

    access_token = create_access_token(subject=str(result.inserted_id))
    return Token(access_token=access_token, user=_user_doc_to_out(user_doc))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncIOMotorDatabase = Depends(get_database)) -> Token:
    user_doc = await db["users"].find_one({"email": payload.email.lower()})

    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user_doc:
        raise invalid_credentials

    if not verify_password(payload.password, user_doc["password_hash"]):
        raise invalid_credentials

    access_token = create_access_token(subject=str(user_doc["_id"]))
    return Token(access_token=access_token, user=_user_doc_to_out(user_doc))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserInDB:
    """
    Shared dependency for protected routes. Validates the JWT, loads the
    user from MongoDB, and returns it. Raises 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        raise credentials_exception

    user_doc = await db["users"].find_one({"_id": object_id})
    if user_doc is None:
        raise credentials_exception

    return UserInDB(
        _id=str(user_doc["_id"]),
        name=user_doc["name"],
        email=user_doc["email"],
        password_hash=user_doc["password_hash"],
        created_at=user_doc["created_at"],
    )


@router.get("/me", response_model=UserOut)
async def read_current_user(current_user: UserInDB = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        created_at=current_user.created_at,
    )
