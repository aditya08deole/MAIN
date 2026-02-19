from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar("T")

class StandardResponse(GenericModel, Generic[T]):
    status: str = "success"
    data: Optional[T] = None
    meta: Optional[dict] = None
    message: Optional[str] = None
