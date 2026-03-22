from fastapi import APIRouter

from app.models.schemas import SessionStartResponse
from app.services.curby_service import CurbyService
from app.services.session_service import SessionService

router = APIRouter(prefix="/api/session", tags=["session"])

_service = SessionService(CurbyService())


@router.post("/start", response_model=SessionStartResponse)
async def start_session() -> SessionStartResponse:
    return await _service.start_session()
