import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from beanie import PydanticObjectId

from app.models.mmf_fund import MmfFund
from app.models.investment import Investment
from app.models.transaction import Transaction
from app.models.user import User
from app.middleware.auth import get_current_user
from app.schemas.investment import InvestRequest
from app.services.paystack import charge_mpesa, _generate_reference

router = APIRouter(prefix="/api/investments", tags=["investments"])


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return digits


@router.get("/funds")
async def get_available_funds():
    funds = await MmfFund.find(MmfFund.is_active == True).sort(-MmfFund.interest_rate).to_list()
    return {
        "success": True,
        "data": [
            {
                "id": str(f.id),
                "name": f.name,
                "provider": f.provider,
                "interestRate": f.interest_rate,
                "minimumInvestment": f.minimum_investment,
                "riskLevel": f.risk_level,
                "maturityDays": f.maturity_days,
                "totalAum": f.total_aum,
                "description": f.description,
                "websiteUrl": f.website_url,
            }
            for f in funds
        ],
    }


@router.post("/invest")
async def invest_in_fund(body: InvestRequest, current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    fund = await MmfFund.get(PydanticObjectId(body.fund_id))
    if not fund or not fund.is_active:
        raise HTTPException(status_code=404, detail="Fund not found or inactive")

    if body.amount < fund.minimum_investment:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum investment for {fund.name} is KES {fund.minimum_investment:,.0f}",
        )

    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    matures_at = None
    if fund.maturity_days > 0:
        matures_at = datetime.utcnow() + timedelta(days=fund.maturity_days)

    if body.phone:
        phone = normalize_phone(body.phone)

        try:
            paystack_data = await charge_mpesa(
                email=user.email,
                amount=body.amount,
                phone=phone,
                metadata={
                    "user_id": str(user_id),
                    "phone": phone,
                    "description": f"Investment in {fund.name}",
                },
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to initiate investment prompt: {str(e)}")

        tx = Transaction(
            user_id=user_id,
            type="stk_push",
            amount=body.amount,
            phone=phone,
            reference=paystack_data["reference"],
            status="pending",
            description=f"Investment in {fund.name}",
        )
        await tx.insert()

        investment = Investment(
            user_id=user_id,
            fund_id=fund.id,
            amount=body.amount,
            current_value=body.amount,
            status="pending",
            matures_at=matures_at,
            transaction_id=tx.id,
        )
        await investment.insert()

        return {
            "success": True,
            "data": {
                "investmentId": str(investment.id),
                "transactionId": str(tx.id),
                "reference": paystack_data["reference"],
                "customerMessage": "STK Push prompt sent to your phone. Enter your PIN to complete.",
                "fund": {
                    "name": fund.name,
                    "interestRate": fund.interest_rate,
                },
            },
        }

    if body.amount > user.wallet_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. Available: KES {user.wallet_balance:,.0f}",
        )

    user.wallet_balance -= body.amount
    await user.save()

    reference = _generate_reference()
    tx = Transaction(
        user_id=user_id,
        type="investment",
        amount=body.amount,
        status="completed",
        description=f"Investment in {fund.name}",
        reference=reference,
        balance_after=user.wallet_balance,
    )
    await tx.insert()

    investment = Investment(
        user_id=user_id,
        fund_id=fund.id,
        amount=body.amount,
        current_value=body.amount,
        status="active",
        invested_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        matures_at=matures_at,
        transaction_id=tx.id,
    )
    await investment.insert()

    return {
        "success": True,
        "data": {
            "investmentId": str(investment.id),
            "transactionId": str(tx.id),
            "reference": reference,
            "message": "Investment funded from wallet balance.",
            "newBalance": user.wallet_balance,
            "fund": {
                "name": fund.name,
                "interestRate": fund.interest_rate,
            },
        },
    }


@router.get("")
async def get_user_investments(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    investments = await Investment.find(
        Investment.user_id == user_id
    ).sort(-Investment.created_at).to_list()

    result = []
    for inv in investments:
        fund = await MmfFund.get(inv.fund_id)
        result.append({
            "id": str(inv.id),
            "fundId": str(inv.fund_id),
            "fundName": fund.name if fund else "Unknown Fund",
            "provider": fund.provider if fund else "",
            "amount": inv.amount,
            "accruedInterest": inv.accrued_interest,
            "currentValue": inv.current_value,
            "interestRate": fund.interest_rate if fund else 0,
            "riskLevel": fund.risk_level if fund else "low",
            "status": inv.status,
            "investedAt": inv.invested_at.isoformat(),
            "maturesAt": inv.matures_at.isoformat() if inv.matures_at else None,
        })

    return {"success": True, "data": result}
