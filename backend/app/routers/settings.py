import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/settings", tags=["Settings"])

SUPPORTED_LANGUAGES = [
    "German", "French", "Spanish", "Japanese", "Chinese",
    "Italian", "Portuguese", "Korean", "Arabic", "Hindi"
]

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "native_language": current_user.native_language,
        "target_language": current_user.target_language,
        "cefr_level": current_user.cefr_level,
        "created_at": current_user.created_at
    }


@router.put("/profile")
def update_profile(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if "name" in data and data["name"].strip():
        current_user.name = data["name"].strip()

    if "email" in data and data["email"].strip():
        existing = db.query(User).filter(
            User.email == data["email"],
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use.")
        current_user.email = data["email"].strip()

    if "native_language" in data:
        current_user.native_language = data["native_language"]

    if "target_language" in data:
        if data["target_language"] not in SUPPORTED_LANGUAGES:
            raise HTTPException(status_code=400, detail="Unsupported language.")
        current_user.target_language = data["target_language"]

    if "cefr_level" in data:
        if data["cefr_level"] not in CEFR_LEVELS:
            raise HTTPException(status_code=400, detail="Invalid CEFR level.")
        current_user.cefr_level = data["cefr_level"]

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully!",
        "name": current_user.name,
        "email": current_user.email,
        "native_language": current_user.native_language,
        "target_language": current_user.target_language,
        "cefr_level": current_user.cefr_level
    }


@router.put("/password")
def change_password(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not bcrypt.checkpw(current_password.encode(), current_user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    current_user.password_hash = bcrypt.hashpw(
        new_password.encode(), bcrypt.gensalt()
    ).decode()
    db.commit()

    return {"message": "Password changed successfully!"}


@router.get("/options")
def get_options():
    return {
        "languages": SUPPORTED_LANGUAGES,
        "cefr_levels": CEFR_LEVELS
    }