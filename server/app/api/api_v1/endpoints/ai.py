from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api import deps
from app.db.session import get_db
from app.core import security_supabase
from app.services.ai_context import AIContextService
from app.services.llm import LLMService

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # [{"role": "user", "content": "..."}]

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Interact with the AI Assistant.
    """
    user_id = user_payload.get("sub")
    
    # 1. Build Context
    context_service = AIContextService(db)
    context = await context_service.build_context(user_id)
    
    # 2. Call LLM
    llm_service = LLMService()
    ai_text = await llm_service.generate_response(
        prompt=request.message,
        context=context,
        history=request.history
    )
    
    return ChatResponse(response=ai_text)
