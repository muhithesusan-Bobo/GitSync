from fastapi import APIRouter, Depends, HTTPException
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional

from app.models.transaction import Transaction
from app.models.investment import Investment
from app.models.mmf_fund import MmfFund
from app.models.user import User
from app.models.ai_insight import AiInsight
from app.middleware.auth import get_current_user
from app.services import ai as ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ─── Helpers ─────────────────────────────────────────────────

async def _get_transaction_data(user_id: PydanticObjectId) -> dict:
    pipeline = [
        {"$match": {"user_id": user_id, "status": "completed"}},
        {"$group": {
            "_id": None,
            "revenue": {"$sum": {"$cond": [{"$in": ["$type", ["c2b", "stk_push"]]}, "$amount", 0]}},
            "expenses": {"$sum": {"$cond": [{"$in": ["$type", ["b2c", "withdrawal"]]}, "$amount", 0]}},
            "count": {"$sum": 1},
        }},
    ]
    result = await Transaction.aggregate(pipeline).to_list()
    row = result[0] if result else {}
    revenue = row.get("revenue", 0.0)
    expenses = row.get("expenses", 0.0)
    count = row.get("count", 0)

    recent = await Transaction.find(
        Transaction.user_id == user_id,
        Transaction.status == "completed",
    ).sort(-Transaction.created_at).limit(20).to_list()

    return {
        "total_revenue": revenue,
        "total_expenses": expenses,
        "transaction_count": count,
        "average_transaction": ((revenue + expenses) / count) if count > 0 else 0,
        "recent_transactions": [
            {"amount": t.amount, "type": t.type, "date": t.created_at.isoformat()}
            for t in recent
        ],
    }


async def _get_investment_data(user_id: PydanticObjectId) -> dict:
    investments = await Investment.find(
        Investment.user_id == user_id,
        Investment.status == "active",
    ).to_list()

    funds = []
    for inv in investments:
        fund = await MmfFund.get(inv.fund_id)
        if fund:
            funds.append({"name": fund.name, "amount": inv.amount, "rate": fund.interest_rate})

    return {
        "total_invested": sum(i.amount for i in investments),
        "current_value": sum(i.current_value for i in investments),
        "returns": sum(i.accrued_interest for i in investments),
        "funds": funds,
    }


# ─── Routes ──────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_transactions(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    business_name = user.business_name or "My Business" if user else "My Business"

    tx_data = await _get_transaction_data(user_id)
    inv_data = await _get_investment_data(user_id)

    analysis = await ai_service.analyze_financials(
        total_revenue=tx_data["total_revenue"],
        total_expenses=tx_data["total_expenses"],
        transaction_count=tx_data["transaction_count"],
        average_transaction=tx_data["average_transaction"],
        recent_transactions=tx_data["recent_transactions"],
        total_invested=inv_data["total_invested"],
        current_value=inv_data["current_value"],
        returns=inv_data["returns"],
        funds=inv_data["funds"],
        business_name=business_name,
    )

    # Cache the insight
    insight = AiInsight(
        user_id=user_id,
        type="investment_advice",
        content=analysis,
        confidence=0.85,
    )
    await insight.insert()

    return {"success": True, "data": {"analysis": analysis}}


class AdviceRequest(BaseModel):
    risk_tolerance: str = "medium"
    monthly_income: float = 50000


@router.post("/advice")
async def get_advice(body: AdviceRequest, current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    inv_data = await _get_investment_data(user_id)

    available_funds = await MmfFund.find(MmfFund.is_active == True).sort(-MmfFund.interest_rate).to_list()
    funds_list = [
        {
            "name": f.name,
            "rate": f.interest_rate,
            "risk_level": f.risk_level,
            "min_investment": f.minimum_investment,
        }
        for f in available_funds
    ]

    advice = await ai_service.get_investment_advice(
        risk_tolerance=body.risk_tolerance,
        monthly_income=body.monthly_income,
        total_invested=inv_data["total_invested"],
        funds_count=len(inv_data["funds"]),
        available_funds=funds_list,
    )

    return {"success": True, "data": {"advice": advice}}


@router.get("/health-score")
async def get_health_score(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    tx_data = await _get_transaction_data(user_id)
    inv_data = await _get_investment_data(user_id)

    score = ai_service.calculate_health_score(
        total_revenue=tx_data["total_revenue"],
        total_expenses=tx_data["total_expenses"],
        transaction_count=tx_data["transaction_count"],
        total_invested=inv_data["total_invested"],
        current_value=inv_data["current_value"],
        returns=inv_data["returns"],
        funds=inv_data["funds"],
    )
    return {"success": True, "data": score}


@router.get("/insights")
async def get_insights(current_user: dict = Depends(get_current_user)):
    user_id = PydanticObjectId(current_user["userId"])
    insights = await AiInsight.find(AiInsight.user_id == user_id) \
        .sort(-AiInsight.created_at).limit(10).to_list()

    return {
        "success": True,
        "data": [
            {
                "id": str(i.id),
                "type": i.type,
                "content": i.content,
                "riskScore": i.risk_score,
                "confidence": i.confidence,
                "createdAt": i.created_at.isoformat(),
            }
            for i in insights
        ],
    }


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
async def process_chat(body: ChatRequest, current_user: dict = Depends(get_current_user)):
    if not body.message:
        raise HTTPException(status_code=400, detail="Message is required")

    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    business_name = user.business_name or "My Business" if user else "My Business"

    tx_data = await _get_transaction_data(user_id)
    inv_data = await _get_investment_data(user_id)

    try:
        reply = await ai_service.process_chat_message(
            message=body.message,
            total_revenue=tx_data["total_revenue"],
            total_expenses=tx_data["total_expenses"],
            total_invested=inv_data["total_invested"],
            current_value=inv_data["current_value"],
            returns=inv_data["returns"],
            funds=inv_data["funds"],
            business_name=business_name,
        )
        return {"success": True, "data": {"reply": reply}}
    except Exception as e:
        is_rate_limit = "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)
        if is_rate_limit:
            return {
                "success": True,
                "data": {
                    "reply": (
                        "I'm currently experiencing high demand and need a brief moment to recharge. "
                        "Please try again in about a minute — I'll be ready to help with your "
                        "financial analysis! 💡\n\nIn the meantime, check your Dashboard for "
                        "real-time transaction data and AI insights."
                    )
                },
            }
        raise HTTPException(status_code=500, detail="Chat processing failed")
