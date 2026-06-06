import re
from typing import Optional, Literal
from pydantic import BaseModel, field_validator


class InitiatePaymentRequest(BaseModel):
    amount: float
    phone: str
    description: Optional[str] = "Payment to HazinaHub"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^(\+?254|0)[71]\d{8}$", v):
            raise ValueError("Valid Kenyan phone number required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class WithdrawRequest(BaseModel):
    amount: float
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^(\+?254|0)[71]\d{8}$", v):
            raise ValueError("Valid Kenyan phone number required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    phone: Optional[str] = None
    mpesa_receipt_number: Optional[str] = None
    status: str
    description: str
    created_at: str


class TransactionListQuery(BaseModel):
    page: int = 1
    limit: int = 20
    status: Optional[Literal["pending", "completed", "failed"]] = None
    type: Optional[str] = None
