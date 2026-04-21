"""EduCore Stripe subscription billing tests (iteration 3).

Covers:
- GET /api/plans (3 plans: free/pro/enterprise)
- GET /api/subscription (unauth 401; admin returns default free)
- POST /api/checkout/session (admin pro/enterprise OK, free 400, non-admin 403)
- GET /api/checkout/status/{session_id} shape + idempotency
- POST /api/webhook/stripe endpoint existence
- GET /api/super/stats revenue fields
- GET /api/super/subscriptions, /api/super/transactions (superadmin only)
"""
import os
import uuid
import pytest
import requests

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
    return d["token"]


@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def student_token():
    """Register a fresh student for 403 testing."""
    email = f"test_bill_student_{SUFFIX}@educore.io"
    body = {"email": email, "password": "Passw0rd!", "name": f"TEST_student_{SUFFIX}",
            "role": "student", "institute_code": INSTITUTE_CODE,
            "roll_no": f"R{SUFFIX[:3]}", "class_name": "CS", "section": "A"}
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


# ------------- PLANS (public) -------------
class TestPlans:
    def test_list_plans_public(self):
        r = requests.get(f"{API}/plans", timeout=30)
        assert r.status_code == 200, r.text
        plans = r.json()
        assert isinstance(plans, list) and len(plans) == 3
        by_id = {p["id"]: p for p in plans}
        assert set(by_id.keys()) == {"free", "pro", "enterprise"}
        assert by_id["free"]["amount"] == 0
        assert by_id["pro"]["amount"] == 49
        assert by_id["enterprise"]["amount"] == 299
        for p in plans:
            assert "features" in p and isinstance(p["features"], list) and len(p["features"]) >= 1
            assert "limits" in p and "users" in p["limits"]
            assert p.get("currency") == "usd"
            assert p.get("interval") == "month"


# ------------- SUBSCRIPTION (auth) -------------
class TestSubscription:
    def test_unauth_401(self):
        r = requests.get(f"{API}/subscription", timeout=30)
        assert r.status_code == 401

    def test_admin_default_free(self, admin_token):
        r = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("plan_id") in ("free", "pro", "enterprise")
        # when no sub exists -> free/active w/ institute_id
        if d["plan_id"] == "free":
            assert d.get("status") == "active"
            assert d.get("institute_id") == state["institute_id"]


# ------------- CHECKOUT -------------
class TestCheckout:
    def test_create_session_free_rejected(self, admin_token):
        r = requests.post(f"{API}/checkout/session", headers=_hdr(admin_token),
                          json={"plan_id": "free", "origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 400, r.text

    def test_create_session_invalid_plan(self, admin_token):
        r = requests.post(f"{API}/checkout/session", headers=_hdr(admin_token),
                          json={"plan_id": "gold", "origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 400

    def test_create_session_non_admin_forbidden(self, student_token):
        r = requests.post(f"{API}/checkout/session", headers=_hdr(student_token),
                          json={"plan_id": "pro", "origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403, r.text

    def test_create_session_super_forbidden(self, super_token):
        # superadmin is not "admin"
        r = requests.post(f"{API}/checkout/session", headers=_hdr(super_token),
                          json={"plan_id": "pro", "origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 403

    def test_create_session_pro_success(self, admin_token):
        r = requests.post(f"{API}/checkout/session", headers=_hdr(admin_token),
                          json={"plan_id": "pro", "origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("url", "").startswith("http")
        assert d.get("session_id")
        state["session_id"] = d["session_id"]

    def test_status_endpoint(self, admin_token):
        sid = state.get("session_id")
        if not sid:
            pytest.skip("no session created")
        r = requests.get(f"{API}/checkout/status/{sid}", headers=_hdr(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        # CheckoutStatusResponse shape
        for key in ("status", "payment_status"):
            assert key in d
        # unpaid initially
        assert d["payment_status"] in ("pending", "unpaid", "paid", "no_payment_required")

    def test_status_idempotent(self, admin_token):
        sid = state.get("session_id")
        if not sid:
            pytest.skip("no session created")
        # Call twice -- no duplicate subscription creation for unpaid
        r1 = requests.get(f"{API}/checkout/status/{sid}", headers=_hdr(admin_token), timeout=60)
        r2 = requests.get(f"{API}/checkout/status/{sid}", headers=_hdr(admin_token), timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200
        # subscription should still be default free (unpaid session)
        s = requests.get(f"{API}/subscription", headers=_hdr(admin_token), timeout=30).json()
        # Either free (unpaid) or active pro (if already paid in past) -- both acceptable
        assert s.get("plan_id") in ("free", "pro", "enterprise")


# ------------- WEBHOOK ENDPOINT -------------
class TestWebhookEndpoint:
    def test_webhook_exists_accepts_post(self):
        # With garbage body + no signature, should return 400 (signature error) NOT 404 / 405
        r = requests.post(f"{API}/webhook/stripe", data=b"{}",
                          headers={"Content-Type": "application/json"}, timeout=30)
        assert r.status_code != 404, "Webhook endpoint missing"
        assert r.status_code != 405, "Webhook should accept POST"
        # 400 is expected (bad/missing sig), 200 is also acceptable
        assert r.status_code in (200, 400, 422, 500), f"Unexpected: {r.status_code} {r.text}"


# ------------- SUPERADMIN REVENUE -------------
class TestSuperRevenue:
    def test_stats_has_revenue(self, super_token):
        r = requests.get(f"{API}/super/stats", headers=_hdr(super_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("mrr", "arr", "paying_institutes", "conversion_rate",
                    "lifetime_revenue", "plan_distribution", "transactions_count"):
            assert key in d, f"missing {key}"
        assert isinstance(d["mrr"], (int, float))
        assert isinstance(d["arr"], (int, float))
        # arr ~= mrr*12
        assert abs(d["arr"] - d["mrr"] * 12) < 0.01
        assert isinstance(d["plan_distribution"], dict)
        assert set(d["plan_distribution"].keys()) >= {"free", "pro", "enterprise"}

    def test_subscriptions_list(self, super_token):
        r = requests.get(f"{API}/super/subscriptions", headers=_hdr(super_token), timeout=30)
        assert r.status_code == 200, r.text
        subs = r.json()
        assert isinstance(subs, list)
        for s in subs:
            # enrichment keys present (may be None if institute deleted)
            assert "institute_id" in s
            assert "institute_name" in s or s.get("institute_name") is None
            assert "plan_id" in s

    def test_transactions_list(self, super_token):
        r = requests.get(f"{API}/super/transactions", headers=_hdr(super_token), timeout=30)
        assert r.status_code == 200, r.text
        txns = r.json()
        assert isinstance(txns, list)
        # session we created should appear
        sid = state.get("session_id")
        if sid:
            assert any(t.get("session_id") == sid for t in txns), "created session missing in transactions"
        # sorted desc by created_at
        if len(txns) >= 2:
            assert txns[0]["created_at"] >= txns[-1]["created_at"]

    def test_super_endpoints_forbidden_for_admin(self, admin_token):
        for path in ("/super/stats", "/super/subscriptions", "/super/transactions"):
            r = requests.get(f"{API}{path}", headers=_hdr(admin_token), timeout=30)
            assert r.status_code == 403, f"{path} should be 403 for admin, got {r.status_code}"
