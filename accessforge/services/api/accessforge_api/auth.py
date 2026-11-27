"""Reviewer authentication with pre-shared keys stored only as SHA-256 digests."""

from collections.abc import Mapping
from hashlib import sha256
from hmac import compare_digest
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request

from .report_limits import record_failed_sign_in, refuse_locked_out

COOKIE_NAME = "accessforge_reviewer"
SESSION_SECONDS = 8 * 60 * 60
DIGEST_HEX_LENGTH = 64
BEARER_PREFIX = "Bearer "
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def parse_reviewer_keys(value: str) -> Mapping[str, UUID]:
    """Parse ``reviewer-uuid:sha256-hex`` pairs; raw keys are never configured."""
    keys: dict[str, UUID] = {}
    for entry in filter(None, (part.strip() for part in value.split(","))):
        reviewer, _, digest = entry.partition(":")
        digest = digest.lower()
        if len(digest) != DIGEST_HEX_LENGTH or set(digest) - set("0123456789abcdef"):
            raise ValueError("REVIEWER_KEYS entries must be uuid:sha256-hex")
        try:
            keys[digest] = UUID(reviewer)
        except ValueError as error:
            raise ValueError("REVIEWER_KEYS entries must be uuid:sha256-hex") from error
    return keys


def reviewer_for_key(key: str, keys: Mapping[str, UUID]) -> UUID | None:
    digest = sha256(key.encode()).hexdigest()
    match: UUID | None = None
    # Compare against every configured digest so timing does not reveal which matched.
    for known, reviewer in keys.items():
        if compare_digest(digest, known):
            match = reviewer
    return match


def _presented_key(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith(BEARER_PREFIX):
        return header.removeprefix(BEARER_PREFIX)
    key = request.cookies.get(COOKIE_NAME)
    if key is None:
        return None
    # Cookie credentials are sent automatically, so refuse cross-site mutations.
    # SameSite=Strict already blocks them; this covers browsers that send the header.
    fetch_site = request.headers.get("Sec-Fetch-Site", "same-origin")
    if request.method not in SAFE_METHODS and fetch_site != "same-origin":
        return None
    return key


def require_reviewer(request: Request) -> UUID:
    """Bind the request to a configured reviewer identity or fail closed with 401."""
    refuse_locked_out(request)
    key = _presented_key(request)
    reviewer = (
        reviewer_for_key(key, request.app.state.reviewer_keys)
        if key is not None
        else None
    )
    if reviewer is None:
        record_failed_sign_in(request)
        raise HTTPException(401)
    return reviewer


def optional_reviewer(request: Request) -> UUID | None:
    """Like require_reviewer, but anonymous callers get None; wrong keys still count."""
    if _presented_key(request) is None:
        return None
    return require_reviewer(request)


Reviewer = Annotated[UUID, Depends(require_reviewer)]
MaybeReviewer = Annotated[UUID | None, Depends(optional_reviewer)]
