# EVARA — Backend

An NLP-driven conversational wellbeing-support and reflection system.
**This is a prototype. It is not a therapist, doctor, diagnostic system,
or emergency service.**

> **Naming note:** the project was renamed from "Sahaara AI" to **EVARA**.
> Purely technical identifiers that predate the rename — the MongoDB
> database name (`sahaara_ai`), Python package/module names, API paths,
> environment variable names, and collection names — were intentionally
> left unchanged to avoid breaking the existing Atlas connection and
> verified Phase 1/2 functionality. Only user-facing/display naming
> (API title, health-check response, log messages, the assistant's
> self-introduction, documentation) was updated to EVARA.

This README documents **Phase 1 — Backend Foundation** and
**Phase 2 — Conversation Engine**. Later phases will extend this
document as they are implemented.

---

## Phase 2 scope (NEW)

- Conversation data model: 8-stage reflective workflow (`opening` →
  `problem_exploration` → `cause_reflection` → `prioritization` →
  `strategy_exploration` → `action_planning` → `time_frequency` →
  `closure`)
- Deterministic, rule-based conversation engine (`app/services/conversation_service.py`)
  — **no NLP, no SLM, no ML** yet. One user message advances the
  conversation by exactly one stage; each stage has a fixed, non-clinical,
  open-ended prompt. At closure, the assistant reflects the user's own
  action-planning and time/frequency answers back to them via plain
  template substitution — not analysis.
- `POST   /api/conversations` — create a conversation (auto-generates the
  opening prompt)
- `GET    /api/conversations` — list the authenticated user's conversations
- `GET    /api/conversations/{conversation_id}` — retrieve one conversation
- `POST   /api/conversations/{conversation_id}/messages` — send a message,
  advance the engine, persist both messages, return the updated conversation
- `DELETE /api/conversations/{conversation_id}` — delete a conversation
- All conversation endpoints require the same HTTP Bearer JWT auth as
  Phase 1, and every query is scoped to `user_id == current_user.id` —
  a conversation ID alone is never sufficient to read, modify, or delete
  another user's data (verified with a two-user isolation test, see below)
- New MongoDB collection: `conversations`, with a compound index on
  `(user_id, updated_at)`
- **Fix to a Phase 1 file:** `app/main.py`'s validation-error handler used
  `exc.errors()` directly, which fails to JSON-serialize when a custom
  Pydantic `field_validator` raises `ValueError` (the raw exception object
  ends up in `ctx.error`). Phase 2's empty-message validation triggered
  this. Fixed by wrapping the errors in `jsonable_encoder(...)` before
  building the response — the human-readable `msg` field is unaffected.
  This is the only change to Phase 1 code in this phase.

---

## Phase 1 scope

- FastAPI application with startup/shutdown lifecycle
- MongoDB Atlas connection (via Motor, async)
- Centralized configuration via environment variables
- Structured logging
- JWT-based authentication
- Secure password hashing (bcrypt via passlib)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)
- `GET /health`
- Centralized error handling (validation errors + unhandled exceptions)

The conversational chatbot, NLP pipeline, and SLM are **not** implemented
yet — those begin in Phase 2 onward.

---

## 1. Prerequisites

- Python 3.11+ (3.10 also works)
- A MongoDB Atlas cluster (free tier is fine) and its connection string
  - In Atlas: create a database user, and allow network access from your
    IP (or `0.0.0.0/0` for local development only)

---

## 2. Setup

```bash
cd backend

# create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# install dependencies
pip install -r requirements.txt

# configure environment
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
JWT_SECRET=<a long random string>
```

Generate a strong `JWT_SECRET`, e.g.:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 3. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

---

## 4. Phase 1 testing steps

### a) Health check

```bash
curl http://localhost:8000/health
```

Expected output:

```json
{"status": "ok", "service": "evara-backend", "environment": "development", "mock_slm": true}
```

### b) Register a user

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "SecurePass123"}'
```

Expected: HTTP 201, a JSON body containing `access_token` and a `user`
object (no `password_hash` field is ever returned).

### c) Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123"}'
```

Expected: HTTP 200, `access_token` + `user`.

### d) Access a protected endpoint

