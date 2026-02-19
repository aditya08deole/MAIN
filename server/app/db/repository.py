from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from app.db.base import Base
from app.models.all_models import Node, User, Pipeline, Distributor, Community, Customer, Plan
from app.services.security import EncryptionService

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get(self, id: Any) -> Optional[ModelType]:
        result = await self.session.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100, distributor_id: Optional[str] = None) -> List[ModelType]:
        query = select(self.model)
        if distributor_id and hasattr(self.model, 'distributor_id'):
            query = query.filter(self.model.distributor_id == distributor_id)
        result = await self.session.execute(query.offset(skip).limit(limit))
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
        result = await self.session.execute(
            select(self.model)
            .options(
                selectinload(self.model.config_tank),
                selectinload(self.model.config_deep),
                selectinload(self.model.config_flow),
                selectinload(self.model.thingspeak_mapping)
            )
            .filter(self.model.id == id)
        )
        node = result.scalars().first()
        if node and node.thingspeak_mapping:
            node.thingspeak_mapping.read_api_key = EncryptionService.decrypt(node.thingspeak_mapping.read_api_key)
        return node

    async def get_all(self, skip: int = 0, limit: int = 100, distributor_id: Optional[str] = None) -> List[Node]:
        query = select(self.model).options(
            selectinload(self.model.config_tank),
            selectinload(self.model.config_deep),
            selectinload(self.model.config_flow),
            selectinload(self.model.thingspeak_mapping)
        )
        if distributor_id:
            query = query.filter(self.model.distributor_id == distributor_id)
        
        result = await self.session.execute(query.offset(skip).limit(limit))
        nodes = result.scalars().all()
        for node in nodes:
            if node.thingspeak_mapping:
                node.thingspeak_mapping.read_api_key = EncryptionService.decrypt(node.thingspeak_mapping.read_api_key)
        return nodes

    async def get_by_key(self, key: str) -> Optional[Node]:
        result = await self.session.execute(
            select(self.model)
            .options(
                selectinload(self.model.config_tank),
                selectinload(self.model.config_deep),
                selectinload(self.model.config_flow),
                selectinload(self.model.thingspeak_mapping)
            )
            .filter(self.model.node_key == key)
        )
        node = result.scalars().first()
        if node and node.thingspeak_mapping:
            node.thingspeak_mapping.read_api_key = EncryptionService.decrypt(node.thingspeak_mapping.read_api_key)
        return node

    async def get_count_by_customer(self, customer_id: str) -> int:
        result = await self.session.execute(
            select(func.count(self.model.id)).filter(self.model.customer_id == customer_id)
        )
        return result.scalar() or 0

class DistributorRepository(BaseRepository[Distributor]):
    def __init__(self, session: AsyncSession):
        super().__init__(Distributor, session)

class CommunityRepository(BaseRepository[Community]):
    async def get_with_counts(self, distributor_id: Optional[str] = None) -> List[Community]:
        stmt = (
            select(self.model, func.count(Node.id).label("node_count"))
            .outerjoin(Node, Node.community_id == self.model.id)
            .group_by(self.model.id)
        )
        if distributor_id:
            stmt = stmt.filter(self.model.distributor_id == distributor_id)
        
        result = await self.session.execute(stmt)
        items = []
        for comm, count in result.unique().all():
             comm.node_count = count
             items.append(comm)
        return items

    def __init__(self, session: AsyncSession):
        super().__init__(Community, session)
        
    async def get_by_name(self, name: str) -> Optional[Community]:
        # Case insensitive exact match or close match
        result = await self.session.execute(
            select(self.model).filter(self.model.name.ilike(name))
        )
        return result.scalars().first()

    async def get_by_slug(self, slug: str) -> Optional[Community]:
        result = await self.session.execute(
            select(self.model).filter(self.model.slug == slug)
        )
        return result.scalars().first()

class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, session: AsyncSession):
        super().__init__(Customer, session)

    async def get_with_devices(self, id: Any) -> Optional[Customer]:
        result = await self.session.execute(
            select(self.model)
            .options(selectinload(self.model.devices))
            .filter(self.model.id == id)
        )
        return result.scalars().first()

class PlanRepository(BaseRepository[Plan]):
    def __init__(self, session: AsyncSession):
        super().__init__(Plan, session)

class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession):
        super().__init__(User, session)
        
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(select(self.model).filter(self.model.email == email))
        return result.scalars().first()

class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)
        
    async def get_all(self, skip: int = 0, limit: int = 100, distributor_id: Optional[str] = None) -> List[AuditLog]:
        query = select(self.model)
        if distributor_id:
            # Audit logs are tricky if they don't have distributor_id directly.
            # However, our AuditLog model has it in metadata or resource linkage.
            # For simplicity, if distributor, filter by their user_id as performed_by 
            # OR by metadata containing their ID if we add it.
            # Actually, standard is to filter by performed_by = user.id if limited.
            query = query.filter(self.model.performed_by == distributor_id)
            
        result = await self.session.execute(query.order_by(self.model.timestamp.desc()).offset(skip).limit(limit))
        return result.scalars().all()
