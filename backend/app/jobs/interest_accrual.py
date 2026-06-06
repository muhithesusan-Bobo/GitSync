from datetime import datetime, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models.investment import Investment
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.mmf_fund import MmfFund
from app.services.sms import notify_maturity


async def run_interest_accrual():
    """Daily interest accrual — runs at 00:05 EAT (21:05 UTC)."""
    print("[INFO] Running daily interest accrual...")
    try:
        active = await Investment.find(Investment.status == "active").to_list()
        total_accrued = 0.0

        for inv in active:
            fund = await MmfFund.get(inv.fund_id)
            if not fund:
                continue

            daily_rate = fund.interest_rate / 100 / 365
            daily_interest = inv.current_value * daily_rate

            inv.accrued_interest = round(inv.accrued_interest + daily_interest, 4)
            inv.current_value = round(inv.amount + inv.accrued_interest, 4)
            inv.updated_at = datetime.utcnow()
            total_accrued += daily_interest

            # Check maturity
            if inv.matures_at and datetime.utcnow() >= inv.matures_at:
                inv.status = "matured"

            await inv.save()

        # Portfolio snapshots per user
        pipeline = [
            {"$match": {"status": {"$in": ["active", "matured"]}}},
            {"$group": {
                "_id": "$user_id",
                "invested": {"$sum": "$amount"},
                "value": {"$sum": "$current_value"},
                "returns": {"$sum": "$accrued_interest"},
            }},
        ]
        user_summaries = await Investment.aggregate(pipeline).to_list()
        today = date.today()

        for row in user_summaries:
            # Upsert snapshot for today
            existing = await PortfolioSnapshot.find_one(
                PortfolioSnapshot.user_id == row["_id"],
                PortfolioSnapshot.snapshot_date == today,
            )
            if existing:
                existing.current_value = row["value"]
                existing.total_returns = row["returns"]
                await existing.save()
            else:
                snap = PortfolioSnapshot(
                    user_id=row["_id"],
                    total_invested=row["invested"],
                    current_value=row["value"],
                    total_returns=row["returns"],
                    snapshot_date=today,
                )
                await snap.insert()

        print(f"[OK] Interest accrued: KES {total_accrued:.2f} across {len(active)} investments")
    except Exception as e:
        print(f"[ERROR] Interest accrual error: {e}")


def register_interest_accrual(scheduler: AsyncIOScheduler):
    # 21:05 UTC = 00:05 EAT
    scheduler.add_job(run_interest_accrual, "cron", hour=21, minute=5, id="interest_accrual")
    print("[SCHEDULED] Interest accrual job scheduled (daily at 00:05 EAT)")
