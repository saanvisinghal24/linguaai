# backend/app/routers/auth.py
#
# WHY THIS FILE EXISTS:
# This handles user registration and login.
# A "router" in FastAPI is a group of related endpoints.
# We keep each feature in its own router file to stay organised.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_token
from app.models.user import User, UserProgress
from app.schemas.schemas import RegisterRequest, LoginRequest, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new user account.
    Steps:
    1. Check if email already exists
    2. Hash the password (NEVER store plain text passwords)
    3. Create the user in the database
    4. Create default progress records for all 5 skills
    5. Return a JWT token so they're immediately logged in
    """
    # Check duplicate email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Create user
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        native_language=data.native_language,
        target_language=data.target_language,
        cefr_level="A1"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create progress records for all 5 skills (starting at 0)
    for skill in ["grammar", "writing", "speaking", "vocabulary", "listening"]:
        db.add(UserProgress(user_id=user.id, skill=skill, score=0.0))
    db.commit()

    token = create_token(user.id)
    return AuthResponse(
        token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        target_language=user.target_language,
        cefr_level=user.cefr_level
    )


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Log in an existing user.
    Steps:
    1. Find user by email
    2. Verify password against the stored hash
    3. Return a fresh JWT token
    """
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_token(user.id)
    return AuthResponse(
        token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        target_language=user.target_language,
        cefr_level=user.cefr_level
    )