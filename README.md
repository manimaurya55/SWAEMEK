# SWAEK — Institute Operating System

Multi-tenant SaaS platform for educational institutions with 6 roles, 14+ modules, AI assistant, Stripe billing, exam results publishing, and real-time notifications.

**Live demo**: https://campus-sync-15.preview.emergentagent.com

---

## 🛠️ Tech Stack
- **Frontend**: React 19 (CRA), React Router, Tailwind CSS, shadcn/ui, Axios, Sonner, Lucide React
- **Backend**: FastAPI (Python), Uvicorn, Motor (async MongoDB), PyJWT, bcrypt, Pydantic
- **Database**: MongoDB
- **Integrations**: Claude Sonnet 4.5 (Anthropic), Stripe Checkout, pdfplumber, qrcode

---

## 📋 Prerequisites

Install these on your machine:

1. **Python 3.11+** — [download](https://www.python.org/downloads/)
2. **Node.js 18+** — [download](https://nodejs.org/)
3. **Yarn** (NOT npm) — `npm install -g yarn`
4. **MongoDB** — Install locally OR use free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
5. **VS Code** — [download](https://code.visualstudio.com/)

---

## 🚀 Local Setup (VS Code)

### Step 1: Open the project in VS Code
```bash
# Extract the zip first, then:
cd swaek
code .
```

### Step 2: Setup Backend

Open a terminal in VS Code (`` Ctrl + ` ``) and run:

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill values
cp .env.example .env
# Now edit backend/.env — see "Environment Variables" section below
```

### Step 3: Setup Frontend

Open a **NEW** terminal (keep backend terminal separate):

```bash
cd frontend

# Install dependencies (use yarn, NOT npm)
yarn install

# Copy env template
cp .env.example .env
# Edit frontend/.env — set REACT_APP_BACKEND_URL=http://localhost:8001
```

### Step 4: Start MongoDB
- If local: `mongod` (usually runs on port 27017)
- If Atlas: copy connection string into `backend/.env`

### Step 5: Run the app

**Terminal 1 (backend)** — from `backend/` folder:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 (frontend)** — from `frontend/` folder:
```bash
yarn start
```

Open browser: **http://localhost:3000**

---

## 🔐 Environment Variables

### `backend/.env`
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=swaek

JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_hex(32))">

ADMIN_EMAIL=admin@swaek.io
ADMIN_PASSWORD=Admin@123
SUPERADMIN_EMAIL=owner@swaek.io
SUPERADMIN_PASSWORD=Owner@123

# LLM (Claude) — get from https://console.anthropic.com
# OR use Emergent LLM key if you have one
EMERGENT_LLM_KEY=your-key-here

# Stripe test keys — https://dashboard.stripe.com/test/apikeys
STRIPE_API_KEY=sk_test_your_stripe_test_key

# Public URL (for QR codes to work)
FRONTEND_PUBLIC_URL=http://localhost:3000
```

### `frontend/.env`
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 🎯 Default Login Credentials (Seeded on First Run)

- **Platform Owner (Super Admin)**:
  - Email: `owner@swaek.io` (or whatever you set in `SUPERADMIN_EMAIL`)
  - Password: `Owner@123`
  - Unique ID: `SWA-OWNER-001`

- **Institute Admin** (for demo institute `DEMO-EDU`):
  - Email: `admin@swaek.io`
  - Password: `Admin@123`
  - Unique ID: `SWA-DEMOEDU-ADM-001`

---

## 📁 Project Structure

```
swaek/
├── backend/
│   ├── server.py              # Single FastAPI app — ALL endpoints
│   ├── requirements.txt
│   ├── .env.example
│   └── venv/                  # Your virtualenv (created locally)
├── frontend/
│   ├── src/
│   │   ├── App.js             # Routes
│   │   ├── index.js
│   │   ├── index.css          # Tailwind + brand tokens
│   │   ├── pages/             # Landing, Login, Register, Dashboard, SuperAdmin, Pricing, etc.
│   │   ├── components/
│   │   │   ├── Logo.jsx
│   │   │   ├── SplashScreen.jsx
│   │   │   ├── dashboard/     # All feature panels
│   │   │   └── ui/            # shadcn components
│   │   ├── contexts/          # AuthContext
│   │   └── lib/               # axios api client
│   ├── public/
│   ├── package.json
│   └── .env.example
└── README.md                  # This file
```

---

## 🐛 Common Issues

### "MongoDB connection failed"
- Check if MongoDB is running: `mongosh` (should connect)
- If using Atlas, whitelist your IP in Atlas dashboard
- Verify `MONGO_URL` in `backend/.env`

### "Module not found" in backend
- Make sure venv is activated (`(venv)` prefix in terminal)
- Re-run `pip install -r requirements.txt`

### "yarn: command not found"
- Install yarn globally: `npm install -g yarn`
- **Do NOT use `npm install`** — it breaks the lockfile

### Port already in use
- Backend port 8001: `lsof -i :8001` → `kill <PID>`
- Frontend port 3000: will auto-suggest another port (say yes)

### AI Assistant not working
- You need an Anthropic API key OR Emergent LLM key in `EMERGENT_LLM_KEY`
- Without it, `/api/ai/ask` will return 503

### Stripe checkout fails
- Test keys required: https://dashboard.stripe.com/test/apikeys
- Use `sk_test_...` key (NOT production key)

---

## 🚢 Deployment (Optional)

### Frontend → Vercel / Netlify
```bash
cd frontend
yarn build
# Upload /build folder OR connect GitHub repo
```
Set env var `REACT_APP_BACKEND_URL=<your-backend-url>` in hosting platform.

### Backend → Railway / Render
- Create new project from GitHub
- Set start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Add all `backend/.env` variables

### Database → MongoDB Atlas
- Free tier: https://cloud.mongodb.com
- Whitelist `0.0.0.0/0` for hosted backends
- Update `MONGO_URL` in backend env

---

## 📦 Features Shipped

✅ 6-role authentication with JWT (email or unique_id login)
✅ Institute verification flow (pending → verified by super admin)
✅ Departments with HOD assignment
✅ Two-step attendance (save → end → submit)
✅ Exam results (draft → publish → public leaderboard)
✅ Notices, Messaging (conversations + unread)
✅ Hostel & Mess, Library, Fees (+ UPI QR code payment)
✅ Gallery with department filter
✅ PDF student list import
✅ AI Assistant (Claude Sonnet 4.5, privacy-filtered)
✅ QR codes (profile, institute-join, fee payment)
✅ Stripe billing (Free/Pro/Enterprise + AI credit packs)
✅ Super Admin console (verification, revenue analytics, blocks)
✅ Forgot password + reset flow
✅ Splash animation + custom SVG logo

---

## 🆘 Support

- All code is in two files essentially:
  - `backend/server.py` — every API endpoint
  - `frontend/src/App.js` + `pages/` + `components/`
- Read the inline comments — it's well-documented
- Each module is self-contained in its own file under `components/dashboard/`

Good luck! 🚀
