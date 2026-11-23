"""Write-only anonymous feedback; read it from the database, never from a public route."""

from enum import Enum
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.orm import Session

from .database import get_session
from .models import Feedback
from .report_limits import limit_feedback
from .responses import Envelope
from .schemas import DESCRIPTION_MAX_LENGTH, FrozenInput

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackTopic(str, Enum):
    usability = "usability"
    accessibility = "accessibility"
    data = "data"
    other = "other"


class FeedbackCreate(FrozenInput):
    topic: FeedbackTopic
    message: Annotated[str, Field(min_length=1, max_length=DESCRIPTION_MAX_LENGTH)]
    # Honeypot: hidden from people, often filled by form bots. Must stay empty.
    website: Annotated[str, Field(max_length=0)] = ""


class FeedbackReceipt(FrozenInput):
    received: bool


@router.post(
    "",
    status_code=201,
    response_model=Envelope[FeedbackReceipt],
    dependencies=[Depends(limit_feedback)],
)
def submit_feedback(
    payload: FeedbackCreate,
    session: Annotated[Session, Depends(get_session)],
) -> Envelope[FeedbackReceipt]:
    with session.begin():
        session.add(Feedback(topic=payload.topic.value, message=payload.message))
    return Envelope(data=FeedbackReceipt(received=True))
