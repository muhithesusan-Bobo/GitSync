import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class RegisterRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    email: EmailStr
    password: str
    phone: str
    first_name: str
    last_name: str
    business_name: Optional[str] = ""

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^(\+?254|0)[71]\d{8}$", v):
            raise ValueError("Valid Kenyan phone number required (e.g. 0712345678)")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    phone: str
    first_name: str
    last_name: str
    business_name: str
    role: str
    is_verified: bool = False
    wallet_balance: float = 0.0


class AuthResponse(BaseModel):
    success: bool = True
    data: dict
