# backend/app/core/database.py
#
# WHY THIS FILE EXISTS:
# This file sets up the connection to PostgreSQL.
# SQLAlchemy is the ORM (Object Relational Mapper) — it lets you write
# Python classes instead of raw SQL. For example, instead of writing:
#   "INSERT INTO users (email, password) VALUES (?, ?)"
# you just do:
#   db.add(User(email=email, password=password))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# create_engine connects to your PostgreSQL database
engine = create_engine(settings.DATABASE_URL)

# SessionLocal is a factory — every time you call SessionLocal()
# you get a new database session (like opening a connection)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class all your database models will inherit from
Base = declarative_base()


# get_db is a "dependency" — FastAPI calls this automatically before
# each request to give you a database session, and closes it after
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()