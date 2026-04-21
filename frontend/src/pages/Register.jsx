import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { GraduationCap, ArrowUpRight } from "lucide-react";

const ROLES = [
  { id: "admin", label: "Institute Admin", hint: "Create or manage your institute" },
  { id: "hod", label: "HOD", hint: "Head of department" },
  { id: "teacher", label: "Teacher", hint: "Take classes & attendance" },
  { id: "student", label: "Student", hint: "View attendance, fees, marks" },
  { id: "parent", label: "Parent", hint: "Track your child" },
];

function Field({ label, children }) {
  return (<div><label className="overline block mb-2">{label}</label>{children}</div>);
}

export default function Register() {
  const [form, setForm] = useState({
    role: "admin", name: "", email: "", password: "", phone: "",
    institute_name: "", institute_code: "DEMO-EDU",
    date_of_birth: "", gender: "", address: "", emergency_contact: "",
    roll_no: "", class_name: "", section: "",
    qualification: "", subjects: "", experience_years: "",
    designation: "", child_name: "", child_roll_no: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const code = params.get("institute_code");
    if (code) {
      setForm((f) => ({ ...f, institute_code: code, role: f.role === "admin" ? "student" : f.role }));
      toast.success(`Joining institute ${code}`);
    }
    // eslint-disable-next-line
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const payload = {
      role: form.role, name: form.name, email: form.email, password: form.password,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null, gender: form.gender || null,
      address: form.address || null, emergency_contact: form.emergency_contact || null,
    };
    if (form.role === "admin" && form.institute_name) payload.institute_name = form.institute_name;
    else payload.institute_code = form.institute_code;

    if (form.role === "student") Object.assign(payload, { roll_no: form.roll_no, class_name: form.class_name, section: form.section });
    if (["teacher","hod"].includes(form.role)) Object.assign(payload, {
      qualification: form.qualification, experience_years: form.experience_years ? parseInt(form.experience_years) : null,
    });
    if (form.role === "teacher") payload.subjects = form.subjects;
    if (["hod","admin"].includes(form.role)) payload.designation = form.designation;
    if (form.role === "parent") Object.assign(payload, { child_name: form.child_name, child_roll_no: form.child_roll_no });

    try {
      const u = await register(payload);
      toast.success(`Account created. Your ID: ${u.unique_id}`);
      nav("/dashboard");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen" data-testid="register-page">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-10">
        <Link to="/" className="flex items-center gap-2 mb-10" data-testid="register-brand">
          <div className="w-8 h-8 bg-[#1A362D] flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white"/></div>
          <span className="font-serif text-2xl font-bold">EduCore</span>
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="overline mb-4">Create account</div>
            <h1 className="font-serif text-5xl font-bold tracking-tight leading-tight">Join the campus.</h1>
            <p className="text-[#5C5C5C] mt-4 leading-relaxed">Pick your role. Every user receives a unique verified ID. Admins can also create a brand-new institute.</p>
            <div className="mt-10 space-y-3">
              {ROLES.map((r) => (
                <button key={r.id} type="button" onClick={()=>setF("role", r.id)} data-testid={`register-role-${r.id}`}
                  className={`w-full text-left p-4 border transition ${form.role===r.id ? 'border-[#1A362D] bg-white' : 'border-[#E5E1D5] bg-transparent hover:bg-white'}`}>
                  <div className="font-serif text-base font-semibold">{r.label}</div>
                  <div className="text-xs text-[#5C5C5C] mt-1">{r.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="lg:col-span-8 card-flat p-10" data-testid="register-form">
            <div className="overline mb-3">Basic details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Full name"><input value={form.name} onChange={(e)=>setF("name", e.target.value)} required data-testid="register-name-input"/></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e)=>setF("email", e.target.value)} required data-testid="register-email-input"/></Field>
              <Field label="Password"><input type="password" value={form.password} onChange={(e)=>setF("password", e.target.value)} required minLength={6} data-testid="register-password-input"/></Field>
              <Field label="Phone"><input value={form.phone} onChange={(e)=>setF("phone", e.target.value)} data-testid="register-phone-input"/></Field>
              <Field label="Date of birth"><input type="date" value={form.date_of_birth} onChange={(e)=>setF("date_of_birth", e.target.value)} data-testid="register-dob-input"/></Field>
              <Field label="Gender">
                <select value={form.gender} onChange={(e)=>setF("gender", e.target.value)} data-testid="register-gender-select">
                  <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Address"><input value={form.address} onChange={(e)=>setF("address", e.target.value)} data-testid="register-address-input"/></Field></div>
              <Field label="Emergency contact"><input value={form.emergency_contact} onChange={(e)=>setF("emergency_contact", e.target.value)} data-testid="register-emergency-input"/></Field>
            </div>

            <div className="overline mt-8 mb-3">Institute</div>
            {form.role === 'admin' ? (
              <div className="space-y-4">
                <Field label="New institute name (leave blank to join existing)"><input value={form.institute_name} onChange={(e)=>setF("institute_name", e.target.value)} placeholder="e.g., Oakridge University" data-testid="register-institute-name-input"/></Field>
                <Field label="Or existing institute code"><input value={form.institute_code} onChange={(e)=>setF("institute_code", e.target.value)} data-testid="register-institute-code-input"/></Field>
              </div>
            ) : (
              <Field label="Institute code">
                <input value={form.institute_code} onChange={(e)=>setF("institute_code", e.target.value)} required data-testid="register-institute-code-input"/>
                <div className="text-xs text-[#5C5C5C] mt-2">Demo: <code>DEMO-EDU</code></div>
              </Field>
            )}

            {/* Role specific */}
            {form.role === "student" && (
              <>
                <div className="overline mt-8 mb-3">Student details</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <Field label="Roll No"><input value={form.roll_no} onChange={(e)=>setF("roll_no", e.target.value)} data-testid="register-roll-input"/></Field>
                  <Field label="Class"><input value={form.class_name} onChange={(e)=>setF("class_name", e.target.value)} placeholder="e.g., 12th or Sem 3" data-testid="register-class-input"/></Field>
                  <Field label="Section"><input value={form.section} onChange={(e)=>setF("section", e.target.value)} data-testid="register-section-input"/></Field>
                </div>
              </>
            )}
            {(form.role === "teacher" || form.role === "hod") && (
              <>
                <div className="overline mt-8 mb-3">Professional details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Highest qualification"><input value={form.qualification} onChange={(e)=>setF("qualification", e.target.value)} placeholder="M.Sc, Ph.D, etc." data-testid="register-qualification-input"/></Field>
                  <Field label="Experience (years)"><input type="number" min="0" value={form.experience_years} onChange={(e)=>setF("experience_years", e.target.value)} data-testid="register-experience-input"/></Field>
                  {form.role === "teacher" && <div className="sm:col-span-2"><Field label="Subjects (comma-separated)"><input value={form.subjects} onChange={(e)=>setF("subjects", e.target.value)} placeholder="Mathematics, Physics" data-testid="register-subjects-input"/></Field></div>}
                  {form.role === "hod" && <div className="sm:col-span-2"><Field label="Designation"><input value={form.designation} onChange={(e)=>setF("designation", e.target.value)} placeholder="Head of Department" data-testid="register-designation-input"/></Field></div>}
                </div>
              </>
            )}
            {form.role === "admin" && (
              <>
                <div className="overline mt-8 mb-3">Admin profile</div>
                <Field label="Designation"><input value={form.designation} onChange={(e)=>setF("designation", e.target.value)} placeholder="Principal, Director, Chairman…" data-testid="register-designation-input"/></Field>
              </>
            )}
            {form.role === "parent" && (
              <>
                <div className="overline mt-8 mb-3">Child details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Child's name"><input value={form.child_name} onChange={(e)=>setF("child_name", e.target.value)} required data-testid="register-child-name-input"/></Field>
                  <Field label="Child's roll no"><input value={form.child_roll_no} onChange={(e)=>setF("child_roll_no", e.target.value)} data-testid="register-child-roll-input"/></Field>
                </div>
              </>
            )}

            {err && <div className="mt-5 text-sm text-[#B4442A]" data-testid="register-error">{err}</div>}

            <button disabled={loading} className="btn-primary mt-8 w-full justify-center" data-testid="register-submit-btn">
              {loading ? 'Creating account…' : <>Create account <ArrowUpRight className="w-4 h-4"/></>}
            </button>

            <div className="text-sm text-[#5C5C5C] mt-6">
              Already have an account? <Link to="/login" className="text-[#1A362D] font-medium underline" data-testid="register-to-login">Sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
