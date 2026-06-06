from datetime import datetime
from typing import Optional, Literal
from beanie import Document, PydanticObjectId
from pydantic import Field


class FraudAlert(Document):
    user_id: PydanticObjectId
    transaction_id: Optional[PydanticObjectId] = None
    alert_type: str
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    description: str
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "fraud_alerts"
        indexes = ["user_id", "created_at"]
