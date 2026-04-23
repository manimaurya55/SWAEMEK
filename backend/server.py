from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import secrets
import bcrypt
import jwt as pyjwt
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

import pdfplumber
import qrcode
import base64
import json

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

# ============ DB ============
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ============ App ============
app = FastAPI(title="EduCore API")
api = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
ROLES = ("superadmin", "admin", "hod", "teacher", "student", "parent", "hostel_staff")
Role = Literal["superadmin", "admin", "hod", "teacher", "student", "parent", "hostel_staff"]


# ============ Utils ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str, minutes: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        "type": "access",
    }
    return pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGO)


def uid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGO])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_roles(*allowed: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(403, f"Requires role: {allowed}")
        return user
    return dep


# ============ Models ============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    institute_code: Optional[str] = None  # empty for admin creating new institute
    institute_name: Optional[str] = None  # required only when role==admin & no institute_code
    department_id: Optional[str] = None
    phone: Optional[str] = None
    extra: Optional[dict] = None  # parent: child_roll_no
    # Expanded profile fields
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    # Student fields
    roll_no: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    # Teacher / HOD fields
    qualification: Optional[str] = None
    subjects: Optional[List[str]] = None
    experience_years: Optional[int] = None
    designation: Optional[str] = None
    # Parent fields
    child_roll_no: Optional[str] = None
    child_name: Optional[str] = None


class LoginIn(BaseModel):
    email: Optional[EmailStr] = None
    unique_id: Optional[str] = None
    password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class ExamResultIn(BaseModel):
    student_id: str
    subject: str
    exam_name: str  # e.g., "Mid-term", "Final"
    term: Optional[str] = None
    marks: float
    total_marks: float = 100
    grade: Optional[str] = None
    remarks: Optional[str] = None


class BulkPublishIn(BaseModel):
    result_ids: List[str]
    publish: bool = True


class DepartmentIn(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class DepartmentUpdateIn(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None


class NoticeIn(BaseModel):
    title: str
    body: str
    audience: Literal["all", "teachers", "students", "parents", "hods"] = "all"


class MessageIn(BaseModel):
    to_user_id: str
    body: str


class AttendanceSessionIn(BaseModel):
    department_id: str
    class_name: str  # e.g. "CS-Sem-3"
    subject: str


class AttendanceMarkIn(BaseModel):
    session_id: str
    entries: List[dict]  # [{student_id, present: bool}]


class AttendanceSaveIn(BaseModel):
    session_id: str
    entries: List[dict]
    end_class: bool = False


class RoomIn(BaseModel):
    room_number: str
    capacity: int = 2
    block: Optional[str] = "A"


class AllocateIn(BaseModel):
    room_id: str
    student_id: str


class BookIn(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    copies: int = 1


class IssueBookIn(BaseModel):
    book_id: str
    student_id: str


class FeeIn(BaseModel):
    student_id: str
    amount: float
    description: str
    due_date: Optional[str] = None


class AIAskIn(BaseModel):
    question: str
    session_id: Optional[str] = None


class GalleryIn(BaseModel):
    title: str
    image_url: str
    caption: Optional[str] = None
    category: Optional[str] = "general"  # general, events, sports, department
    department_id: Optional[str] = None


# ============ SUBSCRIPTION PLANS (server-side defined) ============
PLANS = {
    "free": {"name": "Free", "amount": 0.00, "currency": "usd", "interval": "month",
             "limits": {"users": 50, "ai_queries": 20, "departments": 3}, "features": ["Basic modules", "50 users", "20 AI queries/mo"]},
    "pro": {"name": "Pro", "amount": 49.00, "currency": "usd", "interval": "month",
            "limits": {"users": 2000, "ai_queries": 2000, "departments": 50}, "features": ["All modules", "2,000 users", "2,000 AI queries/mo", "Priority support"]},
    "enterprise": {"name": "Enterprise", "amount": 299.00, "currency": "usd", "interval": "month",
                   "limits": {"users": 999999, "ai_queries": 999999, "departments": 999}, "features": ["Unlimited users", "Unlimited AI", "Dedicated success manager", "Custom SLA"]},
}


class CheckoutIn(BaseModel):
    plan_id: str  # "pro" or "enterprise"
    origin_url: str


# Credit pack (one-time purchase to top up AI queries)
CREDIT_PACK = {"id": "ai_pack_500", "name": "AI Pack · 500 queries", "credits": 500, "amount": 9.00, "currency": "usd"}


class CreditPackCheckoutIn(BaseModel):
    origin_url: str


# ============ Helpers ============
def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id")}


async def create_notification(user_ids: List[str], title: str, body: str, kind: str = "info"):
    docs = [
        {"id": uid(), "user_id": u, "title": title, "body": body, "kind": kind, "read": False, "created_at": now_iso()}
        for u in user_ids
    ]
    if docs:
        await db.notifications.insert_many(docs)


def make_qr_base64(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def next_unique_id(institute_code: str, role: str) -> str:
    """Generate sequential unique ID like SWA-{INSTCODE}-{ROLE3}-{seq}"""
    code = (institute_code or "XXX").replace("-", "").upper()[:8]
    role3 = role.upper()[:3]
    count = await db.users.count_documents({"unique_id": {"$regex": f"^SWM-{code}-{role3}-"}})
    return f"SWM-{code}-{role3}-{str(count + 1).zfill(3)}"


# ============ AUTH ============
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    # Superadmin registration is blocked publicly (seeded only)
    if data.role == "superadmin":
        raise HTTPException(403, "Superadmin cannot self-register")

    # handle institute
    institute_id = None
    institute_code_resolved = None
    if data.role == "admin":
        if data.institute_code:
            inst = await db.institutes.find_one({"code": data.institute_code}, {"_id": 0})
            if not inst:
                raise HTTPException(400, "Institute not found")
            if inst.get("status") == "pending":
                raise HTTPException(403, "This institute is pending verification by platform owner.")
            if inst.get("blocked"):
                raise HTTPException(403, "Institute is blocked.")
            institute_id = inst["id"]
            institute_code_resolved = inst["code"]
        else:
            if not data.institute_name:
                raise HTTPException(400, "institute_name required to create institute")
            institute_id = uid()
            code = "INS-" + institute_id[:6].upper()
            await db.institutes.insert_one({
                "id": institute_id, "name": data.institute_name, "code": code,
                "admin_id": None, "blocked": False, "status": "pending",
                "created_at": now_iso(),
            })
            institute_code_resolved = code
    else:
        if not data.institute_code:
            raise HTTPException(400, "institute_code is required")
        inst = await db.institutes.find_one({"code": data.institute_code}, {"_id": 0})
        if not inst:
            raise HTTPException(400, "Invalid institute code")
        if inst.get("status") != "verified":
            raise HTTPException(403, "This institute is not yet verified by platform. Please try later.")
        if inst.get("blocked"):
            raise HTTPException(403, "Institute is blocked. Contact platform support.")
        institute_id = inst["id"]
        institute_code_resolved = inst["code"]

    user_id = uid()
    unique_id = await next_unique_id(institute_code_resolved, data.role)
    profile = {
        "date_of_birth": data.date_of_birth, "gender": data.gender,
        "address": data.address, "emergency_contact": data.emergency_contact,
        "roll_no": data.roll_no, "class_name": data.class_name, "section": data.section,
        "qualification": data.qualification, "subjects": data.subjects,
        "experience_years": data.experience_years, "designation": data.designation,
        "child_roll_no": data.child_roll_no, "child_name": data.child_name,
    }
    profile = {k: v for k, v in profile.items() if v is not None}
    doc = {
        "id": user_id,
        "unique_id": unique_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "institute_id": institute_id,
        "department_id": data.department_id,
        "phone": data.phone,
        "profile": profile,
        "extra": data.extra or {},
        "verified": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)

    if data.role == "admin":
        await db.institutes.update_one({"id": institute_id}, {"$set": {"admin_id": user_id}})

    token = create_token(user_id, data.role)
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user, "token": token}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    if not data.email and not data.unique_id:
        raise HTTPException(400, "Provide email or unique_id")
    query = {}
    if data.email:
        query["email"] = data.email.lower()
    else:
        query["unique_id"] = data.unique_id.strip().upper()
    user = await db.users.find_one(query)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")
    return {"user": public_user(user), "token": token}


@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        # don't reveal existence
        return {"ok": True, "message": "If the email exists, a reset token will be generated."}
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "id": uid(), "token": token, "user_id": user["id"], "email": user["email"],
        "used": False, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "created_at": now_iso(),
    })
    # In dev, return token directly (no email service configured)
    logger.info(f"Password reset token for {user['email']}: {token}")
    return {"ok": True, "token": token, "message": "Use this token to reset password (dev-only response; in production this would be emailed)."}


@api.post("/auth/reset-password")
async def reset_password(data: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": data.token})
    if not rec or rec.get("used"):
        raise HTTPException(400, "Invalid or already used token")
    expires_at = rec.get("expires_at")
    if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expired")
    if len(data.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True, "used_at": now_iso()}})
    return {"ok": True}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ============ INSTITUTES ============
@api.get("/institutes/by-code/{code}")
async def get_institute_by_code(code: str):
    inst = await db.institutes.find_one({"code": code}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Not found")
    return inst


@api.get("/institute")
async def my_institute(user: dict = Depends(get_current_user)):
    inst = await db.institutes.find_one({"id": user["institute_id"]}, {"_id": 0})
    return inst


@api.get("/institute/stats")
async def institute_stats(user: dict = Depends(get_current_user)):
    iid = user["institute_id"]
    stats = {}
    for r in ROLES:
        stats[r + "s"] = await db.users.count_documents({"institute_id": iid, "role": r})
    stats["departments"] = await db.departments.count_documents({"institute_id": iid})
    stats["notices"] = await db.notices.count_documents({"institute_id": iid})
    stats["books"] = await db.books.count_documents({"institute_id": iid})
    stats["rooms"] = await db.rooms.count_documents({"institute_id": iid})
    return stats


# ============ DEPARTMENTS ============
@api.post("/departments")
async def create_department(data: DepartmentIn, user: dict = Depends(require_roles("admin"))):
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "name": data.name, "code": data.code, "description": data.description,
        "hod_id": None, "created_at": now_iso(),
    }
    await db.departments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/departments")
async def list_departments(user: dict = Depends(get_current_user)):
    items = await db.departments.find({"institute_id": user["institute_id"]}, {"_id": 0}).to_list(500)
    return items


@api.patch("/departments/{dep_id}")
async def update_department(dep_id: str, data: DepartmentUpdateIn, user: dict = Depends(require_roles("admin"))):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if update:
        await db.departments.update_one({"id": dep_id, "institute_id": user["institute_id"]}, {"$set": update})
    return (await db.departments.find_one({"id": dep_id}, {"_id": 0}))


@api.delete("/departments/{dep_id}")
async def delete_department(dep_id: str, user: dict = Depends(require_roles("admin"))):
    await db.departments.delete_one({"id": dep_id, "institute_id": user["institute_id"]})
    return {"ok": True}


@api.post("/departments/{dep_id}/assign-hod/{user_id}")
async def assign_hod(dep_id: str, user_id: str, user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id, "institute_id": user["institute_id"]})
    if not target:
        raise HTTPException(404, "User not found")
    dept = await db.departments.find_one({"id": dep_id, "institute_id": user["institute_id"]})
    if not dept:
        raise HTTPException(404, "Department not found")
    # Demote previous HOD back to teacher role
    prev_hod_id = dept.get("hod_id")
    if prev_hod_id and prev_hod_id != user_id:
        await db.users.update_one({"id": prev_hod_id}, {"$set": {"role": "teacher"}})
    await db.users.update_one({"id": user_id}, {"$set": {"role": "hod", "department_id": dep_id}})
    await db.departments.update_one({"id": dep_id}, {"$set": {"hod_id": user_id}})
    return {"ok": True}


