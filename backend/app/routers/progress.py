import json
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, UserProgress
from app.schemas.schemas import ProgressResponse

router = APIRouter(prefix="/api/progress", tags=["Progress"])
groq_client = Groq(api_key=settings.GROQ_API_KEY)


@router.get("/", response_model=ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
    records = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).all()
    scores = {r.skill: round(r.score, 1) for r in records}

    prompt = f"""You are a professional {current_user.target_language} language learning coach.

Your student's current skill scores (out of 100):
- Grammar: {scores.get('grammar', 0)}
- Writing: {scores.get('writing', 0)}
- Speaking: {scores.get('speaking', 0)}
- Vocabulary: {scores.get('vocabulary', 0)}
- Listening: {scores.get('listening', 0)}

CEFR level: {current_user.cefr_level} in {current_user.target_language}
Study time available: 1-2 hours per day

Create a practical 7-day study plan. Return ONLY valid JSON, no markdown:
{{
  "summary": "<2 sentence overview of strengths and focus areas>",
  "days": [
    {{
      "day": 1,
      "focus": "<skill to focus on>",
      "tasks": ["<specific task 1>", "<specific task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 2,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 3,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 4,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 5,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 6,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }},
    {{
      "day": 7,
      "focus": "<skill>",
      "tasks": ["<task 1>", "<task 2>"],
      "duration_minutes": <number>
    }}
  ],
  "tip": "<one powerful piece of advice specific to their situation>"
}}"""

    try:
        message = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.choices[0].message.content.strip()
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else parts[0]
            if raw.startswith("json"):
                raw = raw[4:]
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        plan = json.loads(raw)
        return {"plan": plan, "scores": scores}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate study plan: {str(e)}")