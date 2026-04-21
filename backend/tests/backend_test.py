"""EduCore backend API regression tests (iteration 2).

Adds coverage for:
- Expanded registration (profile fields: roll_no/class_name/section, qualification/
  subjects/experience_years, child_name/child_roll_no)
- Superadmin role (login, /super/* endpoints, block/unblock/delete, 403 for non-super)
- Gallery CRUD
- QR endpoints (profile, institute-join, fee)
- Two-step attendance (sessions -> save draft -> save+end_class -> submit; double-submit 400)
- Messaging /messages/conversations + unread tracking
- Department PATCH with partial body
- Corrected payload shapes: AttendanceSessionIn.class_name, RoomIn.room_number,
  assign-hod path params, mess-entry path param, library/return path param
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


def _reg(email, role, password="Passw0rd!", **extra_fields):
    body = {"email": email, "password": password, "name": f"TEST_{role}_{SUFFIX}",
            "role": role, "institute_code": INSTITUTE_CODE}
    body.update(extra_fields)
    return requests.post(f"{API}/auth/register", json=body, timeout=30)


# ------------- Fixtures -------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    state["admin_id"] = d["user"]["id"]
    state["institute_id"] = d["user"]["institute_id"]
    return d["token"]


@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["role"] == "superadmin"
    return d["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return _hdr(admin_token)


@pytest.fixture(scope="session")
def super_h(super_token):
    return _hdr(super_token)


# ------------- AUTH -------------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_superadmin_role(self, super_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(super_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "superadmin"
        assert d.get("institute_id") is None

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_register_superadmin_forbidden(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"badsuper_{SUFFIX}@x.io", "password": "Pw@1234",
            "name": "x", "role": "superadmin", "institute_code": INSTITUTE_CODE}, timeout=30)
        assert r.status_code == 403

    def test_register_student_expanded(self):
        email = f"test_student_{SUFFIX}@educore.io"
        r = _reg(email, "student", roll_no=f"R{SUFFIX[:3]}", class_name="CS-Sem-3",
                 section="A", date_of_birth="2005-01-01", gender="M",
                 address="123 Main St", emergency_contact="9999999999")
        assert r.status_code in (200, 201), r.text
        d = r.json()
        prof = d["user"].get("profile", {})
        assert prof.get("roll_no") == f"R{SUFFIX[:3]}"
        assert prof.get("class_name") == "CS-Sem-3"
        assert prof.get("section") == "A"
        assert prof.get("date_of_birth") == "2005-01-01"
        state["student_token"] = d["token"]
        state["student_id"] = d["user"]["id"]
        state["student_email"] = email

    def test_register_teacher_expanded(self):
        email = f"test_teacher_{SUFFIX}@educore.io"
        r = _reg(email, "teacher", qualification="M.Tech", subjects=["Math", "Physics"],
                 experience_years=5, designation="Asst. Prof")
        assert r.status_code in (200, 201), r.text
        prof = r.json()["user"].get("profile", {})
        assert prof.get("qualification") == "M.Tech"
        assert prof.get("subjects") == ["Math", "Physics"]
        assert prof.get("experience_years") == 5
        state["teacher_token"] = r.json()["token"]
        state["teacher_id"] = r.json()["user"]["id"]

    def test_register_parent_expanded(self):
        email = f"test_parent_{SUFFIX}@educore.io"
        r = _reg(email, "parent", child_name="Child Name",
                 child_roll_no=f"R{SUFFIX[:3]}")
        assert r.status_code in (200, 201), r.text
        prof = r.json()["user"].get("profile", {})
        assert prof.get("child_name") == "Child Name"
        state["parent_token"] = r.json()["token"]
        state["parent_id"] = r.json()["user"]["id"]

    def test_register_hod(self):
        email = f"test_hod_{SUFFIX}@educore.io"
        r = _reg(email, "hod", qualification="Ph.D")
        assert r.status_code in (200, 201), r.text
        state["hod_token"] = r.json()["token"]
        state["hod_id"] = r.json()["user"]["id"]


# ------------- DEPARTMENTS -------------
class TestDepartments:
    def test_create(self, admin_h):
        r = requests.post(f"{API}/departments", headers=admin_h,
                          json={"name": f"TEST_CS_{SUFFIX}", "code": f"CS{SUFFIX[:3]}"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        state["dept_id"] = r.json()["id"]

    def test_patch_partial(self, admin_h):
        """PATCH with partial body should now work (was 422)."""
        r = requests.patch(f"{API}/departments/{state['dept_id']}", headers=admin_h,
                           json={"name": f"TEST_CS_Updated_{SUFFIX}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert "Updated" in r.json()["name"]

        # GET verify persisted
        r2 = requests.get(f"{API}/departments", headers=admin_h, timeout=30)
        assert any(d["id"] == state["dept_id"] and "Updated" in d["name"] for d in r2.json())

    def test_assign_hod_path(self, admin_h):
        hod_id = state.get("hod_id")
        if not hod_id:
            pytest.skip("no hod")
        # Correct path: POST /departments/{dep_id}/assign-hod/{user_id}
        r = requests.post(f"{API}/departments/{state['dept_id']}/assign-hod/{hod_id}",
                          headers=admin_h, timeout=30)
        assert r.status_code in (200, 204), r.text


# ------------- ATTENDANCE 2-STEP -------------
class TestAttendanceTwoStep:
    def test_full_flow(self):
        tok = state.get("teacher_token")
        if not tok:
            pytest.skip("teacher missing")
        h = _hdr(tok)
        # 1. Create session with class_name
        r = requests.post(f"{API}/attendance/sessions", headers=h, json={
            "department_id": state["dept_id"], "class_name": "CS-Sem-3", "subject": "Math"
        }, timeout=30)
        assert r.status_code in (200, 201), r.text
        sess = r.json()
        assert sess["submitted"] is False
        state["sess_id"] = sess["id"]

        entries = [{"student_id": state["student_id"], "present": True}]

        # 2. Save draft (end_class=False)
        r2 = requests.post(f"{API}/attendance/save", headers=h, json={
            "session_id": sess["id"], "entries": entries, "end_class": False}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["entries_count"] == 1

        # 3. Save with end_class=true
        r3 = requests.post(f"{API}/attendance/save", headers=h, json={
            "session_id": sess["id"], "entries": entries, "end_class": True}, timeout=30)
        assert r3.status_code == 200

        # Verify session not submitted yet
        r4 = requests.get(f"{API}/attendance/sessions", headers=h, timeout=30)
        assert r4.status_code == 200
        our = [s for s in r4.json() if s["id"] == sess["id"]][0]
        assert our["submitted"] is False
        assert our.get("end_time") is not None

        # 4. Submit final
        r5 = requests.post(f"{API}/attendance/submit", headers=h, json={
            "session_id": sess["id"], "entries": entries}, timeout=30)
        assert r5.status_code in (200, 201), r5.text

        # 5. Can't submit twice
        r6 = requests.post(f"{API}/attendance/submit", headers=h, json={
            "session_id": sess["id"], "entries": entries}, timeout=30)
        assert r6.status_code == 400

        # 6. Verify submitted flag persisted
        r7 = requests.get(f"{API}/attendance/sessions", headers=h, timeout=30)
        our2 = [s for s in r7.json() if s["id"] == sess["id"]][0]
        assert our2["submitted"] is True


# ------------- GALLERY -------------
class TestGallery:
    def test_create_list_delete(self, admin_h):
        r = requests.post(f"{API}/gallery", headers=admin_h, json={
            "title": f"TEST_Gallery_{SUFFIX}",
            "image_url": "https://via.placeholder.com/300",
            "caption": "Hello",
            "category": "events",
            "department_id": state.get("dept_id"),
        }, timeout=30)
        assert r.status_code in (200, 201), r.text
        gid = r.json()["id"]
        assert r.json()["category"] == "events"

        # Filter by category
        r2 = requests.get(f"{API}/gallery", headers=admin_h, params={"category": "events"}, timeout=30)
        assert r2.status_code == 200
        assert any(g["id"] == gid for g in r2.json())

        # Filter by department_id
        if state.get("dept_id"):
            r3 = requests.get(f"{API}/gallery", headers=admin_h,
                              params={"department_id": state["dept_id"]}, timeout=30)
            assert r3.status_code == 200
            assert any(g["id"] == gid for g in r3.json())

        # Delete
        r4 = requests.delete(f"{API}/gallery/{gid}", headers=admin_h, timeout=30)
        assert r4.status_code == 200

    def test_student_cannot_post(self):
        tok = state.get("student_token")
        if not tok:
            pytest.skip()
        r = requests.post(f"{API}/gallery", headers=_hdr(tok),
                          json={"title": "x", "image_url": "http://x"}, timeout=30)
        assert r.status_code == 403


# ------------- QR -------------
class TestQR:
    def test_qr_profile(self, admin_h):
        r = requests.get(f"{API}/qr/profile", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["qr"].startswith("data:image/png;base64,")
        assert "unique_id" in d["payload"]
        assert d["payload"]["role"] == "admin"

    def test_qr_institute_join_admin(self, admin_h):
        r = requests.get(f"{API}/qr/institute-join", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["qr"].startswith("data:image/png;base64,")
        assert d["code"] == INSTITUTE_CODE
        assert "register" in d["url"]

    def test_qr_institute_join_student_forbidden(self):
        tok = state.get("student_token")
        if not tok:
            pytest.skip()
        r = requests.get(f"{API}/qr/institute-join", headers=_hdr(tok), timeout=30)
        assert r.status_code == 403

    def test_qr_fee_unpaid(self, admin_h):
        if "student_id" not in state:
            pytest.skip()
        # Create unpaid fee
        r = requests.post(f"{API}/fees", headers=admin_h, json={
            "student_id": state["student_id"], "amount": 1500,
            "description": "TEST_QR_Fee", "due_date": "2026-12-31"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        fid = r.json()["id"]
        state["unpaid_fee_id"] = fid

        r2 = requests.get(f"{API}/qr/fee/{fid}", headers=admin_h, timeout=30)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["qr"].startswith("data:image/png;base64,")
        assert d["upi_payload"].startswith("upi://pay")
        assert d["amount"] == 1500

    def test_qr_fee_paid_rejected(self, admin_h):
        """After paying, /qr/fee should return 400."""
        fid = state.get("unpaid_fee_id")
        if not fid:
            pytest.skip()
        rp = requests.post(f"{API}/fees/{fid}/pay", headers=admin_h,
                           json={"method": "mock"}, timeout=30)
        assert rp.status_code in (200, 201)
        r2 = requests.get(f"{API}/qr/fee/{fid}", headers=admin_h, timeout=30)
        assert r2.status_code == 400


# ------------- MESSAGES -------------
class TestMessages:
    def test_conversations_and_unread(self, admin_h):
        if "teacher_id" not in state:
            pytest.skip()
        # admin sends 2 messages to teacher
        for i in range(2):
            r = requests.post(f"{API}/messages", headers=admin_h,
                              json={"to_user_id": state["teacher_id"],
                                    "body": f"hi-{SUFFIX}-{i}"}, timeout=30)
            assert r.status_code in (200, 201), r.text

        # Teacher fetches conversations
        tok = state["teacher_token"]
        rc = requests.get(f"{API}/messages/conversations", headers=_hdr(tok), timeout=30)
        assert rc.status_code == 200, rc.text
        data = rc.json()
        assert isinstance(data, list)
        admin_conv = next((c for c in data if c["user_id"] == state["admin_id"]), None)
        assert admin_conv is not None
        assert admin_conv["unread"] >= 2
        assert "last_message" in admin_conv and "last_time" in admin_conv
        assert admin_conv["role"] == "admin"

        # Fetch messages with_user=admin => mark as read
        rm = requests.get(f"{API}/messages", headers=_hdr(tok),
                         params={"with_user": state["admin_id"]}, timeout=30)
        assert rm.status_code == 200
        assert len(rm.json()) >= 2

        # Re-check conversations -> unread should be 0
        rc2 = requests.get(f"{API}/messages/conversations", headers=_hdr(tok), timeout=30)
        admin_conv2 = next((c for c in rc2.json() if c["user_id"] == state["admin_id"]), None)
        assert admin_conv2["unread"] == 0


# ------------- SUPERADMIN -------------
class TestSuperAdmin:
    def test_stats(self, super_h):
        r = requests.get(f"{API}/super/stats", headers=super_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("institutes", "users_total", "admins", "hods", "teachers", "students", "parents"):
            assert k in d
        assert d["institutes"] >= 1

    def test_stats_non_super_forbidden(self, admin_h):
        r = requests.get(f"{API}/super/stats", headers=admin_h, timeout=30)
        assert r.status_code == 403

    def test_institutes(self, super_h):
        r = requests.get(f"{API}/super/institutes", headers=super_h, timeout=30)
        assert r.status_code == 200
        items = r.json()
        demo = next((i for i in items if i["code"] == INSTITUTE_CODE), None)
        assert demo is not None
        assert "user_count" in demo
        assert demo["user_count"] >= 1
        state["demo_institute_id"] = demo["id"]

    def test_users(self, super_h):
        r = requests.get(f"{API}/super/users", headers=super_h, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_block_then_register_fails(self, super_h):
        iid = state.get("demo_institute_id")
        if not iid:
            pytest.skip()
        # Create a new test institute to block (avoid breaking demo-admin login)
        # Use the demo institute for block test but unblock immediately
        rb = requests.post(f"{API}/super/institutes/{iid}/block", headers=super_h, timeout=30)
        assert rb.status_code == 200
        # Try to register under blocked institute
        rr = requests.post(f"{API}/auth/register", json={
            "email": f"blocked_{SUFFIX}@x.io", "password": "Pw@1234",
            "name": "x", "role": "student", "institute_code": INSTITUTE_CODE}, timeout=30)
        assert rr.status_code == 403
        assert "blocked" in rr.text.lower()

        # Unblock
        ru = requests.post(f"{API}/super/institutes/{iid}/unblock", headers=super_h, timeout=30)
        assert ru.status_code == 200

    def test_delete_user_by_super(self, super_h):
        # Create a throwaway parent then delete
        email = f"del_parent_{SUFFIX}@x.io"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Pw@1234", "name": "TEST_del",
            "role": "parent", "institute_code": INSTITUTE_CODE,
            "child_name": "K", "child_roll_no": "K1"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        uid_ = r.json()["user"]["id"]
        rd = requests.delete(f"{API}/super/users/{uid_}", headers=super_h, timeout=30)
        assert rd.status_code == 200


# ------------- HOSTEL / MESS (corrected paths) -------------
class TestHostel:
    def test_room_with_room_number(self, admin_h):
        r = requests.post(f"{API}/hostel/rooms", headers=admin_h,
                          json={"room_number": f"R{SUFFIX[:3]}", "capacity": 2, "block": "A"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        state["room_id"] = r.json()["id"]

    def test_mess_entry_path_param(self, admin_h):
        if "student_id" not in state:
            pytest.skip()
        r = requests.post(f"{API}/hostel/mess-entry/{state['student_id']}",
                          headers=admin_h, json={"meal": "lunch"}, timeout=30)
        assert r.status_code in (200, 201), r.text


# ------------- LIBRARY (corrected return path) -------------
class TestLibrary:
    def test_issue_and_return_path(self, admin_h):
        if "student_id" not in state:
            pytest.skip()
        r = requests.post(f"{API}/library/books", headers=admin_h,
                          json={"title": f"TEST_Book_{SUFFIX}", "author": "X", "copies": 3}, timeout=30)
        assert r.status_code in (200, 201), r.text
        book_id = r.json()["id"]

        r2 = requests.post(f"{API}/library/issue", headers=admin_h,
                           json={"book_id": book_id, "student_id": state["student_id"]}, timeout=30)
        assert r2.status_code in (200, 201), r2.text
        issue_id = r2.json().get("id") or r2.json().get("issue_id")
        assert issue_id

        r3 = requests.post(f"{API}/library/return/{issue_id}", headers=admin_h, timeout=30)
        assert r3.status_code in (200, 201, 204), r3.text
