import re
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from beanie import PydanticObjectId

from app.models.transaction import Transaction
from app.models.user import User
from app.middleware.auth import get_current_user
from app.schemas.transaction import InitiatePaymentRequest, WithdrawRequest
from app.services.paystack import (
    charge_mpesa,
    verify_transaction,
    verify_webhook_signature,
    payout_to_phone,
    get_balance,
)
from app.services.sms import notify_transaction
from app.services.websocket import broadcast_transaction_update, broadcast_balance_update

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return digits


# ─── List transactions ───────────────────────────────────────

@router.get("")
async def get_transactions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = None,
    tx_type: Optional[str] = Query(default=None, alias="type"),
    current_user: dict = Depends(get_current_user),
):
    user_id = PydanticObjectId(current_user["userId"])
    offset = (page - 1) * limit

    filters = [Transaction.user_id == user_id]
    if status:
        filters.append(Transaction.status == status)
    if tx_type:
        filters.append(Transaction.type == tx_type)

    total = await Transaction.find(*filters).count()
    transactions = await Transaction.find(*filters) \
        .sort(-Transaction.created_at).skip(offset).limit(limit).to_list()

    return {
        "success": True,
        "data": [
            {
                "id": str(t.id),
                "type": t.type,
                "amount": t.amount,
                "phone": t.phone,
                "paystackReference": t.reference,
                "status": t.status,
                "description": t.description,
                "createdAt": t.created_at.isoformat(),
            }
            for t in transactions
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": -(-total // limit),
        },
    }


# ─── Initialize payment (replaces STK push) ─────────────────

