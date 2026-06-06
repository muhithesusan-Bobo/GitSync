from datetime import datetime, date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models.user import User
from app.models.transaction import Transaction
from app.models.investment import Investment
from app.models.mmf_fund import MmfFund


async def run_auto_invest():
    """Auto-invest job — runs daily at 01:00 EAT (22:00 UTC)."""
    print("[INFO] Running auto-invest...")
    try:
        users = await User.find(
            User.auto_invest_enabled == True,
            User.auto_invest_percentage > 0,
        ).to_list()

        processed = 0
        for user in users:
            if not user.auto_invest_fund_id:
                continue

            # Today's profit (incoming transactions since midnight UTC)
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            pipeline = [
                {"$match": {
                    "user_id": user.id,
                    "type": {"$in": ["c2b", "stk_push"]},
                    "status": "completed",
                    "created_at": {"$gte": today_start},
                }},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
            ]
            result = await Transaction.aggregate(pipeline).to_list()
            today_profit = result[0]["total"] if result else 0.0

            if today_profit <= 0:
                continue

            invest_amount = int(today_profit * (user.auto_invest_percentage / 100))
            if invest_amount < 1000:
                continue

            if user.wallet_balance < invest_amount:
                print(f"  [WARN] Insufficient wallet balance for user {user.id} (Needed: KES {invest_amount:,}, Available: KES {user.wallet_balance:,})")
                continue

            try:
                from beanie import PydanticObjectId
                fund = await MmfFund.get(PydanticObjectId(user.auto_invest_fund_id))
                if not fund:
                    continue

                # Deduct from user's wallet balance
                user.wallet_balance -= invest_amount
                await user.save()

                # Record completed transaction
                tx = Transaction(
                    user_id=user.id,
                    type="investment",
                    amount=invest_amount,
                    phone=user.phone,
                    status="completed",
                    description=f"Auto-invest in {fund.name}",
                    balance_after=user.wallet_balance,
                )
                await tx.insert()

                matures_at = None
                if fund.maturity_days > 0:
                    matures_at = datetime.utcnow() + timedelta(days=fund.maturity_days)

                inv = Investment(
                    user_id=user.id,
                    fund_id=fund.id,
                    amount=invest_amount,
                    current_value=invest_amount,
                    status="active",
                    invested_at=datetime.utcnow(),
                    matures_at=matures_at,
                    transaction_id=tx.id,
                )
                await inv.insert()

                print(f"  [OK] Auto-invested KES {invest_amount:,} for user {user.id} directly from wallet balance.")
                processed += 1
            except Exception as e:
                print(f"  [ERROR] Auto-invest failed for user {user.id}: {e}")

        print(f"[OK] Auto-invest completed for {processed} users")
    except Exception as e:
        print(f"[ERROR] Auto-invest job error: {e}")


def register_auto_invest(scheduler: AsyncIOScheduler):
    # 22:00 UTC = 01:00 EAT
    scheduler.add_job(run_auto_invest, "cron", hour=22, minute=0, id="auto_invest")
    print("[SCHEDULED] Auto-invest job scheduled (daily at 01:00 EAT)")

