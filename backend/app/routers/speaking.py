import json
import os
import tempfile
from groq import Groq
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, SpeakingSession
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/speaking", tags=["Speaking"])
groq_client = Groq(api_key=settings.GROQ_API_KEY)

LANGUAGE_CODES = {
    "German": "de", "French": "fr", "Spanish": "es",
    "Japanese": "ja", "Chinese": "zh", "Italian": "it",
    "Korean": "ko", "Portuguese": "pt", "Arabic": "ar", "Hindi": "hi"
}

VOICE_IDS = {
    "German": "XrExE9yKIg1WjnnlVkGX",
    "French": "MF3mGyEYCl7XYWbV9V6O",
    "default": "XrExE9yKIg1WjnnlVkGX"
}


def get_system_prompt(language, level, persona):
    if persona and persona != "Free Practice":
        role = f"You are acting as a {persona}. Conduct the conversation exactly as this examiner would in an official exam."
    else:
        role = f"You are a friendly, patient {language} language tutor."
    return f"""{role}
Rules:
- Respond ONLY in {language} (CEFR level {level})
- Keep responses conversational and natural (2-4 sentences max)
- If the student makes a grammar error, gently weave the correction into your response naturally
- Keep vocabulary appropriate for {level} level
- If the student seems stuck, ask a simpler follow-up question"""


@router.post("/reply")
async def speaking_reply(
    audio: UploadFile = File(...),
    language: str = Form("German"),
    level: str = Form("B1"),
    persona: str = Form("Free Practice"),
    conversation_history: str = Form("[]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        lang_code = LANGUAGE_CODES.get(language, "en")
        with open(tmp_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                language=lang_code
            )
        user_text = transcription.text

        history = json.loads(conversation_history)
        messages = [{"role": "system", "content": get_system_prompt(language, level, persona)}]
        for turn in history:
            messages.append({"role": "user", "content": turn["user"]})
            messages.append({"role": "assistant", "content": turn["assistant"]})
        messages.append({"role": "user", "content": user_text})

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=300
        )
        ai_text = response.choices[0].message.content

        # ElevenLabs TTS
        try:
            from elevenlabs.client import ElevenLabs
            tts = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
            voice_id = VOICE_IDS.get(language, VOICE_IDS["default"])
            audio_bytes = tts.text_to_speech.convert(
                voice_id=voice_id,
                text=ai_text,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128"
            )
            audio_bytes = b"".join(audio_bytes)
            audio_hex = audio_bytes.hex()
        except Exception:
            audio_hex = ""

        return {
            "transcript": user_text,
            "ai_response_text": ai_text,
            "audio_base64": audio_hex
        }

    finally:
        os.unlink(tmp_path)


@router.post("/report")
def get_fluency_report(
    session_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transcript = session_data.get("transcript", "")
    language = session_data.get("language", "German")
    level = session_data.get("level", "B1")

    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript provided.")

    prompt = f"""You are a {language} language examiner at CEFR {level} level.

Here is the student's side of a speaking practice conversation:
"{transcript}"

Evaluate their speaking performance. Return ONLY valid JSON with no markdown:
{{
  "pronunciation_notes": "<2-3 sentences in English>",
  "grammar_mistakes": ["<mistake 1>", "<mistake 2>"],
  "vocabulary_feedback": "<2-3 sentences in English>",
  "band_score": <number 1.0-10.0>,
  "overall_comment": "<2-3 encouraging sentences in English>"
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
        result = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    speaking_session = SpeakingSession(
        user_id=current_user.id,
        language=language,
        exam_persona=session_data.get("persona", "Free Practice"),
        transcript=transcript,
        fluency_report=result,
        duration_seconds=session_data.get("duration_seconds", 0)
    )
    db.add(speaking_session)
    _update_progress(db, current_user.id, "speaking", result["band_score"] * 10)
    db.commit()
    db.refresh(speaking_session)

    return {**result, "session_id": speaking_session.id}