import random
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models.mmf_fund import MmfFund


async def run_mmf_rate_updater():
    """Simulate MMF rate fluctuations every 6 hours."""
    print("[INFO] Updating MMF rates...")
    try:
        funds = await MmfFund.find(MmfFund.is_active == True).to_list()
        for fund in funds:
            fluctuation = (random.random() - 0.5) * 0.2
            new_rate = max(5.0, min(25.0, fund.interest_rate + fluctuation))
            fund.interest_rate = round(new_rate, 3)
            fund.updated_at = datetime.utcnow()
            await fund.save()
        print(f"[OK] Updated rates for {len(funds)} MMFs in MongoDB")
    except Exception as e:
        print(f"[ERROR] MMF rate update error: {e}")


def register_mmf_rate_updater(scheduler: AsyncIOScheduler):
    scheduler.add_job(run_mmf_rate_updater, "cron", hour="*/6", id="mmf_rate_updater")
    print("[SCHEDULED] MMF rate updater scheduled (every 6 hours)")
