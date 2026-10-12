"""Password hashing and short-lived signed access tokens."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError


ISSUER = "medicare-identity"
AUDIENCE = "medicare-api"
ACCESS_MINUTES = 15
REFRESH_DAYS = 7
password_hasher = PasswordHasher()


def signing_secret() -> str:
    secret = os.getenv("IDENTITY_JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("IDENTITY_JWT_SECRET must have at least 32 characters")
    return secret


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return password_hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def issue_access_token(account: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": account["id"],
            "role": account["role"],
            "ver": account["token_version"],
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "exp": now + timedelta(minutes=ACCESS_MINUTES),
        },
        signing_secret(),
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        signing_secret(),
        algorithms=["HS256"],
        issuer=ISSUER,
        audience=AUDIENCE,
        options={"require": ["sub", "role", "ver", "iss", "aud", "iat", "exp"]},
    )


def new_refresh_token() -> tuple[str, str, datetime]:
    raw = secrets.token_urlsafe(48)
    return raw, token_digest(raw), datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_DAYS)


def token_digest(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
