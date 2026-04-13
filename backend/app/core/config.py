# backend/app/core/config.py
#
# WHY THIS FILE EXISTS:
# Instead of hardcoding sensitive values (API keys, DB passwords) directly
# in code, we store them in a .env file and load them here.
# Pydantic Settings reads the .env file automatically.

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # AI APIs
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    ELEVENLABS_API_KEY: str

    # App
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"  # tells Pydantic to read from .env file


# Create a single shared instance — import this everywhere you need settings
settings = Settings()