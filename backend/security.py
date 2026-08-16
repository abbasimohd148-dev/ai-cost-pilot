"""API key generation and hashing. Raw keys are never stored."""
import hashlib
import secrets

KEY_PREFIX = "acp"  # AI Cost Pilot


def generate_api_key() -> tuple[str, str, str]:
    """Return (full_key, display_prefix, key_hash).

    full_key is shown to the user exactly once.
    Only display_prefix and key_hash are persisted.
    """
    secret = secrets.token_hex(24)  # 48 hex chars
    full_key = f"{KEY_PREFIX}_live_{secret}"
    display_prefix = full_key[:14]  # e.g. acp_live_1a2b3c
    key_hash = hash_key(full_key)
    return full_key, display_prefix, key_hash


def hash_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode("utf-8")).hexdigest()
