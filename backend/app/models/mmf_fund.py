from datetime import datetime
from typing import Literal
from beanie import Document
from pydantic import Field


class MmfFund(Document):
    name: str
    provider: str
    interest_rate: float
    minimum_investment: float = 1000.0
    risk_level: Literal["low", "medium", "high"] = "low"
    maturity_days: int = 0
    total_aum: float = 0.0
    description: str = ""
    website_url: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "mmf_funds"
        indexes = ["is_active"]
