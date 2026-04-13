# backend/app/routers/speaking.py
#
# WHY THIS FILE EXISTS:
# This is the most technically complex module.
# The pipeline is: Audio → Whisper (text) → Claude (reply) → ElevenLabs (voice)
#
# Each step is an API call. We chain them together here.
# The frontend sends an audio file, we return text + audio.

import json
import os
import tempfile
import anthropic
from openai import OpenAI
from elevenlabs.client import ElevenLabs
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, SpeakingSession, UserProgress
from app.schemas.schemas import SpeakingReplyResponse, FluencyReportResponse
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/speaking", tags=["Speaking"])

claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
whisper = OpenAI(api_key=settings.OPENAI_API_KEY)
tts = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

# ElevenLabs voice IDs for different languages
# These are public voices from ElevenLabs — you can change them in your account
VOICE_IDS = {
    "German": "XrExE9yKIg1WjnnlVkGX",
    "French": "MF3mGyEYCl7XYWbV9V6O",
    "Spanish": "jBpfuIE2acCO8z3wKNLl",
    "Japanese": "XrExE9yKIg1WjnnlVkGX",  # fallback
    "default": "XrExE9yKIg1WjnnlVkGX"
}

def get_system_prompt(language: str, level: str, persona: str, conversation_history: list) -> str:
    """
    Build the system prompt for the AI speaking partner.
    The persona makes it behave like a real exam situation.
    """
    if persona and persona != "Free Practice":
        role = f"You are acting as a {persona}. Conduct the conversation exactly as this examiner would in an official exam."
    else:
        role = f"You are a friendly, patient {language} language tutor."

    return f"""{role}

Rules:
- Respond ONLY in {language} (CEFR level {level})
- Keep responses conversational and natural (2-4 sentences max)
- If the student makes a grammar error, GENTLY weave the correction into your response naturally
- Do NOT explicitly say "You made an error" — just model the correct form in your reply
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
    """
    Main speaking endpoint.
    1. Save audio to temp file
    2. Transcribe with Whisper
    3. Get Claude's response
    4. Synthesize with ElevenLabs
    5. Return transcript + text + audio
    """
    # Step 1: Save uploaded audio to a temporary file
    # Whisper needs a file path, not raw bytes
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Step 2: Transcribe with Whisper
        with open(tmp_path, "rb") as audio_file:
            transcription = whisper.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language[:2].lower()  # "German" → "de", "French" → "fr"
            )
        user_text = transcription.text

        # Step 3: Build conversation history and get Claude's reply
        history = json.loads(conversation_history)
        messages = []
        for turn in history:
            messages.append({"role": "user", "content": turn["user"]})
            messages.append({"role": "assistant", "content": turn["assistant"]})
        messages.append({"role": "user", "content": user_text})

        claude_response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=get_system_prompt(language, level, persona, history),
            messages=messages
        )
        ai_text = claude_response.content[0].text

        # Step 4: Convert Claude's text to speech with ElevenLabs
        voice_id = VOICE_IDS.get(language, VOICE_IDS["default"])
        audio_generator = tts.generate(
            text=ai_text,
            voice=voice_id,
            model="eleven_multilingual_v2"
        )
        audio_bytes = b"".join(audio_generator)

        return {
            "transcript": user_text,
            "ai_response_text": ai_text,
            "audio_base64": audio_bytes.hex()  # send as hex, frontend converts to audio
        }

    finally:
        os.unlink(tmp_path)  # always clean up temp file


@router.post("/report", response_model=FluencyReportResponse)
def get_fluency_report(
    session_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a fluency report for the completed conversation.
    Called when the user ends their speaking session.
    """
    transcript = session_data.get("transcript", "")
    language = session_data.get("language", "German")
    level = session_data.get("level", "B1")

    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript provided.")

    prompt = f"""You are a {language} language examiner at CEFR {level} level.

Here is the student's side of a speaking practice conversation:
"{transcript}"

Evaluate their speaking performance. Return ONLY a valid JSON object:
{{
  "pronunciation_notes": "<2-3 sentences about likely pronunciation patterns based on their written transcript>",
  "grammar_mistakes": ["<mistake 1>", "<mistake 2>"],
  "vocabulary_feedback": "<2-3 sentences about their vocabulary range and appropriateness>",
  "band_score": <number 1.0-10.0 reflecting their overall speaking level>,
  "overall_comment": "<2-3 encouraging sentences with the most important thing to improve>"
}}"""

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        result = json.loads(message.content[0].text.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    # Save session to DB
    speaking_session = SpeakingSession(
        user_id=current_user.id,
        language=language,
        exam_persona=session_data.get("persona", "Free Practice"),
        transcript=transcript,
        fluency_report=result,
        duration_seconds=session_data.get("duration_seconds", 0)
    )
    db.add(speaking_session)

    # Update progress
    speaking_score = result["band_score"] * 10
    _update_progress(db, current_user.id, "speaking", speaking_score)
    db.commit()
    db.refresh(speaking_session)

    return FluencyReportResponse(
        **result,
        session_id=speaking_session.id
    )