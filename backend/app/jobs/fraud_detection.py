from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models.transaction import Transaction
from app.models.fraud_alert import FraudAlert
from app.models.user import User
from app.services.sms import notify_fraud_alert


async def run_fraud_detection():
    """Fraud detection — runs every 30 minutes."""
    try:
        now = datetime.utcnow()
        one_hour_ago = now - timedelta(hours=1)
        thirty_min_ago = now - timedelta(minutes=30)
        five_min_ago = now - timedelta(minutes=5)

        # ── Pattern 1: Multiple failed transactions in 1 hour ────────
        pipeline_failed = [
            {"$match": {"status": "failed", "created_at": {"$gte": one_hour_ago}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "phone": {"$last": "$phone"}}},
            {"$match": {"count": {"$gte": 5}}},
        ]
        failed_alerts = await Transaction.aggregate(pipeline_failed).to_list()
        for alert in failed_alerts:
            two_hrs_ago = now - timedelta(hours=2)
            existing = await FraudAlert.find_one(
                FraudAlert.user_id == alert["_id"],
                FraudAlert.alert_type == "multiple_failures",
                FraudAlert.created_at >= two_hrs_ago,
            )
            if not existing:
                await FraudAlert(
                    user_id=alert["_id"],
                    alert_type="multiple_failures",
                    severity="high",
                    description=f"{alert['count']} failed transactions in the last hour",
                ).insert()
                if alert.get("phone"):
                    try:
                        await notify_fraud_alert(
                            alert["phone"],
                            "Multiple failed transactions detected on your account",
                        )
                    except Exception:
                        pass

        # ── Pattern 2: Unusually large transaction (5× avg) ──────────
        recent_txs = await Transaction.find(
            Transaction.created_at >= thirty_min_ago,
        ).to_list()

        for tx in recent_txs:
            # Calculate this user's avg
            pipeline_avg = [
                {"$match": {"user_id": tx.user_id, "status": "completed"}},
                {"$group": {"_id": None, "avg": {"$avg": "$amount"}}},
            ]
            avg_result = await Transaction.aggregate(pipeline_avg).to_list()
            user_avg = avg_result[0]["avg"] if avg_result else 100000

            if tx.amount > user_avg * 5:
                existing = await FraudAlert.find_one(
                    FraudAlert.transaction_id == tx.id,
                )
                if not existing:
                    await FraudAlert(
                        user_id=tx.user_id,
                        transaction_id=tx.id,
                        alert_type="large_transaction",
                        severity="medium",
                        description=f"Unusually large transaction of KES {tx.amount:,.0f}",
                    ).insert()

        # ── Pattern 3: Rapid successive transactions (≥10 in 5 min) ─
        pipeline_rapid = [
            {"$match": {"created_at": {"$gte": five_min_ago}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "phone": {"$last": "$phone"}}},
            {"$match": {"count": {"$gte": 10}}},
        ]
        rapid_alerts = await Transaction.aggregate(pipeline_rapid).to_list()
        for alert in rapid_alerts:
            existing = await FraudAlert.find_one(
                FraudAlert.user_id == alert["_id"],
                FraudAlert.alert_type == "rapid_transactions",
                FraudAlert.created_at >= thirty_min_ago,
            )
            if not existing:
                await FraudAlert(
                    user_id=alert["_id"],
                    alert_type="rapid_transactions",
                    severity="critical",
                    description=f"{alert['count']} transactions in 5 minutes — possible automated attack",
                ).insert()
                if alert.get("phone"):
                    try:
                        await notify_fraud_alert(
                            alert["phone"],
                            "Unusual rapid transactions detected",
                        )
                    except Exception:
                        pass

    except Exception as e:
        print(f"Fraud detection error: {e}")


def register_fraud_detection(scheduler: AsyncIOScheduler):
    scheduler.add_job(run_fraud_detection, "interval", minutes=30, id="fraud_detection")
    print("[SCHEDULED] Fraud detection job scheduled (every 30 minutes)")
