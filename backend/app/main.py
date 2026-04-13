# backend/app/main.py
#
# WHY THIS FILE EXISTS:
# This is the entry point of the entire backend.
# It creates the FastAPI app, registers all routers (auth, grammar, writing, etc.),
# sets up CORS (so your React frontend can talk to it), and creates database tables.
#
# When you run: uvicorn app.main:app --reload
# Python runs this file, starts the server, and listens for requests.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.config import settings

# Import all models so SQLAlchemy knows about them when creating tables
from app.models import user  # noqa: F401

# Import all routers
from app.routers import auth, grammar, writing, speaking, flashcards, progress

# Create the FastAPI app
app = FastAPI(
    title="LinguaAI API",
    description="Backend API for the LinguaAI language learning platform",
    version="1.0.0"
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
# CORS (Cross-Origin Resource Sharing) allows your React app (localhost:5173)
# to make requests to your FastAPI server (localhost:8000).
# Without this, the browser blocks all requests between different ports/domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],   # allow GET, POST, PUT, DELETE etc.
    allow_headers=["*"],   # allow Authorization header (for JWT)
)

# ─── Register Routers ────────────────────────────────────────────────────────
# Each router handles a group of endpoints.
# The prefix is already set in each router file, so no prefix needed here.
app.include_router(auth.router)
app.include_router(grammar.router)
app.include_router(writing.router)
app.include_router(speaking.router)
app.include_router(flashcards.router)
app.include_router(progress.router)


# ─── Create Database Tables ──────────────────────────────────────────────────
# This runs when the server starts. It reads all the SQLAlchemy models
# and creates the corresponding tables in PostgreSQL if they don't exist yet.
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "LinguaAI API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}