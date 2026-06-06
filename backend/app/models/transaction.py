from datetime import datetime
from typing import Optional, Literal
from beanie import Document, PydanticObjectId
from pydantic import Field


class Transaction(Document):
    user_id: PydanticObjectId
    type: Literal["deposit", "withdrawal", "investment", "return", "fee",
                  "refund", "c2b", "stk_push", "b2c"]
    amount: float
    balance_after: Optional[float] = None
    description: str = ""
    status: Literal["pending", "completed", "failed"] = "pending"
    phone: Optional[str] = None
    reference: Optional[str] = None
    merchant_request_id: Optional[str] = None
    checkout_request_id: Optional[str] = None
    mpesa_receipt_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transactions"
        indexes = ["user_id", "status", "created_at"]
