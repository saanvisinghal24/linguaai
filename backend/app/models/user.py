# backend/app/models/user.py
#
# WHY THIS FILE EXISTS:
# Each class here = one table in your PostgreSQL database.
# SQLAlchemy reads these classes and creates the actual SQL tables for you.
# You never have to write CREATE TABLE statements manually.

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    """
    The users table — stores everyone who registers on LinguaAI.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    native_language = Column(String(50), default="English")
    target_language = Column(String(50), default="German")
    cefr_level = Column(String(5), default="A1")  # A1, A2, B1, B2, C1, C2
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships — SQLAlchemy will automatically load related records
    grammar_sessions = relationship("GrammarSession", back_populates="user")
    writing_submissions = relationship("WritingSubmission", back_populates="user")
    speaking_sessions = relationship("SpeakingSession", back_populates="user")
    flashcard_decks = relationship("FlashcardDeck", back_populates="user")
    progress = relationship("UserProgress", back_populates="user")


class GrammarSession(Base):
    """
    Stores every grammar check the user does.
    We keep these to build their personal error profile.
    """
    __tablename__ = "grammar_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language = Column(String(50), nullable=False)
    input_text = Column(Text, nullable=False)
    corrected_text = Column(Text)
    errors_json = Column(JSON)   # list of {error, rule, correction, example}
    cefr_level = Column(String(5))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="grammar_sessions")


class WritingSubmission(Base):
    """
    Stores every essay the user submits for AI evaluation.
    """
    __tablename__ = "writing_submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language = Column(String(50), nullable=False)
    exam_type = Column(String(50))       # e.g. "Goethe B2"
    prompt_text = Column(Text)           # the writing prompt given to the user
    submitted_text = Column(Text, nullable=False)
    task_score = Column(Float)           # out of 10
    grammar_score = Column(Float)
    vocabulary_score = Column(Float)
    coherence_score = Column(Float)
    overall_band = Column(Float)
    feedback_json = Column(JSON)         # detailed per-dimension feedback
    model_answer = Column(Text)          # Claude's model answer
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="writing_submissions")


class SpeakingSession(Base):
    """
    Stores every speaking practice conversation.
    """
    __tablename__ = "speaking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language = Column(String(50), nullable=False)
    exam_persona = Column(String(100))   # e.g. "Goethe B2 Oral Examiner"
    transcript = Column(Text)            # full conversation text
    fluency_report = Column(JSON)        # {pronunciation, grammar, vocabulary, band_score}
    duration_seconds = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="speaking_sessions")


class FlashcardDeck(Base):
    """
    A collection of flashcards grouped by topic.
    """
    __tablename__ = "flashcard_decks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    language = Column(String(50), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="flashcard_decks")
    cards = relationship("Flashcard", back_populates="deck")


class Flashcard(Base):
    """
    A single flashcard with SM-2 spaced repetition fields.
    
    SM-2 fields explained:
    - ease_factor: how easy this card is (starts at 2.5, goes down if hard)
    - interval: days until next review (starts at 1, grows over time)
    - repetitions: how many times reviewed successfully in a row
    - next_review_at: the actual date/time to show this card again
    """
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    deck_id = Column(Integer, ForeignKey("flashcard_decks.id"), nullable=False)
    front_text = Column(String(500), nullable=False)   # word / phrase
    back_text = Column(String(500), nullable=False)    # translation
    example_sentence = Column(Text)                    # AI-generated
    mnemonic = Column(Text)                            # AI-generated memory trick
    audio_url = Column(String(500))                    # pronunciation audio

    # SM-2 Algorithm fields
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)
    next_review_at = Column(DateTime(timezone=True), server_default=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deck = relationship("FlashcardDeck", back_populates="cards")


class UserProgress(Base):
    """
    Tracks the user's current skill score per language skill.
    Updated after every module session.
    """
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill = Column(String(50), nullable=False)   # grammar, writing, speaking, vocabulary, listening
    score = Column(Float, default=0.0)           # 0–100
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="progress")