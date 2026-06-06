import re
from typing import Optional
from pydantic import BaseModel, field_validator


class InvestRequest(BaseModel):
    fund_id: str
    amount: float
    phone: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v < 1000:
            raise ValueError("Minimum investment is KES 1,000")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not re.match(r"^(\+?254|0)[71]\d{8}$", v):
            raise ValueError("Valid Kenyan phone number required")
        return v


class PortfolioWithdrawRequest(BaseModel):
    investment_id: str
    amount: float

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v < 100:
            raise ValueError("Minimum withdrawal is KES 100")
        return v
