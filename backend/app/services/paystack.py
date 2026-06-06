"""
Paystack payment service — replaces M-Pesa Daraja.

Key Paystack concepts:
  - Amounts are in the SMALLEST currency unit (kobo for NGN, cents for KES).
    1 KES = 100 units, so KES 100 → 10000 units.
  - Payment flow:
      1. initialize_transaction()  → returns authorization_url + reference
      2. User pays on the Paystack checkout page
      3. Paystack sends a webhook to POST /api/transactions/webhook
      4. Verify the webhook signature with HMAC-SHA512
  - Transfers (B2C equivalent):
      1. create_transfer_recipient() → returns recipient_code
      2. initiate_transfer()         → sends money to the recipient
"""

import hashlib
import hmac
import uuid
import httpx

from app.config.paystack import paystack_config

# ─── Helpers ─────────────────────────────────────────────────

def _to_kobo(amount_kes: float) -> int:
    """Convert KES float to Paystack integer units (×100)."""
    return int(round(amount_kes * 100))


def _generate_reference() -> str:
    return f"HZN-{uuid.uuid4().hex[:12].upper()}"


# ─── Transactions ─────────────────────────────────────────────

async def initialize_transaction(
    email: str,
    amount: float,
    reference: str | None = None,
    metadata: dict | None = None,
    callback_url: str | None = None,
) -> dict:
    """
    Initialize a Paystack transaction.

    Returns:
        {
          "authorization_url": "https://checkout.paystack.com/...",
          "access_code": "...",
          "reference": "HZN-XXXXXXXXXXXX"
        }
    """
    ref = reference or _generate_reference()
    payload: dict = {
        "email": email,
        "amount": _to_kobo(amount),
        "currency": paystack_config.currency,
        "reference": ref,
        "callback_url": callback_url or paystack_config.callback_url,
    }
    if metadata:
        payload["metadata"] = metadata

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            paystack_config.initialize_url,
            json=payload,
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(f"Paystack initialization failed: {data.get('message')}")

    return data["data"]  # authorization_url, access_code, reference


async def charge_mpesa(
    email: str,
    amount: float,
    phone: str,
    reference: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """
    Initiate a direct M-Pesa STK Push via Paystack.
    Phone must be formatted with country code (e.g. +2547XXXXXXXX or 2547XXXXXXXX).
    """
    ref = reference or _generate_reference()
    
    # Ensure phone has + for Paystack API compatibility
    formatted_phone = phone
    if not formatted_phone.startswith("+"):
        formatted_phone = "+" + formatted_phone

    payload = {
        "email": email,
        "amount": _to_kobo(amount),
        "currency": paystack_config.currency,
        "reference": ref,
        "mobile_money": {
            "phone": formatted_phone,
            "provider": "mpesa"
        }
    }
    if metadata:
        payload["metadata"] = metadata

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            paystack_config.charge_url,
            json=payload,
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(f"Paystack charge failed: {data.get('message')}")

    return data["data"]


async def verify_transaction(reference: str) -> dict:
    """
    Verify a Paystack transaction by reference.

    Returns the full transaction object from Paystack.
    Raises RuntimeError if the transaction was not successful.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{paystack_config.verify_url}/{reference}",
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(f"Paystack verification failed: {data.get('message')}")

    tx_data = data["data"]
    if tx_data.get("status") != "success":
        raise RuntimeError(f"Transaction not successful. Status: {tx_data.get('status')}")

    return tx_data


def verify_webhook_signature(payload_bytes: bytes, paystack_signature: str) -> bool:
    """
    Verify that a Paystack webhook request is genuine.
    Uses HMAC-SHA512 with the webhook secret.
    If no webhook secret is configured, validation is bypassed.
    """
    if not paystack_config.webhook_secret:
        return True
    secret = paystack_config.webhook_secret.encode("utf-8")
    computed = hmac.new(secret, payload_bytes, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed, paystack_signature)



async def get_balance() -> dict:
    """Fetch the Paystack account balance."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            paystack_config.balance_url,
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()
    return data.get("data", {})


# ─── Transfers (B2C / Withdrawals) ───────────────────────────

async def create_transfer_recipient(
    name: str,
    account_number: str,
    bank_code: str = "MPESA",
    currency: str = "KES",
) -> str:
    """
    Create a Paystack transfer recipient.
    For M-Pesa payouts, use bank_code='MPESA' and account_number=phone (254XXXXXXXXX).

    Returns:
        recipient_code (str) — used in initiate_transfer()
    """
    payload = {
        "type": "mobile_money",
        "name": name,
        "account_number": account_number,
        "bank_code": bank_code,
        "currency": currency,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            paystack_config.transfer_recipient_url,
            json=payload,
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(f"Failed to create transfer recipient: {data.get('message')}")

    return data["data"]["recipient_code"]


async def initiate_transfer(
    amount: float,
    recipient_code: str,
    reason: str = "HazinaHub Withdrawal",
    reference: str | None = None,
) -> dict:
    """
    Initiate a Paystack transfer (payout) to a recipient.

    Returns Paystack transfer response dict.
    """
    payload = {
        "source": "balance",
        "amount": _to_kobo(amount),
        "recipient": recipient_code,
        "reason": reason,
        "currency": paystack_config.currency,
        "reference": reference or _generate_reference(),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            paystack_config.transfer_url,
            json=payload,
            headers=paystack_config.auth_headers(),
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(f"Transfer failed: {data.get('message')}")

    return data["data"]


async def payout_to_phone(
    phone: str,
    name: str,
    amount: float,
    reason: str = "HazinaHub Withdrawal",
    reference: str | None = None,
) -> dict:
    """
    Convenience: create recipient for a Kenyan phone number, then initiate transfer.
    phone should be in format 254XXXXXXXXX.
    """
    recipient_code = await create_transfer_recipient(
        name=name,
        account_number=phone,
        bank_code="MPESA",
        currency="KES",
    )
    return await initiate_transfer(
        amount=amount,
        recipient_code=recipient_code,
        reason=reason,
        reference=reference,
    )


async def check_account_balance() -> float:
    """Fetch Paystack account balance and broadcast it."""
    try:
        from app.services.websocket import broadcast_balance_update
        balance_data = await get_balance()
        kes_balance = 0.0
        if isinstance(balance_data, list):
            for item in balance_data:
                if item.get("currency") == paystack_config.currency:
                    kes_balance = item.get("balance", 0) / 100.0
                    break
        elif isinstance(balance_data, dict):
            kes_balance = balance_data.get("balance", 0) / 100.0
        
        await broadcast_balance_update(kes_balance)
        return kes_balance
    except Exception as e:
        print(f"⚠️ Failed to check Paystack account balance: {e}")
        return 0.0


