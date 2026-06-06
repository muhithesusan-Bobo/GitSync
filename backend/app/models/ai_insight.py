from datetime import datetime
from typing import Optional, Literal
from beanie import Document, PydanticObjectId
from pydantic import Field


class AiInsight(Document):
    user_id: PydanticObjectId
    type: Literal["investment_advice", "risk_assessment",
                  "revenue_prediction", "financial_health"]
    content: str
    risk_score: Optional[float] = None
    confidence: float = 0.85
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "ai_insights"
        indexes = ["user_id", "created_at"]
