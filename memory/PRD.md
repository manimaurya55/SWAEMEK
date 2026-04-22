# SWAEK — Institute Operating System

**Live URL**: https://campus-sync-15.preview.emergentagent.com

## What's Shipped (v5 Final)

### Branding
- Renamed EduCore → **SWAEK** across entire app
- New custom SVG logo (stylized "S" in forest green + terracotta accent)
- Full-screen splash animation on first load (logo bounce + wordmark reveal + tagline + underline draw, ~2s, once per session)
- `<title>SWAEK — Institute Operating System</title>`

### Auth
- Login with **email OR unique_id** (toggle on login page)
- **Forgot password** + Reset password flow (token-based, 1hr TTL, shown on screen in dev)
- Unique ID format: `SWA-{INSTCODE}-{ROLE3}-{SEQ}` (e.g., `SWA-DEMOEDU-STU-001`, `SWA-OWNER-001`)
- Expanded registration: DOB, gender, address, role-specific fields

### Institute Verification Flow
- New institute created by admin → `status: "pending"`
- Admin sees "Awaiting verification" banner; other roles cannot register yet
- Super Admin clicks **Verify** in console → status → `verified` + admin notified
- `/api/super/institutes/{id}/verify` and `/reject` endpoints

### Exam Results (NEW)
- Teachers/HOD/Admin record marks per student/subject/exam
- Auto-grading: A+ (90%+), A (80%+), B (70%+), C (60%+), D (40%+), F
- HOD/Admin bulk-publish → students notified; students see in own Results tab
- Public endpoint `/api/results/public/{code}/{exam}` (leaderboard by roll no, no PII)

### 6-Role System with Full Modules
Super Admin, Institute Admin, HOD, Teacher, Student, Parent — each with scoped dashboards for:
Attendance (draft→end→submit), Results (draft→publish), Notices, Messages (conversations + unread), Hostel/Mess, Library, Fees (+ UPI QR), Gallery, PDF Import, AI Assistant (Claude Sonnet 4.5), Departments, QR Codes (profile/join/fee), Notifications.

### Monetization
- Free ($0) / Pro ($49/mo) / Enterprise ($299/mo) via Stripe Checkout
- **AI Credit Packs** $9 = 500 queries (one-time top-up)
- Server-side price enforcement, webhook handler, polling status page
- Super Admin revenue console: MRR, ARR, conversion, lifetime revenue, plan mix, transactions

### Other P1/P2 fixes
- `/ai/ask` now returns HTTP 503 on upstream errors (was 200)
- Graceful retry for Stripe session propagation
- Institute `status` default → `verified` on seed for DEMO-EDU

## Seeded Demo Credentials
- **Platform Owner**: `owner@educore.io` / `Owner@123` (unique_id: `SWA-OWNER-001`)
- **Institute Admin**: `admin@educore.io` / `Admin@123` (unique_id: `SWA-DEMOEDU-ADM-001`)
- **Demo Institute**: `SWAEK Demo Institute` (code: `DEMO-EDU`, status: verified)

## Tech Stack (As Delivered)
React 19 (CRA) + FastAPI + MongoDB + Tailwind + shadcn/ui + Claude Sonnet 4.5 (emergentintegrations) + Stripe (test keys) + pdfplumber + qrcode.

## Next Step (Recommended)
Push to GitHub from Emergent (profile → Connect GitHub → "Save to GitHub") before starting the Next.js rebuild so this version is safely backed up.
