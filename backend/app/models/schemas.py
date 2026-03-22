from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

EntropySource = Literal["curby", "fallback"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class EntropyPayload(BaseModel):
    source: EntropySource
    round_id: str
    seed_material: str
    fetched_at: datetime
    warning: str | None = None


class SessionStartResponse(BaseModel):
    session_id: str
    round_id: str
    entropy_source: EntropySource
    entropy_warning: str | None = None
    entropy_bytes: str
    started_at: datetime
