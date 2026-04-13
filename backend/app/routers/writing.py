# backend/app/routers/writing.py
#
# WHY THIS FILE EXISTS:
# The writing evaluator is LinguaAI's most impressive feature.
# It scores essays on 4 official exam rubric dimensions — exactly how
# a real Goethe or DELF examiner would mark them.
#
# The key is the prompt: we give Claude the official rubric criteria
# and tell it to return structured scores. The output looks and feels
# like a real examiner's feedback sheet.

import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, WritingSubmission, UserProgress
from app.schemas.schemas import WritingSubmitRequest, WritingEvalResponse
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/writing", tags=["Writing"])

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def build_writing_prompt(text: str, prompt: str, language: str, exam_type: str, level: str) -> str:
    return f"""You are an official {exam_type} examiner evaluating a {language} writing submission at CEFR level {level}.

Writing Prompt given to the student:
"{prompt}"

Student's Submission:
"{text}"

Evaluate this submission using the official {exam_type} rubric. Return ONLY a valid JSON object (no extra text, no markdown):

{{
  "task_achievement": {{
    "score": <number 0-10>,
    "feedback": "<2-3 sentences: did they answer the prompt fully? Did they cover all required points?>"
  }},
  "grammar": {{
    "score": <number 0-10>,
    "feedback": "<2-3 sentences: range of structures used, frequency and severity of errors>"
  }},
  "vocabulary": {{
    "score": <number 0-10>,
    "feedback": "<2-3 sentences: range, precision, appropriateness of vocabulary for {level}>"
  }},
  "coherence": {{
    "score": <number 0-10>,
    "feedback": "<2-3 sentences: logical flow, use of connectors, paragraph structure>"
  }},
  "overall_band": <average of the 4 scores, rounded to 1 decimal>,
  "model_answer": "<a strong model answer for this prompt at {level} level, approximately the same length as the student's submission>"
}}"""


@router.post("/submit", response_model=WritingEvalResponse)
def submit_writing(
    data: WritingSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluate a writing submission using Claude.
    Returns rubric scores for 4 dimensions + a model answer.
    """
    if len(data.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Please write at least a few sentences.")

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": build_writing_prompt(
                data.text, data.prompt, data.language, data.exam_type, data.cefr_level
            )}]
        )
        raw = message.content[0].text.strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned an unexpected response. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    # Save to database
    submission = WritingSubmission(
        user_id=current_user.id,
        language=data.language,
        exam_type=data.exam_type,
        prompt_text=data.prompt,
        submitted_text=data.text,
        task_score=result["task_achievement"]["score"],
        grammar_score=result["grammar"]["score"],
        vocabulary_score=result["vocabulary"]["score"],
        coherence_score=result["coherence"]["score"],
        overall_band=result["overall_band"],
        feedback_json=result,
        model_answer=result["model_answer"]
    )
    db.add(submission)

    # Update writing and vocabulary progress
    writing_score = result["overall_band"] * 10  # convert 0-10 band to 0-100
    _update_progress(db, current_user.id, "writing", writing_score)
    vocab_score = result["vocabulary"]["score"] * 10
    _update_progress(db, current_user.id, "vocabulary", vocab_score)

    db.commit()
    db.refresh(submission)

    return WritingEvalResponse(
        task_achievement=result["task_achievement"],
        grammar=result["grammar"],
        vocabulary=result["vocabulary"],
        coherence=result["coherence"],
        overall_band=result["overall_band"],
        model_answer=result["model_answer"],
        submission_id=submission.id
    )


@router.get("/history")
def get_writing_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return the user's last 10 writing submissions."""
    submissions = db.query(WritingSubmission)\
        .filter(WritingSubmission.user_id == current_user.id)\
        .order_by(WritingSubmission.created_at.desc())\
        .limit(10).all()

    return [{"id": s.id, "exam_type": s.exam_type, "overall_band": s.overall_band,
             "created_at": s.created_at} for s in submissions]