```bash
TOKEN="paste-the-access_token-here"

curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200, the current user's profile (`id`, `name`, `email`,
`created_at`).

### e) Negative tests (should fail correctly)

```bash
# duplicate registration -> 409
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "SecurePass123"}'

# wrong password -> 401
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "WrongPassword"}'

# no token -> 401
curl http://localhost:8000/api/auth/me
```

---

## 5. Phase 1 completion checklist

- [ ] `.env` created from `.env.example` and filled in (not committed)
- [ ] `GET /health` returns `status: ok`
- [ ] A user can register (`201`, receives a JWT)
- [ ] Duplicate registration is rejected (`409`)
- [ ] A user can log in (`200`, receives a JWT)
- [ ] Wrong password is rejected (`401`)
- [ ] `GET /api/auth/me` works with a valid token (`200`)
- [ ] `GET /api/auth/me` without a token is rejected (`401`)
- [ ] Passwords are stored only as bcrypt hashes (verify in Atlas: the
      `users` collection has `password_hash`, never a plaintext password)
- [ ] `.env` is not committed (check `.gitignore`)

Once every box is checked, Phase 1 is complete. **Do not start Phase 2
(Conversation Engine) until this is confirmed working end-to-end.**

---

## Project structure (Phase 1 + Phase 2)

```text
backend/
├── app/
│   ├── main.py                        # FastAPI app, lifespan, error handlers, health, routers
│   ├── api/
│   │   ├── auth.py                    # register / login / me + get_current_user dependency
│   │   └── conversations.py           # conversation REST endpoints (Phase 2)
│   ├── core/
│   │   ├── config.py                  # Settings (env-driven)
│   │   ├── security.py                # password hashing + JWT
│   │   └── logging.py                 # logging setup
│   ├── database/
│   │   └── connection.py              # MongoDB Atlas connection (Motor) + indexes
│   ├── models/
│   │   ├── user.py                    # User Pydantic models
│   │   └── conversation.py            # Conversation/Message Pydantic models (Phase 2)
│   └── services/
│       └── conversation_service.py    # Deterministic conversation engine (Phase 2)
├── tests/
│   ├── conftest.py                    # pytest fixtures: mocked DB + httpx test client
│   ├── test_phase1_auth.py            # Phase 1 regression suite
│   └── test_phase2_conversations.py   # Phase 2 conversation engine suite
├── requirements.txt
├── requirements-dev.txt               # test-only dependencies (pytest, mongomock, etc.)
├── pytest.ini
├── .env.example
├── .gitignore
└── README.md
```

## 6. Running the automated test suite (Phase 2)

Tests use a mocked, in-memory MongoDB (`mongomock_motor`) — **no real
Atlas connection or credentials are needed to run them**, and they never
touch your real database.

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt
pytest -v
```

`tests/conftest.py` sets safe dummy environment variables
(`MONGODB_URI`, `JWT_SECRET`, etc.) before the app is imported, so the
suite runs standalone without a local `.env` file. It then points the
app's existing database singleton at an in-memory mock for each test —
no second database connection system is introduced.

What's covered (see the two test files for the full list): Phase 1
register/login/`/me` regression, conversation creation and the
auto-generated opening message, listing, retrieval, the full 7-message
stage progression to closure, the closure summary correctly combining a
**distinct** action-planning answer and time/frequency answer without
mixing them up, behavior after closure, empty/whitespace/malformed
message rejection, invalid and missing conversation IDs, deletion, and
two-user ownership isolation across read/message/delete.

### Phase 2 testing notes

Automated tests run against a **mocked** MongoDB, not real Atlas.
Register/login continue to work against real Atlas as in Phase 1 — the
conversation endpoints use the exact same `get_database` connection, so
no separate verification of the MongoDB connection itself was needed
for Phase 2.

Folders for later phases (`app/nlp`, `app/slm`, `app/safety`,
`app/reasoning`, `training/`, `data/`, `saved_models/`) already exist as
empty scaffolding so the architecture stays stable across phases, but
contain no logic yet.

---

## Notes on privacy (Phase 1)

- Passwords are never stored or logged in plaintext.
- JWT secret and MongoDB credentials are read from environment variables
  only — never hard-coded.
- `.env` is git-ignored.
