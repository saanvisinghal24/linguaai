import json
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/listening", tags=["Listening"])
groq_client = Groq(api_key=settings.GROQ_API_KEY)

VOICE_IDS = {
    "German": "XrExE9yKIg1WjnnlVkGX",
    "French": "MF3mGyEYCl7XYWbV9V6O",
    "Spanish": "jBpfuIE2acCO8z3wKNLl",
    "default": "XrExE9yKIg1WjnnlVkGX"
}


@router.post("/generate")
def generate_listening(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    language = data.get("language", "German")
    level = data.get("level", "A1")
    topic = data.get("topic", "daily life")

    prompt = f"""Create a short listening exercise in {language} at CEFR level {level} about {topic}.

Return ONLY valid JSON, no markdown:
{{
  "title": "<short title in {language}>",
  "audio_text": "<text in {language} for {level} level, 80-120 words>",
  "english_translation": "<full English translation of audio_text>",
  "questions": [
    {{
      "question": "<comprehension question in {language}>",
      "options": ["<option A in {language}>", "<option B in {language}>", "<option C in {language}>", "<option D in {language}>"],
      "correct": 0,
      "explanation": "<why this answer is correct, in English>"
    }},
    {{
      "question": "<comprehension question in {language}>",
      "options": ["<option A in {language}>", "<option B in {language}>", "<option C in {language}>", "<option D in {language}>"],
      "correct": 1,
      "explanation": "<why this answer is correct, in English>"
    }},
    {{
      "question": "<comprehension question in {language}>",
      "options": ["<option A in {language}>", "<option B in {language}>", "<option C in {language}>", "<option D in {language}>"],
      "correct": 2,
      "explanation": "<why this answer is correct, in English>"
    }}
  ]
}}

IMPORTANT:
- audio_text must be in {language}
- All questions and options must be in {language}
- Only english_translation and explanation should be in English"""

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
        result = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate exercise: {str(e)}")

    # Generate audio with ElevenLabs
    try:
        from elevenlabs.client import ElevenLabs
        tts_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        voice_id = VOICE_IDS.get(language, VOICE_IDS["default"])
        audio_bytes = tts_client.text_to_speech.convert(
            voice_id=voice_id,
            text=result["audio_text"],
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128"
        )
        audio_bytes = b"".join(audio_bytes)
        result["audio_hex"] = audio_bytes.hex()
    except Exception as e:
        result["audio_hex"] = ""
        result["audio_error"] = str(e)

    return result


@router.post("/submit")
def submit_answers(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    questions = data.get("questions", [])
    answers = data.get("answers", [])

    if not questions or not answers:
        raise HTTPException(status_code=400, detail="Questions and answers required.")

    correct = 0
    results = []
    for i, (q, ans) in enumerate(zip(questions, answers)):
        is_correct = ans == q["correct"]
        if is_correct:
            correct += 1
        results.append({
            "question": q["question"],
            "your_answer": q["options"][ans] if 0 <= ans < len(q["options"]) else "Not answered",
            "correct_answer": q["options"][q["correct"]],
            "explanation": q.get("explanation", ""),
            "is_correct": is_correct
        })

    score = (correct / len(questions)) * 100
    _update_progress(db, current_user.id, "listening", score)
    db.commit()

    return {
        "score": score,
        "correct": correct,
        "total": len(questions),
        "results": results
    }