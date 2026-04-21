# EduCore — Education Management SaaS

## Problem Statement
Build a scalable SaaS-based web platform for managing educational institutions (schools/colleges/universities) with multi-role authentication (Institute Admin, HOD, Teacher, Student, Parent), institute/department management, attendance system with analytics, student/parent/teacher/HOD dashboards, messaging, notices, hostel & mess management, library management, fee payments, PDF student list upload, AI assistant with privacy rules, real-time notifications. Plus iteration-2 additions: Super Admin (platform owner), expanded registration, two-step attendance, QR codes (profile + UPI payment), institute gallery, and fixed messaging.

## Tech Stack
- **Frontend**: React 19, React Router, Tailwind, Shadcn UI, lucide-react, sonner, axios
- **Backend**: FastAPI, Motor (MongoDB async), PyJWT, bcrypt, pdfplumber, qrcode, emergentintegrations
- **DB**: MongoDB (UUID id fields, _id excluded from responses)
- **LLM**: Claude Sonnet 4.5 via Emergent LLM key (AI Assistant)
- **Auth**: JWT (Bearer + httpOnly cookie fallback), bcrypt password hashing

## User Personas & Roles
1. **Super Admin / Platform Owner** (seeded `owner@educore.io` / `Owner@123`) — manages ALL institutes: block/unblock/delete, platform-wide stats, user search.
2. **Institute Admin** (seeded `admin@educore.io` / `Admin@123`, institute `DEMO-EDU`) — manages single institute: departments, users, fees, notices.
3. **HOD** — manages department, assigns teachers, posts notices.
4. **Teacher** — takes attendance (draft → end class → final submit), posts notices, messages.
5. **Student** — attendance/fees/marks/library/hostel view, pay fees, QR profile.
6. **Parent** — child's attendance, fees, messages teachers/HOD.

## Implemented (2026-04-20 → 2026-04-21)
- **Auth + Multi-role**: JWT Bearer + cookie; 6 roles incl. superadmin; unique ID like STU-XXXXXX issued at signup.
- **Expanded Registration**: DOB, gender, address, emergency contact; role-specific (roll_no/class/section for student; qualification/subjects/experience for teacher/HOD; designation for admin/HOD; child details for parent). Pre-fill institute_code from URL (for QR join flow).
- **Institute & Department CRUD**: Create/update/delete (admin), assign HOD (demotes previous HOD to teacher).
- **Attendance** — 2-step: start session → mark → save draft OR end class → review → final submit (irreversible). Student percentage analytics.
- **Notices** (role-scoped audience) with notifications.
- **Messaging** (fixed): Conversations list with last message + unread count + "+ New" contact picker; incoming messages marked read when thread opened.
- **Hostel & Mess**: Rooms (create/allocate), daily mess count.
- **Library**: Books CRUD, issue, return, per-student records.
- **Fees**: Create, list, mock payment + **UPI-style QR code** via `/api/qr/fee/{id}`.
- **PDF Import**: Upload student list PDF → parse via pdfplumber → auto-create student accounts (default password `Student@123`).
- **AI Assistant (Claude Sonnet 4.5)**: Answers from PUBLIC institute context only; hard-blocks private keywords (salary, password, home address, aadhaar, personal phone).
- **Gallery**: Institute-wide photo gallery with category + per-department filter; upload via URL (admin/hod/teacher).
- **QR Codes**: Profile QR (scan to verify user), Institute-Join QR (onboarding), Fee payment QR (UPI format).
- **Super Admin Console** (`/super-admin`): Platform stats, institute list with block/unblock/delete, global user search, role-protected.
- **Notifications**: Real-time via polling (12s); on attendance submission/notices/messages/fees.
- **Design**: Academic editorial theme — Playfair Display + Outfit fonts, forest-green #1A362D on warm sand #F7F5F0, no AI-slop gradients. Seeded admin + demo institute on startup.

## Next Action Items (Backlog)
- **P1**: Marks/grades module, attendance charts (Recharts), multi-day attendance view
- **P1**: Real Stripe integration for fees (playbook ready)
- **P2**: Cascading delete for super admin (messages, attendance, fees, etc.)
- **P2**: Split server.py into routers (auth/super/gallery/qr/academics)
- **P2**: WebSocket-based real-time notifications (replace polling)
- **P2**: Exam scheduling, report cards, bulk notice email
- **P3**: Parent-child auto-linking via roll_no, analytics dashboard for super admin
