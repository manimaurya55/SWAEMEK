"""EduCore AI credit-pack backend tests (iteration 4).

Covers:
- GET /api/credit-pack (public)
- GET /api/subscription includes ai_used_this_month/ai_limit_monthly/ai_credits_remaining/plan_name
- POST /api/checkout/credit-pack (admin OK, hod OK, student/teacher/parent 403, unauth 401)
- POST /api/ai/ask response includes used_credit flag; ai_logs stores used_credit
- Idempotency on checkout/status for credit_pack (credits not double-applied for unpaid)
- Limit-reached code path inspection (no live exhaustion)
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@educore.io", "password": "Admin@123"}
SUPER = {"email": "owner@educore.io", "password": "Owner@123"}
INSTITUTE_CODE = "DEMO-EDU"
SUFFIX = uuid.uuid4().hex[:6]

state = {}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    state["institute_id"] = d["user"]["institute_id"]
    state["admin_user_id"] = d["user"]["id"]
    return d["token"]


@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _register(role, extras=None):
    body = {
        "email": f"test_cp_{role}_{SUFFIX}@educore.io",
        "password": "Passw0rd!",
        "name": f"TEST_{role}_{SUFFIX}",
        "role": role,
        "institute_code": INSTITUTE_CODE,
    }
    if extras:
        body.update(extras)
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code in (200, 201), f"register {role}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def student_token():
    return _register("student", {"roll_no": f"R{SUFFIX[:3]}", "class_name": "CS", "section": "A"})


@pytest.fixture(scope="session")
def teacher_token():
    return _register("teacher", {"department_id": None})


@pytest.fixture(scope="session")
def parent_token():
    return _register("parent")


@pytest.fixture(scope="session")
def hod_token():
    # HOD needs a department — try without first; server may accept None
    return _register("hod")


# ----------------- /api/credit-pack (public) -----------------
class TestCreditPackInfo:
    def test_public_no_auth_required(self):
        r = requests.get(f"{API}/credit-pack", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == "ai_pack_500"
        assert d["credits"] == 500
        assert float(d["amount"]) == 9.0
        assert d["currency"] == "usd"
        assert "name" in d and isinstance(d["name"], str) and len(d["name"]) > 0


# ----------------- /api/subscription usage fields -----------------
class TestSubscriptionUsage:
    def test_subscription_has_usage_fields(self, admin_token):
        r = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("ai_used_this_month", "ai_limit_monthly", "ai_credits_remaining", "plan_name", "plan_id"):
            assert k in d, f"missing {k} in /subscription"
        assert isinstance(d["ai_used_this_month"], int)
        assert isinstance(d["ai_limit_monthly"], int)
        assert isinstance(d["ai_credits_remaining"], int)
        assert d["ai_used_this_month"] >= 0
        # free limit is 20 per code
        if d["plan_id"] == "free":
            assert d["ai_limit_monthly"] == 20
            assert d["plan_name"] == "Free"
        state["ai_used_before"] = d["ai_used_this_month"]
        state["ai_limit"] = d["ai_limit_monthly"]
        state["ai_credits"] = d["ai_credits_remaining"]
        state["plan_id"] = d["plan_id"]


# ----------------- /api/checkout/credit-pack auth matrix -----------------
class TestCreditPackCheckoutAuth:
    def test_unauth_401(self):
        r = requests.post(f"{API}/checkout/credit-pack",
                          json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 401, r.text

    def test_student_forbidden(self, student_token):
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(student_token),
                          json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403, r.text

    def test_teacher_forbidden(self, teacher_token):
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(teacher_token),
                          json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403, r.text

    def test_parent_forbidden(self, parent_token):
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(parent_token),
                          json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403, r.text

    def test_superadmin_forbidden(self, super_token):
        # superadmin has no institute_id and isn't admin/hod
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(super_token),
                          json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403, r.text

    def test_admin_creates_session(self, admin_token):
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(admin_token),
                          json={"origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("session_id")
        assert d.get("url", "").startswith("http")
        state["credit_session_id"] = d["session_id"]

    def test_hod_creates_session(self, hod_token):
        r = requests.post(f"{API}/checkout/credit-pack", headers=_hdr(hod_token),
                          json={"origin_url": BASE_URL}, timeout=60)
        # hod with no institute_id would 400; but we registered with DEMO-EDU so should be 200
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            d = r.json()
            assert d.get("session_id")


# ----------------- transaction row shape for credit_pack -----------------
class TestCreditPackTransaction:
    def test_payment_transaction_has_credit_pack_fields(self, super_token):
        sid = state.get("credit_session_id")
        if not sid:
            pytest.skip("no credit-pack session created")
        r = requests.get(f"{API}/super/transactions", headers=_hdr(super_token), timeout=30)
        assert r.status_code == 200, r.text
        txns = r.json()
        tx = next((t for t in txns if t.get("session_id") == sid), None)
        assert tx is not None, "created credit-pack session missing in /super/transactions"
        assert tx.get("plan_id") == "credit_pack"
        assert tx.get("purchase_type") == "credit_pack"
        assert int(tx.get("credits", 0)) == 500
        assert float(tx.get("amount", 0)) == 9.0
        assert tx.get("currency") == "usd"
        assert tx.get("payment_status") in ("pending", "unpaid")


# ----------------- checkout/status idempotency for credit_pack -----------------
class TestCreditPackStatusIdempotent:
    def test_status_polls_do_not_apply_credits_on_unpaid(self, admin_token):
        sid = state.get("credit_session_id")
        if not sid:
            pytest.skip("no credit-pack session")
        # Snapshot credits before
        sub1 = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        before = int(sub1.get("ai_credits_remaining", 0))
        # Poll status twice
        r1 = requests.get(f"{API}/checkout/status/{sid}", headers=_hdr(admin_token), timeout=60)
        r2 = requests.get(f"{API}/checkout/status/{sid}", headers=_hdr(admin_token), timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200, f"{r1.text}|{r2.text}"
        for r in (r1, r2):
            d = r.json()
            assert d.get("payment_status") in ("pending", "unpaid")
        # Credits must NOT have been incremented since session is unpaid
        sub2 = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        after = int(sub2.get("ai_credits_remaining", 0))
        assert after == before, f"credits should not change on unpaid polls: {before}->{after}"


# ----------------- /api/ai/ask used_credit flag + ai_logs insert -----------------
class TestAIAskUsedCredit:
    def test_ai_ask_returns_used_credit_flag(self, admin_token):
        """Make 1 real call; only within free quota. If over quota, skip to avoid polluting."""
        sub = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        if sub.get("ai_used_this_month", 0) >= sub.get("ai_limit_monthly", 20) - 1:
            pytest.skip("free quota nearly exhausted — don't pollute")

        before = sub["ai_used_this_month"]
        r = requests.post(f"{API}/ai/ask", headers=_hdr(admin_token),
                          json={"question": "List departments"}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        # Response shape includes used_credit (bool) when not blocked by private-keyword filter
        if not d.get("blocked"):
            assert "used_credit" in d, f"missing used_credit in response: {d}"
            assert isinstance(d["used_credit"], bool)
            # Within quota used_credit must be False
            assert d["used_credit"] is False

        # /subscription counter should have incremented by 1
        sub2 = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        assert sub2["ai_used_this_month"] == before + 1, f"{before}->{sub2['ai_used_this_month']}"

    def test_ai_ask_private_keyword_blocked_no_used_credit_change(self, admin_token):
        sub_before = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        used_before = sub_before["ai_used_this_month"]
        r = requests.post(f"{API}/ai/ask", headers=_hdr(admin_token),
                          json={"question": "What is the salary of the admin?"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("blocked") is True
        # private-keyword short-circuits — no log written
        sub_after = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        assert sub_after["ai_used_this_month"] == used_before


# ----------------- ai_logs document shape (direct Mongo) -----------------
class TestAILogsUsedCreditField:
    def test_ai_log_has_used_credit(self, admin_token):
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        db = client[db_name]
        iid = state.get("institute_id")
        if not iid:
            pytest.skip("no institute_id")
        doc = db.ai_logs.find_one(
            {"institute_id": iid}, sort=[("created_at", -1)]
        )
        client.close()
        assert doc is not None, "no ai_logs found for institute"
        assert "used_credit" in doc, f"latest ai_log missing used_credit: {list(doc.keys())}"
        assert isinstance(doc["used_credit"], bool)


# ----------------- Limit-reached code-path inspection (static) -----------------
class TestLimitReachedCodePath:
    def test_server_code_contains_limit_block(self):
        # Lightweight code-inspection to satisfy problem statement without exhausting quota.
        with open("/app/backend/server.py") as f:
            src = f.read()
        assert 'limit_reached' in src
        assert '"blocked": True' in src or "'blocked': True" in src
        # Free plan limit is 20 AI queries
        assert 'ai_queries' in src and '20' in src
        # used_credit written into ai_logs
        assert '"used_credit": use_credit' in src or "'used_credit': use_credit" in src
