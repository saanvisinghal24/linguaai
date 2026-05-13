import json
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, WritingSubmission, UserProgress
from app.schemas.schemas import WritingSubmitRequest, WritingEvalResponse
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/writing", tags=["Writing"])
client = Groq(api_key=settings.GROQ_API_KEY)


def build_writing_prompt(text, prompt, language, exam_type, level):
    return f"""You are an official {exam_type} examiner evaluating a {language} writing submission at CEFR level {level}.

Writing Prompt: "{prompt}"
Student's Submission: "{text}"

Evaluate using the official rubric. Return ONLY valid JSON, no markdown:

{{
  "task_achievement": {{"score": <0-10>, "feedback": "<2-3 sentences in ENGLISH>"}},
  "grammar": {{"score": <0-10>, "feedback": "<2-3 sentences in ENGLISH>"}},
  "vocabulary": {{"score": <0-10>, "feedback": "<2-3 sentences in ENGLISH>"}},
  "coherence": {{"score": <0-10>, "feedback": "<2-3 sentences in ENGLISH>"}},
  "overall_band": <average of 4 scores>,
  "model_answer": "<model answer in {language}>"
}}

IMPORTANT: ALL feedback must be written in English. Only the model_answer should be in {language}."""


@router.post("/submit")
def submit_writing(
    data: WritingSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if len(data.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Please write at least a few sentences.")

    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": build_writing_prompt(
                data.text, data.prompt, data.language, data.exam_type, data.cefr_level
            )}]
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
    _update_progress(db, current_user.id, "writing", result["overall_band"] * 10)
    _update_progress(db, current_user.id, "vocabulary", result["vocabulary"]["score"] * 10)
    db.commit()
    db.refresh(submission)

    return {
        "task_achievement": result["task_achievement"],
        "grammar": result["grammar"],
        "vocabulary": result["vocabulary"],
        "coherence": result["coherence"],
        "overall_band": result["overall_band"],
        "model_answer": result["model_answer"],
        "submission_id": submission.id
    }


@router.get("/history")
def get_writing_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    submissions = db.query(WritingSubmission)\
        .filter(WritingSubmission.user_id == current_user.id)\
        .order_by(WritingSubmission.created_at.desc())\
        .limit(10).all()
    return [{"id": s.id, "exam_type": s.exam_type, "overall_band": s.overall_band,
             "created_at": s.created_at} for s in submissions]
@router.post("/generate-prompt")
def generate_prompt(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": f"""Generate ONE realistic {data['exam_type']} writing exam prompt in {data['language']} at CEFR level {data['level']}.

Rules:
- The prompt must be in {data['language']} (except JLPT/HSK which can be in English)
- It should require approximately {data['word_count']} words in the response
- It should be a real exam-style task (letter, essay, email, opinion piece)
- Include the word count requirement in the prompt itself
- Make it interesting and relevant to everyday life
- Return ONLY the prompt text, nothing else"""}]
        )
        return {"prompt": message.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate prompt: {str(e)}")