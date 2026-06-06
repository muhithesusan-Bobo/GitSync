import os
import asyncio
from typing import List
from google import genai

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


# ─── Retry wrapper ───────────────────────────────────────────

async def _call_with_retry(prompt: str, max_retries: int = 1) -> str:
    """Call Gemini with exponential backoff on 429 rate-limit errors."""
    for attempt in range(max_retries + 1):
        try:
            response = await asyncio.to_thread(
                _client.models.generate_content,
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            is_rate_limit = "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)
            if is_rate_limit and attempt < max_retries:
                delay = 2 ** (attempt + 1)
                print(f"[WARN] Gemini rate-limited, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
            else:
                raise
    raise RuntimeError("Max retries exceeded")


# ─── AI functions ────────────────────────────────────────────

async def analyze_financials(
    total_revenue: float,
    total_expenses: float,
    transaction_count: int,
    average_transaction: float,
    recent_transactions: list,
    total_invested: float,
    current_value: float,
    returns: float,
    funds: list,
    business_name: str,
) -> str:
    prompt = f"""You are Hazina AI, a financial advisor for Kenyan small businesses.
Analyze the following financial data for "{business_name}" and provide actionable insights in 3-4 bullet points.
Focus on cash flow patterns, spending optimization, and growth opportunities.
Use KES (Kenyan Shilling) for all amounts. Keep it concise and professional.

Transaction Summary:
- Total Revenue: KES {total_revenue:,.0f}
- Total Expenses: KES {total_expenses:,.0f}
- Transaction Count: {transaction_count}
- Average Transaction: KES {average_transaction:,.0f}

Investment Summary:
- Total Invested: KES {total_invested:,.0f}
- Current Value: KES {current_value:,.0f}
- Returns: KES {returns:,.0f}
- Active Funds: {", ".join(f"{f['name']} ({f['rate']}%)" for f in funds) or "None"}

Provide your analysis:"""
    return await _call_with_retry(prompt)


async def get_investment_advice(
    risk_tolerance: str,
    monthly_income: float,
    total_invested: float,
    funds_count: int,
    available_funds: list,
) -> str:
    funds_list = "\n".join(
        f"- {f['name']}: {f['rate']}% p.a., Min KES {f['min_investment']:,.0f}, Risk: {f['risk_level']}"
        for f in available_funds
    )
    prompt = f"""You are Hazina AI, an investment advisor for Kenyan small businesses.
Based on the following profile, recommend the best Money Market Fund allocation.

Risk Tolerance: {risk_tolerance}
Monthly Income: KES {monthly_income:,.0f}
Current Investments: KES {total_invested:,.0f} across {funds_count} funds

Available MMFs in Kenya:
{funds_list}

Provide specific fund recommendations with allocation percentages. Keep it to 3-4 actionable points."""
    return await _call_with_retry(prompt)


def calculate_health_score(
    total_revenue: float,
    total_expenses: float,
    transaction_count: int,
    total_invested: float,
    current_value: float,
    returns: float,
    funds: list,
) -> dict:
    """Deterministic health score — no AI needed."""
    savings_rate = ((total_revenue - total_expenses) / total_revenue * 100) if total_revenue > 0 else 0

    cash_flow_score = min(100, max(0,
        90 if savings_rate > 20 else 70 if savings_rate > 10 else 50 if savings_rate > 0 else 20
    ))
    savings_score = min(100, max(0,
        min(90, (total_invested / total_revenue * 100)) if total_invested > 0 and total_revenue > 0 else 10
    ))
    diversity_score = min(100,
        90 if len(funds) >= 4 else 70 if len(funds) >= 2 else 50 if len(funds) == 1 else 10
    )
    return_score = min(100, 60 + (returns / total_invested * 200)) if returns > 0 and total_invested > 0 else 30

    overall = round(cash_flow_score * 0.3 + savings_score * 0.25 + diversity_score * 0.2 + return_score * 0.25)

    recommendations = []
    if savings_rate < 10:
        recommendations.append("Increase your savings rate to at least 10% of revenue")
    if len(funds) < 2:
        recommendations.append("Diversify by investing in at least 2 different MMFs")
    if total_invested == 0:
        recommendations.append("Start investing — even KES 1,000 in a money market fund")
    if cash_flow_score < 50:
        recommendations.append("Review expenses to improve cash flow stability")

    return {
        "overall": overall,
        "cash_flow": round(cash_flow_score),
        "savings": round(savings_score),
        "investment_diversity": round(diversity_score),
        "recommendations": recommendations,
    }


async def predict_revenue_trend(monthly_revenues: List[float], business_name: str) -> str:
    revenues_str = ", ".join(f"KES {r:,.0f}" for r in monthly_revenues)
    prompt = f"""You are Hazina AI. Analyze these monthly revenue figures (KES) for "{business_name}" and predict the next 3 months trend.
Be specific with predicted amounts and reasoning. Keep it to 3-4 concise points.

Monthly Revenues (oldest to newest): {revenues_str}"""
    return await _call_with_retry(prompt)


async def process_chat_message(
    message: str,
    total_revenue: float,
    total_expenses: float,
    total_invested: float,
    current_value: float,
    returns: float,
    funds: list,
    business_name: str,
) -> str:
    try:
        prompt = f"""You are Hazina AI, a friendly, intelligent financial advisor for Kenyan small businesses.
You are currently talking to the owner of "{business_name}".
Keep your answers conversational, concise, and highly relevant.
Whenever you talk about money, use KES (Kenyan Shilling) and format numbers clearly (e.g., KES 10,000).

Here is the current financial context of the business:
- Total Revenue (Incoming): KES {total_revenue:,.0f}
- Total Expenses (Outgoing): KES {total_expenses:,.0f}
- Total Invested in MMFs: KES {total_invested:,.0f}
- Current Investment Value: KES {current_value:,.0f}
- Active Funds: {", ".join(f["name"] for f in funds) if funds else "None"}

User Message: "{message}"

Respond directly to the user's message as Hazina AI:"""
        return await _call_with_retry(prompt)
    except Exception:
        return _offline_response(message, total_revenue, total_expenses, total_invested, returns, funds, business_name)


def _offline_response(
    message: str,
    total_revenue: float,
    total_expenses: float,
    total_invested: float,
    returns: float,
    funds: list,
    business_name: str,
) -> str:
    msg = message.lower()
    balance = total_revenue - total_expenses

    if any(k in msg for k in ["balance", "account"]):
        return (
            f"Hi {business_name}! Your current account balance is KES {balance:,.0f}. "
            f"You've received KES {total_revenue:,.0f} in deposits and spent KES {total_expenses:,.0f}."
        )
    if any(k in msg for k in ["invest", "mmf", "fund", "money market"]):
        if total_invested > 0:
            return (
                f"You currently have KES {total_invested:,.0f} invested across {len(funds)} fund(s) — "
                f"{', '.join(f['name'] for f in funds)}. Your total returns so far are KES {returns:,.0f}. "
                "Consider diversifying across 2–3 funds for better risk management!"
            )
        return (
            "You haven't invested in any Money Market Funds yet. Start with as little as KES 1,000 "
            "in a low-risk fund. Head to the Investments tab to explore options!"
        )
    if any(k in msg for k in ["save", "saving", "budget"]):
        rate = (balance / total_revenue * 100) if total_revenue > 0 else 0
        return (
            f"Your current savings rate is {rate:.1f}% of your total income. "
            "Financial experts recommend saving at least 20% of your revenue."
        )
    if any(k in msg for k in ["hello", "hi", "hey", "help"]):
        return (
            "Hello! I'm Hazina AI, your financial advisor. I can help you with:\n\n"
            "• **Account balance** — Check your current funds\n"
            "• **Investment advice** — Explore Money Market Funds\n"
            "• **Savings tips** — Optimize your finances\n"
            "• **Financial health** — Review your spending patterns\n\n"
            "What would you like to know about?"
        )
    return (
        f"Thanks for your question! Here's a quick overview of your finances, {business_name}:\n\n"
        f"• Balance: KES {balance:,.0f}\n"
        f"• Total Deposits: KES {total_revenue:,.0f}\n"
        f"• Invested: KES {total_invested:,.0f}\n"
        f"• MMF Returns: KES {returns:,.0f}\n\n"
        "Tip: Deposit funds via the Dashboard, then visit the Investments tab to grow your money!"
    )
