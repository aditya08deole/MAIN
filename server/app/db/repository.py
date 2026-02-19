from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.base import Base
from app.models.all_models import Node, User, Pipeline

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get(self, id: Any) -> Optional[ModelType]:
        result = await self.session.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        result = await self.session.execute(select(self.model).offset(skip).limit(limit))
        return result.scalars().all()

    async def create(self, attributes: dict) -> ModelType:
        obj = self.model(**attributes)
        self.session.add(obj)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def update(self, id: Any, attributes: dict) -> Optional[ModelType]:
        await self.session.execute(
            update(self.model).where(self.model.id == id).values(**attributes)
        )
        await self.session.commit()
        return await self.get(id)

    async def delete(self, id: Any) -> bool:
        await self.session.execute(delete(self.model).where(self.model.id == id))
        await self.session.commit()
        return True

# ─── CONCRETE REPOSITORIES ───

class NodeRepository(BaseRepository[Node]):
    def __init__(self, session: AsyncSession):
        super().__init__(Node, session)
    
    async def get(self, id: Any) -> Optional[Node]:
        from sqlalchemy.orm import selectinload
        result = await self.session.execute(
            select(self.model)
            .options(selectinload(self.model.assignments))
            .filter(self.model.id == id)
        )
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Node]:
        from sqlalchemy.orm import selectinload
        result = await self.session.execute(
            select(self.model)
            .options(selectinload(self.model.assignments))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_by_key(self, key: str) -> Optional[Node]:
        from sqlalchemy.orm import selectinload
        result = await self.session.execute(
            select(self.model)
            .options(selectinload(self.model.assignments))
            .filter(self.model.node_key == key)
        )
        return result.scalars().first()

    async def get_by_category(self, category: str) -> List[Node]:
        from sqlalchemy.orm import selectinload
        result = await self.session.execute(
            select(self.model)
            .options(selectinload(self.model.assignments))
            .filter(self.model.category == category)
        )
        return result.scalars().all()

class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession):
        super().__init__(User, session)
        
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(select(self.model).filter(self.model.email == email))
        return result.scalars().first()
