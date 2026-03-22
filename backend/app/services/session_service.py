from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.models.schemas import SessionStartResponse
from app.services.curby_service import CurbyService


class SessionService:
    def __init__(self, curby_service: CurbyService) -> None:
        self.curby_service = curby_service

    async def start_session(self) -> SessionStartResponse:
        entropy = await self.curby_service.fetch_latest_entropy()
        session_id = uuid4().hex
        return SessionStartResponse(
            session_id=session_id,
            round_id=entropy.round_id,
            entropy_source=entropy.source,
            entropy_warning=entropy.warning,
            entropy_bytes=entropy.seed_material,
            started_at=datetime.now(UTC),
        )
