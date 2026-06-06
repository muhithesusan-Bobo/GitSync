from datetime import datetime, date
from beanie import Document, PydanticObjectId
from pydantic import Field


class PortfolioSnapshot(Document):
    user_id: PydanticObjectId
    total_invested: float
    current_value: float
    total_returns: float
    snapshot_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "portfolio_snapshots"
        indexes = ["user_id", "snapshot_date"]
