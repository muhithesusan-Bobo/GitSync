import os
from dotenv import load_dotenv

load_dotenv()


class PaystackConfig:
    secret_key: str = os.getenv("PAYSTACK_SECRET_KEY", "")
    public_key: str = os.getenv("PAYSTACK_PUBLIC_KEY", "")
    webhook_secret: str = os.getenv("PAYSTACK_WEBHOOK_SECRET", "")
    callback_url: str = os.getenv("PAYSTACK_CALLBACK_URL", "")
    currency: str = os.getenv("PAYSTACK_CURRENCY", "KES")

    # Paystack base URL
    base_url: str = "https://api.paystack.co"

    @property
    def initialize_url(self) -> str:
        return f"{self.base_url}/transaction/initialize"

    @property
    def verify_url(self) -> str:
        return f"{self.base_url}/transaction/verify"

    @property
    def charge_url(self) -> str:
        return f"{self.base_url}/charge"

    @property
    def transfer_recipient_url(self) -> str:
        return f"{self.base_url}/transferrecipient"

    @property
    def transfer_url(self) -> str:
        return f"{self.base_url}/transfer"

    @property
    def transfer_finalize_url(self) -> str:
        return f"{self.base_url}/transfer/finalize_transfer"

    @property
    def balance_url(self) -> str:
        return f"{self.base_url}/balance"

    def auth_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }


paystack_config = PaystackConfig()
