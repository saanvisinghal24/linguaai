# backend/app/routers/grammar.py
#
# WHY THIS FILE EXISTS:
# This is the grammar checking module.
# The user sends a sentence → we send it to Claude with a carefully
# engineered prompt → Claude returns structured JSON → we save it and
# return it to the frontend.
#
# KEY CONCEPT: Prompt Engineering
# The quality of Claude's output depends entirely on how you write the prompt.
# We tell Claude EXACTLY what format to respond in (JSON), what fields to include,
# and what role to play. This is the most important skill in AI app development.

import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, GrammarSession, UserProgress
from app.schemas.schemas import GrammarCheckRequest, GrammarCheckResponse

router = APIRouter(prefix="/api/grammar", tags=["Grammar"])

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def build_grammar_prompt(text: str, language: str, level: str) -> str:
    """
    This is the core prompt that powers the grammar checker.
    Notice how specific and structured it is — this is what gets Claude
    to return consistent, parseable JSON every time.
    """
    return f"""You are an expert {language} language teacher evaluating a student at CEFR level {level}.

The student wrote:
"{text}"

Analyze this text for ALL grammatical errors. Return ONLY a valid JSON object with this exact structure (no extra text, no markdown):

{{
  "corrected_text": "the fully corrected version of the student's text",
  "errors": [
    {{
      "original": "the exact incorrect phrase from the student's text",
      "correction": "the corrected version",
      "rule": "name of the grammar rule (e.g. 'Dative case after preposition mit')",
      "explanation": "a simple, clear explanation a {level} student can understand",
      "advanced": "a more sophisticated way to express the same idea (for extra learning)"
    }}
  ]
}}

If there are no errors, return an empty array for "errors" and the original text for "corrected_text".
Focus only on grammar errors, not style preferences."""


@router.post("/check", response_model=GrammarCheckResponse)
def check_grammar(
    data: GrammarCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check grammar of submitted text using Claude.
    """
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Please enter some text to check.")

    # Call Claude API
    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": build_grammar_prompt(data.text, data.language, data.cefr_level)}]
        )
        raw = message.content[0].text.strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned an unexpected response. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    # Save session to database
    session = GrammarSession(
        user_id=current_user.id,
        language=data.language,
        input_text=data.text,
        corrected_text=result.get("corrected_text", data.text),
        errors_json=result.get("errors", []),
        cefr_level=data.cefr_level
    )
    db.add(session)

    # Update grammar progress score
    # More errors = lower score for this session; average it in over time
    error_count = len(result.get("errors", []))
    session_score = max(0, 100 - (error_count * 15))  # lose 15 points per error, min 0
    _update_progress(db, current_user.id, "grammar", session_score)

    db.commit()
    db.refresh(session)

    return GrammarCheckResponse(
        corrected_text=result.get("corrected_text", data.text),
        errors=result.get("errors", []),
        session_id=session.id
    )


def _update_progress(db: Session, user_id: int, skill: str, new_score: float):
    """Update user's skill score using a rolling average."""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == user_id,
        UserProgress.skill == skill
    ).first()
    if progress:
        # Rolling average: new score gets 30% weight, history gets 70%
        progress.score = (progress.score * 0.7) + (new_score * 0.3)
    else:
        db.add(UserProgress(user_id=user_id, skill=skill, score=new_score))