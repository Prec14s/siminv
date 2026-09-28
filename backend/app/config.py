import os
import secrets
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def _db_url(url):
    # Pastikan memakai driver psycopg2 (sesuai requirements.txt)
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


def _get_secret(env_var):
    val = os.getenv(env_var)
    if not val or val.startswith("ganti-") or val.startswith("dev-secret"):
        return secrets.token_hex(32)
    return val


class Config:
    SECRET_KEY = _get_secret("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = _db_url(
        os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/siminv")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = _get_secret("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=60)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv("UPLOAD_FOLDER", "uploads"))
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
    MAX_LOGIN_ATTEMPTS = 5
    LOCK_MINUTES = 15
