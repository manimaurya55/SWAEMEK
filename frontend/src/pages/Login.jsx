import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { GraduationCap, ArrowUpRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("admin@educore.io");
  const [password, setPassword] = useState("Admin@123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name}`);
      nav(u.role === "superadmin" ? "/super-admin" : "/dashboard");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" data-testid="login-page">
      <div className="hidden lg:block relative">
        <img src="https://static.prod-images.emergentagent.com/jobs/0189ebdf-8db6-43d6-91e9-f93170f093e5/images/8bbd332c07a677e2ea6de403aa8c441a35a4b9cd87c473822fb8e21e38e16d98.png" alt="campus" className="w-full h-full object-cover"/>
        <div className="absolute inset-0 bg-[#1A362D]/30"/>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="overline text-white/80">EduCore</div>
          <h2 className="font-serif text-5xl font-bold mt-4 leading-tight">A quieter way to run a loud campus.</h2>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 lg:p-16">
        <form onSubmit={onSubmit} className="w-full max-w-md" data-testid="login-form">
          <Link to="/" className="flex items-center gap-2 mb-12" data-testid="login-brand">
            <div className="w-8 h-8 bg-[#1A362D] flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white"/></div>
            <span className="font-serif text-2xl font-bold">EduCore</span>
          </Link>
          <div className="overline mb-4">Sign in</div>
          <h1 className="font-serif text-4xl font-bold tracking-tight">Welcome back.</h1>
          <p className="text-[#5C5C5C] mt-3">Continue managing your institute.</p>

          <div className="mt-10 space-y-5">
            <div>
              <label className="overline block mb-2">Email</label>
              <input value={email} onChange={(e)=>setEmail(e.target.value)} required type="email" data-testid="login-email-input"/>
            </div>
            <div>
              <label className="overline block mb-2">Password</label>
              <input value={password} onChange={(e)=>setPassword(e.target.value)} required type="password" data-testid="login-password-input"/>
            </div>
          </div>

          {err && <div className="mt-4 text-sm text-[#B4442A]" data-testid="login-error">{err}</div>}

          <button disabled={loading} type="submit" className="btn-primary mt-8 w-full justify-center" data-testid="login-submit-btn">
            {loading ? "Signing in…" : <>Sign in <ArrowUpRight className="w-4 h-4"/></>}
          </button>

          <div className="text-sm text-[#5C5C5C] mt-6">
            New institute? <Link to="/register" className="text-[#1A362D] font-medium underline" data-testid="login-to-register">Create account</Link>
          </div>

          <div className="mt-10 p-5 border border-dashed border-[#E5E1D5] text-xs text-[#5C5C5C]">
            <div className="overline mb-2">Demo</div>
            <div>Institute Admin · admin@educore.io / Admin@123 · Code <b>DEMO-EDU</b></div>
            <div className="mt-1">Platform Owner · owner@educore.io / Owner@123</div>
          </div>
        </form>
      </div>
    </div>
  );
}
