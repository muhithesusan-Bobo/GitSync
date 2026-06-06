from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from beanie import PydanticObjectId
import asyncio

from app.models.investment import Investment
from app.models.transaction import Transaction
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.mmf_fund import MmfFund
from app.models.user import User
from app.middleware.auth import get_current_user
from app.schemas.investment import PortfolioWithdrawRequest

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("")
async def get_portfolio_summary(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])

    # Active + matured investments
    active_investments = await Investment.find(
        Investment.user_id == user_id,
        Investment.status.in_(["active", "matured"]),
    ).to_list()

    total_invested = sum(i.amount for i in active_investments)
    current_value = sum(i.current_value for i in active_investments)
    total_returns = sum(i.accrued_interest for i in active_investments)
    yield_pct = round((total_returns / total_invested * 100), 2) if total_invested > 0 else 0.0

    # Withdrawal eligible (matured)
    matured = [i for i in active_investments if i.status == "matured"]
    withdrawal_eligible = sum(i.current_value for i in matured)

    # 30-day portfolio growth snapshots
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    snapshots = await PortfolioSnapshot.find(
        PortfolioSnapshot.user_id == user_id,
        PortfolioSnapshot.created_at >= thirty_days_ago,
    ).sort(PortfolioSnapshot.snapshot_date).to_list()

    growth_data = [
        {"date": str(s.snapshot_date), "value": s.current_value}
        for s in snapshots
    ]

    # Enrich investments with fund details
    investments_data = []
    for inv in active_investments:
        fund = await MmfFund.get(inv.fund_id)
        investments_data.append({
            "id": str(inv.id),
            "fundName": fund.name if fund else "Unknown Fund",
            "provider": fund.provider if fund else "",
            "amount": inv.amount,
            "currentValue": inv.current_value,
            "accruedInterest": inv.accrued_interest,
            "interestRate": fund.interest_rate if fund else 0,
            "riskLevel": fund.risk_level if fund else "low",
            "status": inv.status,
            "investedAt": inv.invested_at.isoformat(),
            "maturesAt": inv.matures_at.isoformat() if inv.matures_at else None,
        })

    return {
        "success": True,
        "data": {
            "totalInvested": total_invested,
            "currentValue": current_value,
            "totalReturns": total_returns,
            "yieldPercentage": yield_pct,
            "withdrawalEligible": withdrawal_eligible,
            "growthData": growth_data,
            "investments": sorted(investments_data, key=lambda x: x["currentValue"], reverse=True),
        },
    }


@router.post("/withdraw")
async def request_withdrawal(
    body: PortfolioWithdrawRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = PydanticObjectId(current_user["userId"])

    investment = await Investment.find_one(
        Investment.id == PydanticObjectId(body.investment_id),
        Investment.user_id == user_id,
        Investment.status == "matured",
    )
    if not investment:
        raise HTTPException(status_code=400, detail="Investment not eligible for withdrawal")

    if body.amount > investment.current_value:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum withdrawal is KES {investment.current_value:,.0f}",
        )

    fund = await MmfFund.get(investment.fund_id)
    fund_name = fund.name if fund else "the fund"

    user = await User.get(user_id)
    phone = user.phone if user else ""

    # Record withdrawal transaction
    from app.services.paystack import _generate_reference
    ref = _generate_reference()
    tx = Transaction(
        user_id=user_id,
        type="withdrawal",
        amount=body.amount,
        phone=phone,
        reference=ref,
        status="pending",
        description=f"Withdrawal from {fund_name}",
    )
    await tx.insert()

    # Update investment value
    new_value = investment.current_value - body.amount
    if new_value <= 0:
        investment.status = "withdrawn"
        investment.current_value = 0.0
        investment.withdrawn_at = datetime.utcnow()
    else:
        investment.current_value = new_value
    investment.updated_at = datetime.utcnow()
    await investment.save()

    # Fire Paystack payout
    user_name = f"{user.first_name} {user.last_name}".strip() or "HazinaHub User"
    asyncio.create_task(_fire_payout(phone, user_name, body.amount, ref, fund_name))

    return {
        "success": True,
        "data": {
            "message": f"Withdrawal of KES {body.amount:,.0f} initiated from {fund_name}"
        },
    }


async def _fire_payout(phone: str, name: str, amount: float, reference: str, fund_name: str) -> None:
    try:
        from app.services.paystack import payout_to_phone
        await payout_to_phone(
            phone=phone,
            name=name,
            amount=amount,
            reason=f"Withdrawal from {fund_name}",
            reference=reference
        )
    except Exception as e:
        print(f"⚠️ Paystack payout failed: {e}")
