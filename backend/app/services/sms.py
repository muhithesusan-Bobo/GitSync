import os
import httpx

TALKSASA_API_KEY = os.getenv("TALKSASA_API_KEY", "")
TALKSASA_SENDER_ID = os.getenv("TALKSASA_SENDER_ID", "HazinaHub")
TALKSASA_API_URL = os.getenv("TALKSASA_API_URL", "https://api.talksasa.com/sms/send")


async def send_sms(phone: str, message: str) -> bool:
    """Send SMS via TalkSasa gateway."""
    try:
        payload = {
            "api_key": TALKSASA_API_KEY,
            "to": phone,
            "message": f"[HazinaHub] {message}",
            "from": TALKSASA_SENDER_ID,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(TALKSASA_API_URL, json=payload)
            data = response.json()
            return data.get("status") == "success" or response.status_code == 200
    except Exception as e:
        print(f"SMS send error: {e}")
        return False


async def notify_transaction(phone: str, amount: float, tx_type: str) -> None:
    """Notify user of a completed transaction."""
    if tx_type == "c2b":
        message = (
            f"Payment of KES {amount:,.0f} received successfully. "
            "Thank you for using HazinaHub."
        )
    else:
        message = (
            f"Investment of KES {amount:,.0f} initiated via STK Push. "
            "Check your phone to complete."
        )
    await send_sms(phone, message)


async def notify_maturity(phone: str, fund_name: str, amount: float) -> None:
    """Notify user that an investment has matured."""
    message = (
        f"Your investment in {fund_name} worth KES {amount:,.0f} has matured. "
        "Log in to HazinaHub to withdraw or reinvest."
    )
    await send_sms(phone, message)


async def notify_fraud_alert(phone: str, description: str) -> None:
    """Send a fraud/security alert SMS."""
    message = f"⚠️ Security Alert: {description}. If this wasn't you, contact support immediately."
    await send_sms(phone, message)
