import json
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, GrammarSession, UserProgress
from app.schemas.schemas import GrammarCheckRequest

client = Groq(api_key=settings.GROQ_API_KEY)
router = APIRouter(prefix="/api/grammar", tags=["Grammar"])


def build_grammar_prompt(text: str, language: str, level: str) -> str:
    return f"""You are an expert {language} language teacher evaluating a student at CEFR level {level}.

The student wrote: "{text}"

Analyze for ALL grammatical errors. Return ONLY valid JSON, no markdown:

{{
  "corrected_text": "fully corrected version",
  "errors": [
    {{
      "original": "incorrect phrase",
      "correction": "corrected version",
      "rule": "grammar rule name",
      "explanation": "simple explanation",
      "advanced": "more sophisticated alternative"
    }}
  ]
}}

If no errors, return empty array for errors."""


@router.post("/check")
def check_grammar(
    data: GrammarCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Please enter some text to check.")

    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": build_grammar_prompt(data.text, data.language, data.cefr_level)}]
        )
        raw = message.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned unexpected response. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    session = GrammarSession(
        user_id=current_user.id,
        language=data.language,
        input_text=data.text,
        corrected_text=result.get("corrected_text", data.text),
        errors_json=result.get("errors", []),
        cefr_level=data.cefr_level
    )
    db.add(session)
    error_count = len(result.get("errors", []))
    session_score = max(0, 100 - (error_count * 15))
    _update_progress(db, current_user.id, "grammar", session_score)
    db.commit()
    db.refresh(session)

    return {
        "corrected_text": result.get("corrected_text", data.text),
        "errors": result.get("errors", []),
        "session_id": session.id
    }


def _update_progress(db: Session, user_id: int, skill: str, new_score: float):
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == user_id,
        UserProgress.skill == skill
    ).first()
    if progress:
        progress.score = (progress.score * 0.7) + (new_score * 0.3)
    else:
        db.add(UserProgress(user_id=user_id, skill=skill, score=new_score))