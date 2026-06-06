import os
import sys
import time

# Force UTF-8 output so emoji/unicode in print() work on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

# ─── Database ────────────────────────────────────────────────
from app.config.database import init_db

# ─── Routers ─────────────────────────────────────────────────
from app.routers import auth, dashboard, transactions, investments, portfolio, ai as ai_router

# ─── WebSocket ───────────────────────────────────────────────
from app.services.websocket import sio

# ─── Background Jobs ─────────────────────────────────────────
from app.jobs.interest_accrual import register_interest_accrual
from app.jobs.mmf_rate_updater import register_mmf_rate_updater
from app.jobs.auto_invest import register_auto_invest
from app.jobs.fraud_detection import register_fraud_detection

# ─── Scheduler ───────────────────────────────────────────────
scheduler = AsyncIOScheduler(timezone="UTC")

PORT = int(os.getenv("API_PORT", 8000))
NODE_ENV = os.getenv("NODE_ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS")
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")


def derive_allowed_origins(frontend_url: str) -> list[str]:
    origins = [
        frontend_url,
        "https://hazinahub.co.ke",
        "https://www.hazinahub.co.ke",
    ]
    parsed = urlparse(frontend_url)

    if parsed.hostname in {"localhost", "127.0.0.1"}:
        alternate_hostname = "127.0.0.1" if parsed.hostname == "localhost" else "localhost"
        alt_origin = f"{parsed.scheme}://{alternate_hostname}"
        if parsed.port:
            alt_origin += f":{parsed.port}"
        origins.append(alt_origin)

    return list(dict.fromkeys(origins))


# ─── Lifespan ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    register_interest_accrual(scheduler)
    register_mmf_rate_updater(scheduler)
    register_auto_invest(scheduler)
    register_fraud_detection(scheduler)
    scheduler.start()

    print(f"""
  +-----------------------------------------+
  |    HazinaHub Python API Server          |
  |    Running on port {PORT}                  |
  |    Environment: {NODE_ENV:<20}   |
  +-----------------------------------------+
    """)

    yield

    # Shutdown
    scheduler.shutdown(wait=False)


# ─── FastAPI App ─────────────────────────────────────────────
app = FastAPI(
    title="HazinaHub API",
    description="Financial platform API for Kenyan SMEs",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ────────────────────────────────────────────────────
if ALLOWED_ORIGINS:
    allowed_origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()]
else:
    allowed_origins = derive_allowed_origins(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Logging Middleware ─────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"← {request.method} {request.url}")
    response = await call_next(request)
    print(f"→ {request.method} {request.url} {response.status_code}")
    return response

# ─── Security Headers Middleware ─────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# ─── Health Check ────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "HazinaHub API",
        "version": "1.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "uptime": time.process_time(),
    }

# ─── Routers ─────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(investments.router)
app.include_router(portfolio.router)
app.include_router(ai_router.router)

# ─── 404 Handler ─────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Route not found"},
    )

# ─── Global Error Handler ─────────────────────────────────────
@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    error_msg = str(exc) if NODE_ENV != "production" else "Internal server error"
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": error_msg},
    )

# ─── Mount Socket.IO ─────────────────────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


# ─── Entry point ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:socket_app", host="0.0.0.0", port=PORT, reload=True)
