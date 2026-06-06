import os
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from jose import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

ph = PasswordHasher()

JWT_SECRET = os.getenv("JWT_SECRET", "default_secret")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "default_refresh_secret")
ALGORITHM = "HS256"


def generate_tokens(user_id: str, role: str) -> dict:
    access_token = jwt.encode(
        {"userId": user_id, "role": role, "exp": datetime.utcnow() + timedelta(minutes=15)},
        JWT_SECRET, algorithm=ALGORITHM,
    )
    refresh_token = jwt.encode(
        {"userId": user_id, "role": role, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_REFRESH_SECRET, algorithm=ALGORITHM,
    )
    return {"accessToken": access_token, "refreshToken": refresh_token}


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return digits


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = ph.hash(body.password)
    phone = normalize_phone(body.phone)

    user = User(
        email=body.email,
        password=hashed,
        phone=phone,
        first_name=body.first_name,
        last_name=body.last_name,
        business_name=body.business_name or "",
    )
    await user.insert()

    tokens = generate_tokens(str(user.id), "user")
    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "businessName": user.business_name,
                "role": "user",
            },
            **tokens,
        },
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    try:
        ph.verify(user.password, body.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Rehash if needed (argon2 auto-upgrade)
    if ph.check_needs_rehash(user.password):
        user.password = ph.hash(body.password)
        await user.save()

    tokens = generate_tokens(str(user.id), "user")
    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "businessName": user.business_name,
                "role": "user",
            },
            **tokens,
        },
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    try:
        decoded = jwt.decode(body.refresh_token, JWT_REFRESH_SECRET, algorithms=[ALGORITHM])
        tokens = generate_tokens(decoded["userId"], decoded["role"])
        return {"success": True, "data": tokens}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user = await User.get(current_user["userId"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "phone": user.phone,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "businessName": user.business_name,
            "role": user.role,
            "isVerified": user.is_verified,
            "autoInvestEnabled": user.auto_invest_enabled,
            "autoInvestPercentage": user.auto_invest_percentage,
            "walletBalance": user.wallet_balance,
            "createdAt": user.created_at.isoformat(),
        },
    }
