# backend/app/schemas/schemas.py
#
# WHY THIS FILE EXISTS:
# Schemas define the shape of data coming IN (requests) and going OUT (responses).
# FastAPI uses Pydantic to automatically validate all incoming data.
# If someone sends a request without an email field, FastAPI rejects it
# automatically before your code even runs — no manual checking needed.

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ─── AUTH ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    native_language: str = "English"
    target_language: str = "German"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: int
    name: str
    email: str
    target_language: str
    cefr_level: str


# ─── GRAMMAR ─────────────────────────────────────────────────────────────────

class GrammarCheckRequest(BaseModel):
    text: str
    language: str = "German"
    cefr_level: str = "B1"


class GrammarError(BaseModel):
    original: str        # the incorrect phrase
    correction: str      # the corrected version
    rule: str            # grammar rule that was broken
    explanation: str     # plain English explanation
    advanced: str        # a harder/better alternative


class GrammarCheckResponse(BaseModel):
    corrected_text: str
    errors: List[GrammarError]
    session_id: int


# ─── WRITING ─────────────────────────────────────────────────────────────────

class WritingSubmitRequest(BaseModel):
    text: str
    prompt: str
    language: str = "German"
    exam_type: str = "Goethe B2"
    cefr_level: str = "B2"


class WritingDimension(BaseModel):
    score: float         # 0–10
    feedback: str        # written comment


class WritingEvalResponse(BaseModel):
    task_achievement: WritingDimension
    grammar: WritingDimension
    vocabulary: WritingDimension
    coherence: WritingDimension
    overall_band: float
    model_answer: str
    submission_id: int


# ─── SPEAKING ────────────────────────────────────────────────────────────────

class SpeakingReplyResponse(BaseModel):
    transcript: str           # what the user said (from Whisper)
    ai_response_text: str     # what Claude said back
    audio_url: str            # ElevenLabs audio to play


class FluencyReportResponse(BaseModel):
    pronunciation_notes: str
    grammar_mistakes: List[str]
    vocabulary_feedback: str
    band_score: float
    overall_comment: str
    session_id: int


# ─── FLASHCARDS ──────────────────────────────────────────────────────────────

class CreateDeckRequest(BaseModel):
    title: str
    language: str
    description: str = ""


class CreateCardRequest(BaseModel):
    deck_id: int
    front_text: str
    back_text: str


class CardReviewRequest(BaseModel):
    card_id: int
    rating: int   # 0 = Again, 3 = Hard, 5 = Easy  (SM-2 quality score)


class CardResponse(BaseModel):
    id: int
    front_text: str
    back_text: str
    example_sentence: Optional[str]
    mnemonic: Optional[str]
    next_review_at: datetime
    ease_factor: float
    interval: int

    class Config:
        from_attributes = True


# ─── PROGRESS ────────────────────────────────────────────────────────────────

class ProgressResponse(BaseModel):
    grammar: float = 0.0
    writing: float = 0.0
    speaking: float = 0.0
    vocabulary: float = 0.0
    listening: float = 0.0