@router.post("/pay")
async def initiate_payment(
    body: InitiatePaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Initialize a direct M-Pesa STK Push payment via Paystack.
    Returns a customerMessage instructing the user to complete payment on their device.
    """
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    phone = normalize_phone(body.phone)

    try:
        paystack_data = await charge_mpesa(
            email=user.email,
            amount=body.amount,
            phone=phone,
            metadata={
                "user_id": str(user_id),
                "phone": phone,
                "description": body.description or "Payment to HazinaHub",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to initiate payment prompt: {str(e)}")

    # Record as pending
    tx = Transaction(
        user_id=user_id,
        type="stk_push",
        amount=body.amount,
        phone=phone,
        reference=paystack_data["reference"],
        status="pending",
        description=body.description or "Payment to HazinaHub",
    )
    await tx.insert()

    return {
        "success": True,
        "data": {
            "transactionId": str(tx.id),
            "reference": paystack_data["reference"],
            "customerMessage": "STK Push prompt sent to your phone. Enter your PIN to complete.",
        },
    }


# ─── Verify a transaction by reference ──────────────────────

@router.get("/verify/{reference}")
async def verify_payment(reference: str, current_user: dict = Depends(get_current_user)):
    """
    Manually verify a Paystack transaction by its reference.
    Useful for polling after the user completes payment.
    """
    user_id = PydanticObjectId(current_user["userId"])

    try:
        ps_data = await verify_transaction(reference)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Sync our DB record
    tx = await Transaction.find_one(
        Transaction.reference == reference,
        Transaction.user_id == user_id,
    )

    if tx and tx.status == "pending":
        tx.status = "completed"
        await tx.save()

        is_investment = tx.description and tx.description.startswith("Investment in")
        if not is_investment:
            user = await User.get(user_id)
            if user:
                user.wallet_balance += tx.amount
                await user.save()
        else:
            from app.models.investment import Investment
            from datetime import datetime
            inv = await Investment.find_one(
                Investment.transaction_id == tx.id,
                Investment.status == "pending"
            )
            if inv:
                inv.status = "active"
                inv.invested_at = datetime.utcnow()
                inv.updated_at = datetime.utcnow()
                await inv.save()

        asyncio.create_task(broadcast_transaction_update(str(user_id), {
            "id": str(tx.id), "type": tx.type, "amount": tx.amount,
            "status": "completed", "reference": reference,
        }))

    amount_kes = ps_data.get("amount", 0) / 100  # convert from kobo
    return {
        "success": True,
        "data": {
            "reference": reference,
            "status": ps_data.get("status"),
            "amount": amount_kes,
            "paidAt": ps_data.get("paid_at"),
            "channel": ps_data.get("channel"),
            "currency": ps_data.get("currency"),
        },
    }


# ─── Paystack Webhook (replaces STK + C2B callbacks) ────────

@router.post("/webhook")
async def paystack_webhook(request: Request):
    """
    Paystack sends all payment events here.
    Verified via HMAC-SHA512 signature in the x-paystack-signature header.
    Handles: charge.success, transfer.success, transfer.failed
    """
    signature = request.headers.get("x-paystack-signature", "")
    body_bytes = await request.body()

    if not verify_webhook_signature(body_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    payload = json.loads(body_bytes)
    event = payload.get("event")
    data = payload.get("data", {})

    # ── charge.success — user completed payment ───────────────
    if event == "charge.success":
        reference = data.get("reference")
        amount_kes = data.get("amount", 0) / 100
        metadata = data.get("metadata") or {}
        user_id_str = metadata.get("user_id")
        phone = metadata.get("phone")

        if user_id_str:
            try:
                user_id = PydanticObjectId(user_id_str)
                tx = await Transaction.find_one(Transaction.reference == reference)

                if tx and tx.status == "pending":
                    tx.status = "completed"
                    await tx.save()

                    is_investment = tx.description and tx.description.startswith("Investment in")
                    if not is_investment:
                        user = await User.get(user_id)
                        if user:
                            user.wallet_balance += tx.amount
                            await user.save()
                    else:
                        from app.models.investment import Investment
                        from datetime import datetime
                        inv = await Investment.find_one(
                            Investment.transaction_id == tx.id,
                            Investment.status == "pending"
                        )
                        if inv:
                            inv.status = "active"
                            inv.invested_at = datetime.utcnow()
                            inv.updated_at = datetime.utcnow()
                            await inv.save()

                    asyncio.create_task(broadcast_transaction_update(str(user_id), {
                        "id": str(tx.id), "type": tx.type,
                        "amount": tx.amount, "status": "completed",
                        "reference": reference,
                    }))

                    if phone:
                        asyncio.create_task(notify_transaction(phone, amount_kes, "c2b"))

            except Exception as e:
                print(f"Webhook charge.success error: {e}")

    # ── transfer.success — payout completed ───────────────────
    elif event == "transfer.success":
        reference = data.get("reference")
        tx = await Transaction.find_one(Transaction.reference == reference)
        if tx:
            tx.status = "completed"
            await tx.save()
            asyncio.create_task(broadcast_transaction_update(str(tx.user_id), {
                "id": str(tx.id), "type": "withdrawal", "status": "completed",
                "amount": tx.amount,
            }))

    # ── transfer.failed — payout failed ───────────────────────
    elif event == "transfer.failed":
        reference = data.get("reference")
        tx = await Transaction.find_one(Transaction.reference == reference)
        if tx:
            # Refund wallet balance on failed payout
            user = await User.get(tx.user_id)
            if user:
                user.wallet_balance += tx.amount
                await user.save()
            tx.status = "failed"
            await tx.save()
            asyncio.create_task(broadcast_transaction_update(str(tx.user_id), {
                "id": str(tx.id), "type": "withdrawal", "status": "failed",
            }))

    return {"status": "ok"}


# ─── Get transaction by ID ────────────────────────────────────

@router.get("/{tx_id}/status")
async def get_transaction_status(tx_id: str, current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    tx = await Transaction.find_one(
        Transaction.id == PydanticObjectId(tx_id),
        Transaction.user_id == user_id,
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "success": True,
        "data": {
            "id": str(tx.id),
            "type": tx.type,
            "amount": tx.amount,
            "status": tx.status,
            "reference": tx.reference,
            "description": tx.description,
            "createdAt": tx.created_at.isoformat(),
        },
    }


# ─── Withdraw (wallet → M-Pesa via Paystack Transfer) ────────

@router.post("/withdraw")
async def initiate_withdraw(
    body: WithdrawRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Deduct from wallet balance and initiate a Paystack mobile-money transfer.
    """
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.amount > user.wallet_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: KES {user.wallet_balance:,.0f}",
        )

    phone = normalize_phone(body.phone)

    # Deduct immediately (will refund on transfer.failed webhook)
    user.wallet_balance -= body.amount
    await user.save()

    from app.services.paystack import _generate_reference
    ref = _generate_reference()

    tx = Transaction(
        user_id=user_id,
        type="withdrawal",
        amount=body.amount,
        phone=phone,
        reference=ref,
        status="pending",
        description="Withdrawal to M-Pesa",
        balance_after=user.wallet_balance,
    )
    await tx.insert()

    asyncio.create_task(_fire_payout(
        phone=phone,
        name=f"{user.first_name} {user.last_name}".strip() or "HazinaHub User",
        amount=body.amount,
        reference=ref,
        user_id=str(user_id),
    ))

    asyncio.create_task(broadcast_transaction_update(str(user_id), {
        "id": str(tx.id), "type": "withdrawal",
        "amount": tx.amount, "status": "pending",
    }))

    return {
        "success": True,
        "data": {
            "transactionId": str(tx.id),
            "reference": ref,
            "amount": body.amount,
            "message": f"KES {body.amount:,.0f} withdrawal initiated. Funds sent to {phone} via M-Pesa.",
            "newBalance": user.wallet_balance,
        },
    }


async def _fire_payout(phone: str, name: str, amount: float, reference: str, user_id: str) -> None:
    try:
        await payout_to_phone(phone=phone, name=name, amount=amount, reason="HazinaHub Withdrawal")
    except Exception as e:
        print(f"⚠️ Paystack payout failed (sandbox/test): {e}")
        # Webhook transfer.failed will handle the refund
