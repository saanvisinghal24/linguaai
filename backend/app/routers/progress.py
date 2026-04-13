# backend/app/routers/progress.py
#
# WHY THIS FILE EXISTS:
# This returns the user's progress scores for the dashboard radar chart,
# and generates a personalized study plan using Claude.

import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, UserProgress
from app.schemas.schemas import ProgressResponse

router = APIRouter(prefix="/api/progress", tags=["Progress"])
claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


@router.get("/", response_model=ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's current skill scores for the dashboard radar chart."""
    records = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).all()
    scores = {r.skill: round(r.score, 1) for r in records}
    return ProgressResponse(
        grammar=scores.get("grammar", 0),
        writing=scores.get("writing", 0),
        speaking=scores.get("speaking", 0),
        vocabulary=scores.get("vocabulary", 0),
        listening=scores.get("listening", 0)
    )


@router.get("/study-plan")
def get_study_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a personalized 7-day study plan using Claude,
    based on the user's current skill scores.
    """
    records = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).all()
    scores = {r.skill: round(r.score, 1) for r in records}

    prompt = f"""You are a professional {current_user.target_language} language learning coach.

Your student's current skill scores (out of 100) are:
- Grammar: {scores.get('grammar', 0)}
- Writing: {scores.get('writing', 0)}
- Speaking: {scores.get('speaking', 0)}
- Vocabulary: {scores.get('vocabulary', 0)}
- Listening: {scores.get('listening', 0)}

Their current CEFR level is {current_user.cefr_level} in {current_user.target_language}.
They can study 1-2 hours per day.

Create a practical 7-day study plan. Be specific and encouraging.
Return ONLY a JSON object:
{{
  "summary": "<2 sentence overview of their strengths and what to focus on>",
  "days": [
    {{
      "day": 1,
      "focus": "<skill to focus on>",
      "tasks": ["<specific task 1>", "<specific task 2>"],
      "duration_minutes": <number>
    }}
  ],
  "tip": "<one powerful piece of advice specific to their situation>"
}}"""

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        plan = json.loads(message.content[0].text.strip())
        return {"plan": plan, "scores": scores}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate study plan: {str(e)}")