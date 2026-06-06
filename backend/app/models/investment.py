from datetime import datetime
from typing import Optional, Literal
from beanie import Document, PydanticObjectId
from pydantic import Field


class Investment(Document):
    user_id: PydanticObjectId
    fund_id: PydanticObjectId
    amount: float
    accrued_interest: float = 0.0
    current_value: float = 0.0
    status: Literal["pending", "active", "matured", "withdrawn"] = "pending"
    invested_at: datetime = Field(default_factory=datetime.utcnow)
    matures_at: Optional[datetime] = None
    withdrawn_at: Optional[datetime] = None
    transaction_id: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "investments"
        indexes = ["user_id", "fund_id", "status"]
