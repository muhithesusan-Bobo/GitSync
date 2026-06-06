import os
import socketio
from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "default_secret")

# ─── Socket.IO async server ──────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=os.getenv("FRONTEND_URL", "http://localhost:5173"),
)


# ─── Auth middleware ─────────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        raise ConnectionRefusedError("Authentication error: Token required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("userId")
        await sio.save_session(sid, {"user_id": user_id})
        await sio.enter_room(sid, user_id)
        print(f"[WS] WebSocket connected: User {user_id} [{sid}]")
    except JWTError:
        raise ConnectionRefusedError("Authentication error: Invalid token")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    user_id = session.get("user_id", "unknown")
    print(f"[WS] WebSocket disconnected: User {user_id} [{sid}]")


# ─── Broadcast helpers ───────────────────────────────────────
async def broadcast_transaction_update(user_id: str, transaction: dict) -> None:
    """Emit transaction_update to the specific user's room."""
    await sio.emit("transaction_update", transaction, room=user_id)


async def broadcast_balance_update(balance: float) -> None:
    """Broadcast balance_update to all connected clients."""
    await sio.emit("balance_update", {"balance": balance})
