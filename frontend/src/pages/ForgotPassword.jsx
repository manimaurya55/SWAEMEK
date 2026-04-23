import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { formatApiErrorDetail } from "@/lib/api";
import Logo from "@/components/Logo";
import { ArrowUpRight, Copy } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setResult(data);
      toast.success("Reset link generated");
    } catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setLoading(false); }
  };

  const copyToken = () => { navigator.clipboard.writeText(result.token); toast.success("Copied"); };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-10"><Logo size={32}/><span className="font-serif text-2xl font-bold">SWAMEK</span></Link>
        <div className="overline mb-3">Forgot password</div>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Reset your password.</h1>
        <p className="text-[#5C5C5C] mt-3">Enter your email. We'll generate a reset token (dev mode — shown on screen).</p>

        {!result ? (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="overline block mb-2">Email</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required data-testid="forgot-email-input"/>
            </div>
            {err && <div className="text-sm text-[#B4442A]" data-testid="forgot-error">{err}</div>}
            <button disabled={loading} className="btn-primary w-full justify-center" data-testid="forgot-submit-btn">
              {loading ? 'Sending…' : <>Send reset link <ArrowUpRight className="w-4 h-4"/></>}
            </button>
          </form>
        ) : (
          <div className="mt-8 card-flat p-6" data-testid="forgot-result">
            <div className="overline">Your reset token</div>
            <div className="mt-3 p-3 bg-[#F7F5F0] border border-[#E5E1D5] font-mono text-xs break-all" data-testid="reset-token">
              {result.token || '(sent via email in production)'}
            </div>
            {result.token && (
              <button onClick={copyToken} className="btn-secondary text-xs mt-3" data-testid="copy-token-btn"><Copy className="w-3 h-3"/> Copy</button>
            )}
            <p className="text-sm text-[#5C5C5C] mt-4">Token valid for 1 hour.</p>
            <Link to={`/reset-password${result.token ? `?token=${result.token}` : ''}`} className="btn-primary mt-6 w-full justify-center" data-testid="to-reset-link">Continue to reset <ArrowUpRight className="w-4 h-4"/></Link>
          </div>
        )}
        <div className="text-sm text-[#5C5C5C] mt-6"><Link to="/login" className="underline" data-testid="back-to-login">Back to sign in</Link></div>
      </div>
    </div>
  );
}
