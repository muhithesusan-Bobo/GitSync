# HazinaHub Python Backend

FastAPI backend for HazinaHub — a financial platform for Kenyan SMEs.

## Stack
- **FastAPI** — async web framework
- **MongoDB** (Motor + Beanie ODM) — primary database
- **python-jose** — JWT authentication
- **argon2-cffi** — password hashing (argon2id)
- **google-genai** — Gemini AI integration
- **TalkSasa** — SMS notifications
- **python-socketio** — real-time WebSocket
- **APScheduler** — cron background jobs

## Setup

### 1. Create virtual environment
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Run the server
```bash
uvicorn app.main:app --reload --port 5000
```

### 5. API Docs
Visit `http://localhost:5000/docs` for the auto-generated Swagger UI.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/profile` | Get profile |
| GET | `/api/dashboard` | Dashboard summary |
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions/pay` | Initiate M-Pesa STK push |
| POST | `/api/transactions/withdraw` | Withdraw to M-Pesa |
| GET | `/api/investments/funds` | List MMF funds |
| POST | `/api/investments/invest` | Invest in a fund |
| GET | `/api/investments` | My investments |
| GET | `/api/portfolio` | Portfolio summary |
| POST | `/api/ai/chat` | Chat with Hazina AI |
| GET | `/api/ai/health-score` | Financial health score |
