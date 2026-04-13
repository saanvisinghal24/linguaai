# backend/app/routers/flashcards.py
#
# WHY THIS FILE EXISTS:
# This handles the flashcard system with SM-2 spaced repetition.
#
# HOW SM-2 WORKS (simple explanation):
# Every card has an "ease factor" and an "interval" (days until next review).
# When you review a card, you rate it: Again(0), Hard(3), Easy(5).
# - Easy → interval grows (you won't see it for a while)
# - Hard → interval shrinks (you'll see it again soon)
# - Again → interval resets to 1 day
# This ensures you spend time on hard words, not easy ones you already know.

import json
import anthropic
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, FlashcardDeck, Flashcard, UserProgress
from app.schemas.schemas import CreateDeckRequest, CreateCardRequest, CardReviewRequest, CardResponse
from app.routers.grammar import _update_progress

router = APIRouter(prefix="/api/flashcards", tags=["Flashcards"])
claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def sm2(ease_factor: float, interval: int, repetitions: int, quality: int):
    """
    SM-2 Algorithm — the heart of the flashcard system.

    Args:
        ease_factor: how easy the card is (2.5 = average, lower = harder)
        interval: current interval in days
        repetitions: how many times reviewed successfully in a row
        quality: user's rating (0=Again, 3=Hard, 5=Easy)

    Returns:
        new_ease_factor, new_interval, new_repetitions
    """
    if quality < 3:
        # Failed — reset to beginning
        new_interval = 1
        new_repetitions = 0
        new_ease_factor = ease_factor  # ease factor doesn't change on failure
    else:
        # Success — calculate next interval
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)

        new_repetitions = repetitions + 1

        # Update ease factor based on quality (harder = lower ease = seen sooner)
        new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease_factor = max(1.3, new_ease_factor)  # minimum ease factor is 1.3

    return new_ease_factor, new_interval, new_repetitions


async def generate_card_content(word: str, translation: str, language: str) -> dict:
    """Ask Claude to generate an example sentence and mnemonic for a new card."""
    prompt = f"""For the {language} word "{word}" (meaning: "{translation}"), generate:
1. A natural example sentence in {language} using this word (keep it simple and memorable)
2. A creative mnemonic or memory trick to remember this word

Return ONLY a JSON object:
{{"example_sentence": "<the example sentence in {language}>", "mnemonic": "<the memory trick in English>"}}"""

    try:
        message = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        return json.loads(message.content[0].text.strip())
    except Exception:
        return {"example_sentence": "", "mnemonic": ""}


@router.post("/decks")
def create_deck(
    data: CreateDeckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new flashcard deck."""
    deck = FlashcardDeck(
        user_id=current_user.id,
        title=data.title,
        language=data.language,
        description=data.description
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return {"id": deck.id, "title": deck.title, "language": deck.language}


@router.get("/decks")
def get_decks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all the user's decks with card counts."""
    decks = db.query(FlashcardDeck).filter(FlashcardDeck.user_id == current_user.id).all()
    return [{"id": d.id, "title": d.title, "language": d.language,
             "card_count": len(d.cards), "description": d.description} for d in decks]


@router.post("/cards")
async def create_card(
    data: CreateCardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a card to a deck.
    Automatically generates an example sentence and mnemonic using Claude.
    """
    deck = db.query(FlashcardDeck).filter(
        FlashcardDeck.id == data.deck_id,
        FlashcardDeck.user_id == current_user.id
    ).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")

    # Generate AI content for the card
    ai_content = await generate_card_content(data.front_text, data.back_text, deck.language)

    card = Flashcard(
        deck_id=data.deck_id,
        front_text=data.front_text,
        back_text=data.back_text,
        example_sentence=ai_content.get("example_sentence", ""),
        mnemonic=ai_content.get("mnemonic", "")
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"id": card.id, "front_text": card.front_text, "example_sentence": card.example_sentence,
            "mnemonic": card.mnemonic}


@router.get("/due")
def get_due_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all cards due for review today.
    This is the core of spaced repetition — only show cards when they need reviewing.
    """
    now = datetime.utcnow()
    # Get all decks for this user, then find cards past their review date
    user_deck_ids = [d.id for d in db.query(FlashcardDeck).filter(
        FlashcardDeck.user_id == current_user.id).all()]

    if not user_deck_ids:
        return []

    due_cards = db.query(Flashcard).filter(
        Flashcard.deck_id.in_(user_deck_ids),
        Flashcard.next_review_at <= now
    ).limit(20).all()  # max 20 cards per session

    return [{"id": c.id, "front_text": c.front_text, "back_text": c.back_text,
             "example_sentence": c.example_sentence, "mnemonic": c.mnemonic} for c in due_cards]


@router.post("/review")
def review_card(
    data: CardReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a review rating for a card.
    SM-2 algorithm updates the next review date based on the rating.
    """
    # Verify the card belongs to this user
    card = db.query(Flashcard).join(FlashcardDeck).filter(
        Flashcard.id == data.card_id,
        FlashcardDeck.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found.")

    if data.rating not in [0, 3, 5]:
        raise HTTPException(status_code=400, detail="Rating must be 0 (Again), 3 (Hard), or 5 (Easy).")

    # Run SM-2 algorithm
    new_ef, new_interval, new_reps = sm2(
        card.ease_factor, card.interval, card.repetitions, data.rating
    )

    # Update card
    card.ease_factor = new_ef
    card.interval = new_interval
    card.repetitions = new_reps
    card.next_review_at = datetime.utcnow() + timedelta(days=new_interval)

    # Update vocabulary progress
    if data.rating >= 3:
        _update_progress(db, current_user.id, "vocabulary", 75)  # successful review
    else:
        _update_progress(db, current_user.id, "vocabulary", 40)  # failed review

    db.commit()
    return {"next_review_in_days": new_interval, "ease_factor": round(new_ef, 2)}