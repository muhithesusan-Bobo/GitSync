import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGODB_URI)
    return _client


async def init_db():
    """Initialize Beanie ODM with all document models."""
    from app.models.user import User
    from app.models.transaction import Transaction
    from app.models.mmf_fund import MmfFund
    from app.models.investment import Investment
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from app.models.ai_insight import AiInsight
    from app.models.fraud_alert import FraudAlert

    client = get_client()
    db_name = os.getenv("MONGODB_DB_NAME", "hazinahub")
    db = client[db_name]

    await init_beanie(
        database=db,
        document_models=[
            User,
            Transaction,
            MmfFund,
            Investment,
            PortfolioSnapshot,
            AiInsight,
            FraudAlert,
        ],
    )
    print("[OK] Connected to MongoDB and initialized Beanie ODM")
