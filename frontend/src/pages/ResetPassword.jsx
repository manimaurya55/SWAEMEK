import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { formatApiErrorDetail } from "@/lib/api";
import Logo from "@/components/Logo";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => { const t = params.get("token"); if (t) setToken(t); }, [params]);

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (pw !== pw2) { setErr("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      toast.success("Password reset successfully. Please sign in.");
      nav("/login");
    } catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-10"><Logo size={32}/><span className="font-serif text-2xl font-bold">SWAEK</span></Link>
        <div className="overline mb-3">Reset password</div>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Set a new password.</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="overline block mb-2">Token</label>
            <input value={token} onChange={(e)=>setToken(e.target.value)} required data-testid="reset-token-input"/>
          </div>
          <div>
            <label className="overline block mb-2">New password</label>
            <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} required minLength={6} data-testid="reset-pw-input"/>
          </div>
          <div>
            <label className="overline block mb-2">Confirm password</label>
            <input type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} required minLength={6} data-testid="reset-pw2-input"/>
          </div>
          {err && <div className="text-sm text-[#B4442A]" data-testid="reset-error">{err}</div>}
          <button disabled={loading} className="btn-primary w-full justify-center" data-testid="reset-submit-btn">
            {loading ? 'Resetting…' : <>Reset password <ArrowUpRight className="w-4 h-4"/></>}
          </button>
        </form>
        <div className="text-sm text-[#5C5C5C] mt-6"><Link to="/login" className="underline">Back to sign in</Link></div>
      </div>
    </div>
  );
}