# ============ USERS ============
@api.get("/users")
async def list_users(role: Optional[str] = None, department_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if role:
        q["role"] = role
    if department_id:
        q["department_id"] = department_id
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.post("/teachers/{teacher_id}/assign-department/{dep_id}")
async def assign_teacher(teacher_id: str, dep_id: str, user: dict = Depends(require_roles("admin", "hod"))):
    await db.users.update_one(
        {"id": teacher_id, "institute_id": user["institute_id"], "role": "teacher"},
        {"$set": {"department_id": dep_id}},
    )
    return {"ok": True}


# ============ NOTICES ============
@api.post("/notices")
async def create_notice(data: NoticeIn, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "title": data.title, "body": data.body, "audience": data.audience,
        "author_id": user["id"], "author_name": user["name"],
        "created_at": now_iso(),
    }
    await db.notices.insert_one(doc)
    # notify audience
    q = {"institute_id": user["institute_id"]}
    if data.audience != "all":
        mapping = {"teachers": "teacher", "students": "student", "parents": "parent", "hods": "hod"}
        q["role"] = mapping[data.audience]
    recipients = await db.users.find(q, {"id": 1, "_id": 0}).to_list(5000)
    await create_notification([r["id"] for r in recipients], "New Notice", data.title, "notice")
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/notices")
async def list_notices(user: dict = Depends(get_current_user)):
    items = await db.notices.find({"institute_id": user["institute_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ============ MESSAGES ============
@api.get("/messages/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    """Return all users this user has chatted with + last message + unread count."""
    pipe = [
        {"$match": {"institute_id": user["institute_id"], "$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
    ]
    msgs = await db.messages.aggregate(pipe).to_list(2000)
    convs = {}
    for m in msgs:
        other = m["to_id"] if m["from_id"] == user["id"] else m["from_id"]
        if other not in convs:
            convs[other] = {
                "user_id": other,
                "last_message": m["body"],
                "last_time": m["created_at"],
                "unread": 0,
            }
        if m["to_id"] == user["id"] and not m.get("read"):
            convs[other]["unread"] += 1
    # enrich with user profiles
    ids = list(convs.keys())
    if ids:
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
        by_id = {u["id"]: u for u in users}
        for cid, c in convs.items():
            u = by_id.get(cid, {})
            c["name"] = u.get("name", "Unknown")
            c["role"] = u.get("role", "")
            c["unique_id"] = u.get("unique_id", "")
    return sorted(convs.values(), key=lambda x: x["last_time"], reverse=True)


@api.post("/messages")
async def send_message(data: MessageIn, user: dict = Depends(get_current_user)):
    recipient = await db.users.find_one({"id": data.to_user_id, "institute_id": user["institute_id"]})
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "from_id": user["id"], "from_name": user["name"], "from_role": user["role"],
        "to_id": data.to_user_id, "to_name": recipient["name"], "to_role": recipient["role"],
        "body": data.body, "created_at": now_iso(), "read": False,
    }
    await db.messages.insert_one(doc)
    await create_notification([data.to_user_id], f"Message from {user['name']}", data.body[:100], "message")
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/messages")
async def list_messages(with_user: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if with_user:
        q["$or"] = [
            {"from_id": user["id"], "to_id": with_user},
            {"from_id": with_user, "to_id": user["id"]},
        ]
        # mark incoming as read
        await db.messages.update_many(
            {"institute_id": user["institute_id"], "from_id": with_user, "to_id": user["id"], "read": False},
            {"$set": {"read": True}},
        )
    else:
        q["$or"] = [{"from_id": user["id"]}, {"to_id": user["id"]}]
    items = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    return items


# ============ ATTENDANCE ============
@api.post("/attendance/sessions")
async def start_session(data: AttendanceSessionIn, user: dict = Depends(require_roles("teacher", "hod"))):
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "department_id": data.department_id, "class_name": data.class_name, "subject": data.subject,
        "teacher_id": user["id"], "teacher_name": user["name"],
        "start_time": now_iso(), "end_time": None, "submitted": False,
        "entries": [],
    }
    await db.attendance_sessions.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/attendance/save")
async def save_attendance(data: AttendanceSaveIn, user: dict = Depends(require_roles("teacher", "hod"))):
    """Save attendance as draft; optionally record end_time without submitting."""
    sess = await db.attendance_sessions.find_one({"id": data.session_id, "institute_id": user["institute_id"]})
    if not sess:
        raise HTTPException(404, "Session not found")
    if sess.get("submitted"):
        raise HTTPException(400, "Already submitted")
    upd = {"entries": data.entries}
    if data.end_class:
        upd["end_time"] = now_iso()
    await db.attendance_sessions.update_one({"id": data.session_id}, {"$set": upd})
    return {"ok": True, "entries_count": len(data.entries)}


@api.post("/attendance/submit")
async def submit_attendance(data: AttendanceMarkIn, user: dict = Depends(require_roles("teacher", "hod"))):
    sess = await db.attendance_sessions.find_one({"id": data.session_id, "institute_id": user["institute_id"]})
    if not sess:
        raise HTTPException(404, "Session not found")
    if sess.get("submitted"):
        raise HTTPException(400, "Already submitted")
    end_time = sess.get("end_time") or now_iso()
    await db.attendance_sessions.update_one(
        {"id": data.session_id},
        {"$set": {"entries": data.entries, "end_time": end_time, "submitted": True, "submitted_at": now_iso()}},
    )
    # store per-student records
    for e in data.entries:
        await db.attendance_records.insert_one({
            "id": uid(), "institute_id": user["institute_id"],
            "session_id": data.session_id, "student_id": e["student_id"],
            "present": bool(e.get("present")), "subject": sess["subject"],
            "class_name": sess["class_name"], "date": now_iso(),
        })
    student_ids = [e["student_id"] for e in data.entries]
    await create_notification(student_ids, "Attendance Updated", f"Attendance submitted for {sess['subject']}", "attendance")
    # notify HOD
    hods = await db.users.find({"role": "hod", "department_id": sess["department_id"]}, {"id": 1, "_id": 0}).to_list(20)
    await create_notification([h["id"] for h in hods], "Attendance Submitted", f"{user['name']} submitted for {sess['subject']}", "attendance")
    return {"ok": True}


@api.get("/attendance/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if user["role"] == "teacher":
        q["teacher_id"] = user["id"]
    items = await db.attendance_sessions.find(q, {"_id": 0}).sort("start_time", -1).to_list(200)
    return items


@api.get("/attendance/student/{student_id}")
async def student_attendance(student_id: str, user: dict = Depends(get_current_user)):
    # students see own; parents see child; teachers/hod/admin see all
    if user["role"] == "student" and user["id"] != student_id:
        raise HTTPException(403, "Forbidden")
    records = await db.attendance_records.find({"student_id": student_id, "institute_id": user["institute_id"]}, {"_id": 0}).to_list(1000)
    total = len(records)
    present = sum(1 for r in records if r["present"])
    pct = round((present / total * 100) if total else 0, 1)
    return {"records": records, "total": total, "present": present, "percentage": pct}


# ============ HOSTEL ============
@api.post("/hostel/rooms")
async def create_room(data: RoomIn, user: dict = Depends(require_roles("admin", "hod", "hostel_staff"))):
    doc = {"id": uid(), "institute_id": user["institute_id"], "room_number": data.room_number,
           "capacity": data.capacity, "block": data.block, "occupants": [], "created_at": now_iso()}
    await db.rooms.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/hostel/rooms")
async def list_rooms(user: dict = Depends(get_current_user)):
    rooms = await db.rooms.find({"institute_id": user["institute_id"]}, {"_id": 0}).to_list(500)
    return rooms


@api.post("/hostel/allocate")
async def allocate_room(data: AllocateIn, user: dict = Depends(require_roles("admin", "hod"))):
    room = await db.rooms.find_one({"id": data.room_id, "institute_id": user["institute_id"]})
    if not room:
        raise HTTPException(404, "Room not found")
    if len(room.get("occupants", [])) >= room["capacity"]:
        raise HTTPException(400, "Room full")
    await db.rooms.update_one({"id": data.room_id}, {"$addToSet": {"occupants": data.student_id}})
    return {"ok": True}


@api.post("/hostel/mess-entry/{student_id}")
async def mess_entry(student_id: str, user: dict = Depends(require_roles("admin", "hod", "teacher", "hostel_staff"))):
    await db.mess_entries.insert_one({
        "id": uid(), "institute_id": user["institute_id"],
        "student_id": student_id, "date": now_iso(),
    })
    return {"ok": True}


@api.get("/hostel/mess-count")
async def mess_count(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    count = await db.mess_entries.count_documents({
        "institute_id": user["institute_id"],
        "date": {"$regex": f"^{today}"},
    })
    return {"today": count}


# ============ LIBRARY ============
@api.post("/library/books")
async def create_book(data: BookIn, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    doc = {"id": uid(), "institute_id": user["institute_id"],
           "title": data.title, "author": data.author, "isbn": data.isbn,
           "copies": data.copies, "available": data.copies, "created_at": now_iso()}
    await db.books.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/library/books")
async def list_books(user: dict = Depends(get_current_user)):
    return await db.books.find({"institute_id": user["institute_id"]}, {"_id": 0}).to_list(500)


@api.post("/library/issue")
async def issue_book(data: IssueBookIn, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    book = await db.books.find_one({"id": data.book_id, "institute_id": user["institute_id"]})
    if not book or book["available"] <= 0:
        raise HTTPException(400, "Book not available")
    await db.books.update_one({"id": data.book_id}, {"$inc": {"available": -1}})
    doc = {"id": uid(), "institute_id": user["institute_id"],
           "book_id": data.book_id, "book_title": book["title"],
           "student_id": data.student_id, "issued_at": now_iso(), "returned": False}
    await db.issued_books.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/library/return/{issue_id}")
async def return_book(issue_id: str, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    rec = await db.issued_books.find_one({"id": issue_id, "institute_id": user["institute_id"]})
    if not rec or rec["returned"]:
        raise HTTPException(400, "Invalid")
    await db.issued_books.update_one({"id": issue_id}, {"$set": {"returned": True, "returned_at": now_iso()}})
    await db.books.update_one({"id": rec["book_id"]}, {"$inc": {"available": 1}})
    return {"ok": True}


@api.get("/library/issued")
async def list_issued(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if student_id:
        q["student_id"] = student_id
    elif user["role"] == "student":
        q["student_id"] = user["id"]
    return await db.issued_books.find(q, {"_id": 0}).sort("issued_at", -1).to_list(500)


# ============ FEES ============
@api.post("/fees")
async def create_fee(data: FeeIn, user: dict = Depends(require_roles("admin", "hod"))):
    doc = {"id": uid(), "institute_id": user["institute_id"],
           "student_id": data.student_id, "amount": data.amount,
           "description": data.description, "due_date": data.due_date,
           "paid": False, "created_at": now_iso()}
    await db.fees.insert_one(doc)
    await create_notification([data.student_id], "New Fee", f"{data.description} - ₹{data.amount}", "fee")
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/fees")
async def list_fees(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if user["role"] == "student":
        q["student_id"] = user["id"]
    elif student_id:
        q["student_id"] = student_id
    return await db.fees.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/fees/{fee_id}/pay")
async def pay_fee(fee_id: str, user: dict = Depends(get_current_user)):
    # Mock payment gateway
    fee = await db.fees.find_one({"id": fee_id, "institute_id": user["institute_id"]})
    if not fee:
        raise HTTPException(404, "Not found")
    await db.fees.update_one({"id": fee_id}, {"$set": {"paid": True, "paid_at": now_iso()}})
    return {"ok": True, "transaction_id": "TXN-" + uid()[:8].upper()}


# ============ PDF UPLOAD (STUDENT LIST) ============
@api.post("/upload/students-pdf")
async def upload_students_pdf(file: UploadFile = File(...), department_id: Optional[str] = Form(None), user: dict = Depends(require_roles("admin", "hod"))):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "PDF required")
    data = await file.read()
    rows = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables() or []
                for t in tables:
                    rows.extend(t)
                if not tables:
                    # try text line parsing as fallback
                    text = page.extract_text() or ""
                    for line in text.splitlines():
                        parts = [p.strip() for p in line.split() if p.strip()]
                        if len(parts) >= 2:
                            rows.append(parts)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse PDF: {e}")

    # Expect structure: [roll_no, name, email?]
    parsed = []
    for r in rows:
        if not r or all((not (c or "").strip()) for c in r):
            continue
        cells = [(c or "").strip() for c in r]
        # skip headers
        low = " ".join(cells).lower()
        if "roll" in low and "name" in low:
            continue
        if len(cells) < 2:
            continue
        roll = cells[0]
        name = cells[1]
        email = cells[2] if len(cells) > 2 and "@" in (cells[2] or "") else None
        parsed.append({"roll_no": roll, "name": name, "email": email})

    created = 0
    for p in parsed:
        if not p.get("name") or not p.get("roll_no"):
            continue
        email = p.get("email") or f"{p['roll_no'].lower()}@{user['institute_id'][:6]}.edu"
        if await db.users.find_one({"email": email}):
            continue
        sid = uid()
        await db.users.insert_one({
            "id": sid,
            "unique_id": f"STU-{sid[:6].upper()}",
            "email": email,
            "password_hash": hash_password("Student@123"),
            "name": p["name"], "role": "student",
            "institute_id": user["institute_id"], "department_id": department_id,
            "extra": {"roll_no": p["roll_no"]},
            "verified": True, "created_at": now_iso(),
        })
        created += 1
    return {"parsed": len(parsed), "created": created, "default_password": "Student@123"}


# ============ AI ASSISTANT ============
PRIVATE_KEYWORDS = ["salary", "salaries", "password", "hash", "home address", "aadhaar", "ssn", "phone number of", "personal phone"]


@api.post("/ai/ask")
async def ai_ask(data: AIAskIn, user: dict = Depends(get_current_user)):
    q_lower = data.question.lower()
    if any(k in q_lower for k in PRIVATE_KEYWORDS):
        return {"answer": "I cannot share private or sensitive information (e.g., salaries, personal contact details, passwords). Please ask about public institute information.", "blocked": True}

    # Check plan limit
    iid = user["institute_id"]
    sub = await db.subscriptions.find_one({"institute_id": iid}) or {"plan_id": "free"}
    plan = PLANS.get(sub.get("plan_id", "free"), PLANS["free"])
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    used_month = await db.ai_logs.count_documents({"institute_id": iid, "created_at": {"$gte": month_start}})
    credits = int(sub.get("ai_credits_remaining", 0))
    if used_month >= plan["limits"]["ai_queries"] and credits <= 0:
        return {"answer": "Your institute has reached this month's AI query limit. Purchase an AI credit pack from Billing → AI Credits, or upgrade your plan.", "blocked": True, "limit_reached": True}
    use_credit = used_month >= plan["limits"]["ai_queries"]

    # Gather PUBLIC context only
    inst = await db.institutes.find_one({"id": iid}, {"_id": 0, "admin_id": 0}) if user.get("institute_id") else None
    departments = await db.departments.find({"institute_id": iid}, {"_id": 0, "hod_id": 0}).to_list(50)
    notices = await db.notices.find({"institute_id": iid}, {"_id": 0, "author_id": 0}).sort("created_at", -1).to_list(10)
    teacher_count = await db.users.count_documents({"institute_id": iid, "role": "teacher"})
    student_count = await db.users.count_documents({"institute_id": iid, "role": "student"})
    books = await db.books.count_documents({"institute_id": iid})

    context = {
        "institute": {"name": inst.get("name"), "code": inst.get("code")} if inst else {},
        "departments": [{"name": d["name"], "code": d["code"], "description": d.get("description")} for d in departments],
        "recent_notices": [{"title": n["title"], "body": n["body"][:200], "audience": n["audience"], "date": n["created_at"]} for n in notices],
        "stats": {"teachers": teacher_count, "students": student_count, "library_books": books},
    }

    system_msg = (
        "You are the EduCore AI Assistant for an educational institute SaaS. "
        "Answer ONLY based on the public institute data provided in CONTEXT. "
        "NEVER reveal salaries, passwords, personal phone numbers, home addresses, or any private info. "
        "If information isn't in the context, say you don't have that public information. "
        "Be concise, helpful, and professional."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        session_id = data.session_id or f"edu-{user['id']}"
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=session_id,
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = f"CONTEXT (public institute data):\n{context}\n\nQUESTION: {data.question}"
        answer = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("AI error")
        raise HTTPException(503, f"AI service unavailable: {e}")

    await db.ai_logs.insert_one({
        "id": uid(), "user_id": user["id"], "institute_id": iid,
        "question": data.question, "answer": str(answer)[:2000],
        "used_credit": use_credit,
        "created_at": now_iso(),
    })
    if use_credit:
        await db.subscriptions.update_one(
            {"institute_id": iid},
            {"$inc": {"ai_credits_remaining": -1}, "$set": {"updated_at": now_iso()}},
        )
    return {"answer": answer, "blocked": False, "used_credit": use_credit}


# ============ GALLERY ============
@api.post("/gallery")
async def create_gallery_item(data: GalleryIn, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "title": data.title, "image_url": data.image_url, "caption": data.caption,
        "category": data.category or "general", "department_id": data.department_id,
        "uploader_id": user["id"], "uploader_name": user["name"],
        "created_at": now_iso(),
    }
    await db.gallery.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/gallery")
async def list_gallery(department_id: Optional[str] = None, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if department_id:
        q["department_id"] = department_id
    if category:
        q["category"] = category
    items = await db.gallery.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.delete("/gallery/{gid}")
async def delete_gallery_item(gid: str, user: dict = Depends(require_roles("admin", "hod", "teacher"))):
    await db.gallery.delete_one({"id": gid, "institute_id": user["institute_id"]})
    return {"ok": True}


# ============ QR CODES ============
@api.get("/qr/profile")
async def qr_profile(user: dict = Depends(get_current_user)):
    """QR encoding user profile (unique_id, role, institute) for quick scan/verification."""
    inst = await db.institutes.find_one({"id": user["institute_id"]}, {"_id": 0}) if user.get("institute_id") else None
    payload = {
        "unique_id": user["unique_id"],
        "name": user["name"],
        "role": user["role"],
        "institute_code": inst.get("code") if inst else None,
    }
    data_str = "EDUCORE::" + json.dumps(payload)
    return {"qr": make_qr_base64(data_str), "payload": payload}


@api.get("/qr/institute-join")
async def qr_institute_join(user: dict = Depends(require_roles("admin", "hod", "superadmin"))):
    """QR containing institute join URL (pre-fills code on registration)."""
    inst = await db.institutes.find_one({"id": user["institute_id"]}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Institute not found")
    frontend = os.environ.get("FRONTEND_PUBLIC_URL") or os.environ.get("FRONTEND_URL", "")
    if frontend in ("", "*"):
        frontend = ""
    join_url = f"{frontend}/register?institute_code={inst['code']}" if frontend else f"/register?institute_code={inst['code']}"
    return {"qr": make_qr_base64(join_url), "url": join_url, "code": inst["code"]}


@api.get("/qr/fee/{fee_id}")
async def qr_fee(fee_id: str, user: dict = Depends(get_current_user)):
    fee = await db.fees.find_one({"id": fee_id, "institute_id": user["institute_id"]}, {"_id": 0})
    if not fee:
        raise HTTPException(404, "Not found")
    if fee.get("paid"):
        raise HTTPException(400, "Fee already paid")
    inst = await db.institutes.find_one({"id": user["institute_id"]}, {"_id": 0})
    # UPI-style payment payload (mock)
    upi_id = f"educore-{(inst or {}).get('code','demo').lower()}@upi"
    payload = f"upi://pay?pa={upi_id}&pn=EduCore&am={fee['amount']}&tn=Fee-{fee_id[:8]}&cu=INR"
    return {"qr": make_qr_base64(payload), "amount": fee["amount"], "description": fee["description"], "upi_payload": payload}


# ============ SUBSCRIPTIONS / STRIPE ============
@api.get("/plans")
async def list_plans():
    return [{"id": k, **v} for k, v in PLANS.items()]


@api.get("/subscription")
async def my_subscription(user: dict = Depends(get_current_user)):
    if not user.get("institute_id"):
        return {"plan_id": "free", "status": "n/a"}
    sub = await db.subscriptions.find_one({"institute_id": user["institute_id"]}, {"_id": 0})
    if not sub:
        sub = {"plan_id": "free", "status": "active", "institute_id": user["institute_id"]}
    # Compute AI usage this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    ai_used_month = await db.ai_logs.count_documents({
        "institute_id": user["institute_id"], "created_at": {"$gte": month_start}
    })
    plan = PLANS.get(sub.get("plan_id", "free"), PLANS["free"])
    sub["ai_used_this_month"] = ai_used_month
    sub["ai_limit_monthly"] = plan["limits"]["ai_queries"]
    sub["ai_credits_remaining"] = sub.get("ai_credits_remaining", 0)
    sub["plan_name"] = plan["name"]
    return sub


@api.get("/credit-pack")
async def credit_pack_info():
    return CREDIT_PACK


@api.post("/checkout/credit-pack")
async def buy_credit_pack(data: CreditPackCheckoutIn, request: Request, user: dict = Depends(require_roles("admin", "hod"))):
    if not user.get("institute_id"):
        raise HTTPException(400, "No institute")
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)

    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/dashboard"
    metadata = {
        "institute_id": user["institute_id"], "user_id": user["id"],
        "purchase_type": "credit_pack", "credits": str(CREDIT_PACK["credits"]),
    }
    req = CheckoutSessionRequest(
        amount=float(CREDIT_PACK["amount"]), currency=CREDIT_PACK["currency"],
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": uid(), "session_id": session.session_id,
        "institute_id": user["institute_id"], "user_id": user["id"],
        "plan_id": "credit_pack", "amount": CREDIT_PACK["amount"], "currency": CREDIT_PACK["currency"],
        "credits": CREDIT_PACK["credits"],
        "status": "initiated", "payment_status": "pending", "purchase_type": "credit_pack",
        "metadata": metadata, "created_at": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.post("/checkout/session")
async def create_checkout(data: CheckoutIn, request: Request, user: dict = Depends(require_roles("admin"))):
    plan = PLANS.get(data.plan_id)
    if not plan or data.plan_id == "free":
        raise HTTPException(400, "Invalid plan")
    if not user.get("institute_id"):
        raise HTTPException(400, "No institute")

    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)

    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/dashboard"

    metadata = {
        "institute_id": user["institute_id"],
        "user_id": user["id"],
        "plan_id": data.plan_id,
    }
    req = CheckoutSessionRequest(
        amount=float(plan["amount"]), currency=plan["currency"],
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)

    # Record payment transaction (pending)
    await db.payment_transactions.insert_one({
        "id": uid(), "session_id": session.session_id,
        "institute_id": user["institute_id"], "user_id": user["id"],
        "plan_id": data.plan_id, "amount": plan["amount"], "currency": plan["currency"],
        "status": "initiated", "payment_status": "pending",
        "metadata": metadata, "created_at": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        # Session may not yet be retrievable immediately after creation; let the poller retry.
        logger.warning(f"checkout_status transient error: {e}")
        return {"status": "open", "payment_status": "pending", "amount_total": 0, "currency": "usd", "metadata": {}, "transient": True}

    # Update the payment record (idempotent)
    existing = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if existing and existing.get("payment_status") != "paid":
        upd = {"status": status.status, "payment_status": status.payment_status, "updated_at": now_iso()}
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": upd})
        if status.payment_status == "paid":
            meta = existing.get("metadata") or status.metadata or {}
            institute_id = meta.get("institute_id") or existing.get("institute_id")
            purchase_type = meta.get("purchase_type") or existing.get("purchase_type")
            if purchase_type == "credit_pack":
                # Top up credits
                credits_to_add = int(meta.get("credits") or existing.get("credits") or CREDIT_PACK["credits"])
                await db.subscriptions.update_one(
                    {"institute_id": institute_id},
                    {"$inc": {"ai_credits_remaining": credits_to_add},
                     "$setOnInsert": {"plan_id": "free", "status": "active", "institute_id": institute_id, "created_at": now_iso()},
                     "$set": {"updated_at": now_iso()}},
                    upsert=True,
                )
            else:
                plan_id = meta.get("plan_id") or existing.get("plan_id")
                if institute_id and plan_id and plan_id in PLANS:
                    now_ts = datetime.now(timezone.utc)
                    await db.subscriptions.update_one(
                        {"institute_id": institute_id},
                        {"$set": {
                            "institute_id": institute_id, "plan_id": plan_id,
                            "status": "active", "current_period_start": now_ts.isoformat(),
                            "current_period_end": (now_ts + timedelta(days=30)).isoformat(),
                            "amount": PLANS[plan_id]["amount"], "currency": PLANS[plan_id]["currency"],
                            "last_session_id": session_id, "updated_at": now_iso(),
                        }},
                        upsert=True,
                    )
    return {"status": status.status, "payment_status": status.payment_status,
            "amount_total": status.amount_total, "currency": status.currency, "metadata": status.metadata}


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)
    try:
        resp = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.exception("Webhook err")
        raise HTTPException(400, f"Webhook error: {e}")
    if resp.payment_status == "paid" and resp.session_id:
        existing = await db.payment_transactions.find_one({"session_id": resp.session_id})
        if existing and existing.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": resp.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "updated_at": now_iso()}},
            )
            meta = existing.get("metadata") or resp.metadata or {}
            iid = meta.get("institute_id") or existing.get("institute_id")
            ptype = meta.get("purchase_type") or existing.get("purchase_type")
            if ptype == "credit_pack" and iid:
                credits_to_add = int(meta.get("credits") or existing.get("credits") or CREDIT_PACK["credits"])
                await db.subscriptions.update_one(
                    {"institute_id": iid},
                    {"$inc": {"ai_credits_remaining": credits_to_add},
                     "$setOnInsert": {"plan_id": "free", "status": "active", "institute_id": iid, "created_at": now_iso()},
                     "$set": {"updated_at": now_iso()}},
                    upsert=True,
                )
            else:
                pid = meta.get("plan_id") or existing.get("plan_id")
                if iid and pid and pid in PLANS:
                    now_ts = datetime.now(timezone.utc)
                    await db.subscriptions.update_one(
                        {"institute_id": iid},
                        {"$set": {
                            "institute_id": iid, "plan_id": pid, "status": "active",
                            "current_period_start": now_ts.isoformat(),
                            "current_period_end": (now_ts + timedelta(days=30)).isoformat(),
                            "amount": PLANS[pid]["amount"], "currency": PLANS[pid]["currency"],
                            "last_session_id": resp.session_id, "updated_at": now_iso(),
                        }},
                        upsert=True,
                    )
    return {"ok": True}


# ============ SUPER ADMIN (Platform Owner) ============
@api.get("/super/stats")
async def super_stats(user: dict = Depends(require_roles("superadmin"))):
    total_users = await db.users.count_documents({})
    # Revenue analytics
    subs = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(5000)
    mrr = sum(s.get("amount", 0) for s in subs if s.get("plan_id") != "free")
    plan_distribution = {"free": 0, "pro": 0, "enterprise": 0}
    total_institutes = await db.institutes.count_documents({})
    paying = 0
    for s in subs:
        pid = s.get("plan_id", "free")
        if pid in plan_distribution:
            plan_distribution[pid] += 1
        if pid != "free":
            paying += 1
    plan_distribution["free"] = max(0, total_institutes - paying)
    paid_txns = await db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    lifetime_revenue = sum(t.get("amount", 0) for t in paid_txns)
    return {
        "institutes": total_institutes,
        "blocked_institutes": await db.institutes.count_documents({"blocked": True}),
        "users_total": total_users,
        "admins": await db.users.count_documents({"role": "admin"}),
        "hods": await db.users.count_documents({"role": "hod"}),
        "teachers": await db.users.count_documents({"role": "teacher"}),
        "students": await db.users.count_documents({"role": "student"}),
        "parents": await db.users.count_documents({"role": "parent"}),
        "notices": await db.notices.count_documents({}),
        "messages": await db.messages.count_documents({}),
        "ai_queries": await db.ai_logs.count_documents({}),
        # Revenue
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "paying_institutes": paying,
        "conversion_rate": round((paying / total_institutes * 100) if total_institutes else 0, 1),
        "lifetime_revenue": round(lifetime_revenue, 2),
        "plan_distribution": plan_distribution,
        "transactions_count": len(paid_txns),
    }


@api.get("/super/transactions")
async def super_transactions(user: dict = Depends(require_roles("superadmin"))):
    txns = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return txns


@api.get("/super/subscriptions")
async def super_subscriptions(user: dict = Depends(require_roles("superadmin"))):
    subs = await db.subscriptions.find({}, {"_id": 0}).to_list(2000)
    # enrich with institute name
    iids = list({s["institute_id"] for s in subs if s.get("institute_id")})
    if iids:
        ins = await db.institutes.find({"id": {"$in": iids}}, {"_id": 0}).to_list(2000)
        by_id = {i["id"]: i for i in ins}
        for s in subs:
            inst = by_id.get(s["institute_id"], {})
            s["institute_name"] = inst.get("name")
            s["institute_code"] = inst.get("code")
    return subs


@api.get("/super/institutes")
async def super_institutes(user: dict = Depends(require_roles("superadmin"))):
    items = await db.institutes.find({}, {"_id": 0}).to_list(1000)
    for i in items:
        i["user_count"] = await db.users.count_documents({"institute_id": i["id"]})
        i["student_count"] = await db.users.count_documents({"institute_id": i["id"], "role": "student"})
    return items


@api.get("/super/users")
async def super_users(role: Optional[str] = None, institute_id: Optional[str] = None, user: dict = Depends(require_roles("superadmin"))):
    q = {}
    if role:
        q["role"] = role
    if institute_id:
        q["institute_id"] = institute_id
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(2000)


@api.post("/super/institutes/{iid}/verify")
async def super_verify_institute(iid: str, user: dict = Depends(require_roles("superadmin"))):
    inst = await db.institutes.find_one({"id": iid})
    if not inst:
        raise HTTPException(404, "Institute not found")
    await db.institutes.update_one({"id": iid}, {"$set": {"status": "verified", "verified_at": now_iso(), "verified_by": user["id"]}})
    # Notify the institute admin
    if inst.get("admin_id"):
        await create_notification([inst["admin_id"]], "Institute verified",
            f"Your institute '{inst['name']}' has been verified. You can now invite members.", "system")
    return {"ok": True}


@api.post("/super/institutes/{iid}/reject")
async def super_reject_institute(iid: str, user: dict = Depends(require_roles("superadmin"))):
    await db.institutes.update_one({"id": iid}, {"$set": {"status": "rejected"}})
    return {"ok": True}


@api.post("/super/institutes/{iid}/block")
async def super_block(iid: str, user: dict = Depends(require_roles("superadmin"))):
    await db.institutes.update_one({"id": iid}, {"$set": {"blocked": True}})
    return {"ok": True}


@api.post("/super/institutes/{iid}/unblock")
async def super_unblock(iid: str, user: dict = Depends(require_roles("superadmin"))):
    await db.institutes.update_one({"id": iid}, {"$set": {"blocked": False}})
    return {"ok": True}


@api.delete("/super/institutes/{iid}")
async def super_delete_institute(iid: str, user: dict = Depends(require_roles("superadmin"))):
    await db.institutes.delete_one({"id": iid})
    await db.users.delete_many({"institute_id": iid})
    await db.departments.delete_many({"institute_id": iid})
    await db.notices.delete_many({"institute_id": iid})
    return {"ok": True}


@api.delete("/super/users/{uid_}")
async def super_delete_user(uid_: str, user: dict = Depends(require_roles("superadmin"))):
    await db.users.delete_one({"id": uid_})
    return {"ok": True}


# ============ EXAM RESULTS ============
@api.post("/results")
async def create_result(data: ExamResultIn, user: dict = Depends(require_roles("teacher", "hod", "admin"))):
    student = await db.users.find_one({"id": data.student_id, "institute_id": user["institute_id"]})
    if not student:
        raise HTTPException(404, "Student not found")
    percentage = round((data.marks / data.total_marks) * 100, 2) if data.total_marks else 0
    grade = data.grade or ("A+" if percentage >= 90 else "A" if percentage >= 80 else "B" if percentage >= 70 else "C" if percentage >= 60 else "D" if percentage >= 40 else "F")
    doc = {
        "id": uid(), "institute_id": user["institute_id"],
        "student_id": data.student_id, "student_name": student["name"],
        "student_roll": (student.get("profile") or {}).get("roll_no"),
        "subject": data.subject, "exam_name": data.exam_name, "term": data.term,
        "marks": float(data.marks), "total_marks": float(data.total_marks),
        "percentage": percentage, "grade": grade, "remarks": data.remarks,
        "teacher_id": user["id"], "teacher_name": user["name"],
        "published": False, "created_at": now_iso(),
    }
    await db.exam_results.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/results")
async def list_results(student_id: Optional[str] = None, exam_name: Optional[str] = None, published_only: bool = False, user: dict = Depends(get_current_user)):
    q = {"institute_id": user["institute_id"]}
    if student_id:
        q["student_id"] = student_id
    if exam_name:
        q["exam_name"] = exam_name
    # Students/parents only see published
    if user["role"] in ("student", "parent"):
        q["published"] = True
        if user["role"] == "student":
            q["student_id"] = user["id"]
    elif published_only:
        q["published"] = True
    return await db.exam_results.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/results/publish")
async def publish_results(data: BulkPublishIn, user: dict = Depends(require_roles("hod", "admin"))):
    await db.exam_results.update_many(
        {"id": {"$in": data.result_ids}, "institute_id": user["institute_id"]},
        {"$set": {"published": data.publish, "published_at": now_iso() if data.publish else None}},
    )
    # Notify affected students
    if data.publish:
        recs = await db.exam_results.find({"id": {"$in": data.result_ids}}, {"student_id": 1, "exam_name": 1, "_id": 0}).to_list(1000)
        student_ids = list({r["student_id"] for r in recs})
        await create_notification(student_ids, "Exam results published", "Your exam results are now available in the Results tab.", "result")
    return {"ok": True, "count": len(data.result_ids)}


@api.delete("/results/{rid}")
async def delete_result(rid: str, user: dict = Depends(require_roles("teacher", "hod", "admin"))):
    await db.exam_results.delete_one({"id": rid, "institute_id": user["institute_id"]})
    return {"ok": True}


@api.get("/results/public/{institute_code}/{exam_name}")
async def public_results(institute_code: str, exam_name: str):
    """Public result lookup — anyone with institute code + exam name can view published results (roll no only, no personal info)."""
    inst = await db.institutes.find_one({"code": institute_code}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Institute not found")
    recs = await db.exam_results.find(
        {"institute_id": inst["id"], "exam_name": exam_name, "published": True},
        {"_id": 0, "teacher_id": 0, "teacher_name": 0, "remarks": 0}
    ).sort("percentage", -1).to_list(2000)
    return {"institute": inst["name"], "exam": exam_name, "results": recs}


# ============ ANALYTICS ============
@api.get("/analytics/dashboard")
async def analytics_dashboard(user: dict = Depends(require_roles("admin", "hod"))):
    iid = user["institute_id"]
    # Role distribution
    role_dist = []
    for r in ("admin","hod","teacher","student","parent","hostel_staff"):
        c = await db.users.count_documents({"institute_id": iid, "role": r})
        role_dist.append({"role": r, "count": c})

    # Attendance trend — last 7 days
    from collections import defaultdict
    from datetime import date
    today = datetime.now(timezone.utc).date()
    att_trend = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        day_start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc).isoformat()
        day_end = datetime.combine(d, datetime.max.time(), tzinfo=timezone.utc).isoformat()
        records = await db.attendance_records.find(
            {"institute_id": iid, "date": {"$gte": day_start, "$lte": day_end}}, {"_id": 0}
        ).to_list(5000)
        total = len(records)
        present = sum(1 for r in records if r.get("present"))
        att_trend.append({
            "date": d.strftime("%a"),
            "present": present,
            "absent": total - present,
            "percentage": round((present/total*100) if total else 0, 1),
        })

    # Fee collection — paid vs pending
    fees = await db.fees.find({"institute_id": iid}, {"_id": 0}).to_list(5000)
    fee_summary = {
        "paid_amount": sum(f["amount"] for f in fees if f.get("paid")),
        "pending_amount": sum(f["amount"] for f in fees if not f.get("paid")),
        "paid_count": sum(1 for f in fees if f.get("paid")),
        "pending_count": sum(1 for f in fees if not f.get("paid")),
    }

    # Subject performance (avg % per subject from exam_results)
    results = await db.exam_results.find({"institute_id": iid, "published": True}, {"_id": 0}).to_list(5000)
    subj_map = defaultdict(list)
    for r in results:
        subj_map[r["subject"]].append(r["percentage"])
    subject_perf = [{"subject": s, "avg": round(sum(v)/len(v), 1)} for s, v in subj_map.items()][:10]

    return {
        "role_distribution": role_dist,
        "attendance_trend": att_trend,
        "fee_summary": fee_summary,
        "subject_performance": subject_perf,
    }


# ============ NOTIFICATIONS ============
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ============ INIT ============
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # using token in header too
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await db.users.create_index("unique_id")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("institute_id")
    await db.institutes.create_index("code", unique=True)
    await db.departments.create_index("institute_id")
    await db.notifications.create_index("user_id")
    # Seed demo institute + admin
    demo_code = "DEMO-EDU"
    inst = await db.institutes.find_one({"code": demo_code})
    if not inst:
        iid = uid()
        await db.institutes.insert_one({
            "id": iid, "name": "SWAMEK Demo Institute", "code": demo_code,
            "admin_id": None, "blocked": False, "status": "verified",
            "created_at": now_iso(),
        })
    else:
        await db.institutes.update_one({"code": demo_code}, {"$set": {"status": "verified", "name": "SWAMEK Demo Institute"}})
    inst = await db.institutes.find_one({"code": demo_code})

    # Seed Super Admin (platform owner) — no institute
    super_email = os.environ.get("SUPERADMIN_EMAIL", "owner@educore.io")
    super_password = os.environ.get("SUPERADMIN_PASSWORD", "Owner@123")
    sexisting = await db.users.find_one({"email": super_email})
    if not sexisting:
        sid = uid()
        await db.users.insert_one({
            "id": sid, "unique_id": "SWM-OWNER-001",
            "email": super_email, "password_hash": hash_password(super_password),
            "name": "Platform Owner", "role": "superadmin",
            "institute_id": None, "department_id": None,
            "profile": {"designation": "Website Owner"},
            "verified": True, "created_at": now_iso(),
        })
    elif not verify_password(super_password, sexisting["password_hash"]):
        await db.users.update_one({"email": super_email}, {"$set": {"password_hash": hash_password(super_password)}})
    if sexisting and not (sexisting.get("unique_id") or "").startswith("SWM-"):
        await db.users.update_one({"email": super_email}, {"$set": {"unique_id": "SWM-OWNER-001"}})

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@educore.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        aid = uid()
        await db.users.insert_one({
            "id": aid, "unique_id": "SWM-DEMOEDU-ADM-001",
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Demo Admin", "role": "admin",
            "institute_id": inst["id"], "department_id": None,
            "verified": True, "created_at": now_iso(),
        })
        await db.institutes.update_one({"id": inst["id"]}, {"$set": {"admin_id": aid}})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    if existing and not (existing.get("unique_id") or "").startswith("SWM-"):
        await db.users.update_one({"email": admin_email}, {"$set": {"unique_id": "SWM-DEMOEDU-ADM-001"}})

    # Seed demo users (one-click demo login on landing page)
    demo_users = [
        ("hod@demo.com", "Demo@123", "Demo HOD", "hod"),
        ("teacher@demo.com", "Demo@123", "Demo Teacher", "teacher"),
        ("student@demo.com", "Demo@123", "Demo Student", "student"),
        ("parent@demo.com", "Demo@123", "Demo Parent", "parent"),
        ("hostel@demo.com", "Demo@123", "Demo Hostel Staff", "hostel_staff"),
        ("admin@demo.com", "Demo@123", "Demo Admin", "admin"),
    ]
    for email, pw, name, role in demo_users:
        found = await db.users.find_one({"email": email})
        if not found:
            uid_str = uid()
            new_uid = await next_unique_id("DEMO-EDU", role)
            await db.users.insert_one({
                "id": uid_str, "unique_id": new_uid,
                "email": email, "password_hash": hash_password(pw),
                "name": name, "role": role,
                "institute_id": inst["id"], "department_id": None,
                "profile": {"roll_no": "R001"} if role == "student" else {},
                "verified": True, "created_at": now_iso(),
            })

    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
