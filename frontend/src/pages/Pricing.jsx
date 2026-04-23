import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Check, ArrowUpRight, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.get("/plans").then(r=>setPlans(r.data)); }, []);

  return (
    <div className="min-h-screen" data-testid="pricing-page">
      <header className="sticky top-0 z-40 glass border-b border-[#E5E1D5]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo size={32}/><span className="font-serif text-2xl font-bold">SWAMEK</span></Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm" data-testid="pricing-signin">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm" data-testid="pricing-register">Start free <ArrowUpRight className="w-4 h-4"/></Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 text-center">
        <div className="overline mb-6">Pricing</div>
        <h1 className="font-serif text-5xl lg:text-6xl font-black tracking-tight">One platform. Three tiers.</h1>
        <p className="text-lg text-[#5C5C5C] mt-6 max-w-2xl mx-auto">Start free for small institutes. Upgrade as your campus grows. Cancel anytime.</p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p, i) => {
            const isPro = p.id === "pro";
            return (
              <div key={p.id} className="card-flat p-10 relative" style={isPro?{background:'#1A362D', color:'#fff'}:{}} data-testid={`plan-${p.id}`}>
                {isPro && <span className="absolute top-0 right-6 -translate-y-1/2 bg-[#D46B4E] text-white text-[11px] px-3 py-1 font-medium tracking-wider uppercase">Most popular</span>}
                <div className="overline" style={isPro?{color:'rgba(255,255,255,0.7)'}:{}}>{p.name}</div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="font-serif text-5xl font-black" style={isPro?{color:'#fff'}:{}}>${p.amount}</span>
                  <span className="text-sm" style={isPro?{color:'rgba(255,255,255,0.7)'}:{color:'#5C5C5C'}}>/{p.interval}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {p.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm" style={isPro?{color:'rgba(255,255,255,0.9)'}:{}}>
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={isPro?{color:'#DDAA55'}:{color:'#1A362D'}}/> {f}
                    </li>
                  ))}
                </ul>
                <Link to={p.id === 'free' ? '/register' : '/login?upgrade=' + p.id}
                  className={`${isPro ? 'inline-flex items-center gap-2 bg-white text-[#1A362D] px-5 py-2.5 font-medium rounded-sm hover:bg-[#F7F5F0]' : 'btn-primary'} mt-10 w-full justify-center`} data-testid={`select-${p.id}`}>
                  {p.id === 'free' ? 'Start free' : `Choose ${p.name}`} <ArrowUpRight className="w-4 h-4"/>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-20 card-flat p-10 text-center bg-[#F7F5F0]">
          <Sparkles className="w-6 h-6 mx-auto text-[#D46B4E]"/>
          <h3 className="font-serif text-3xl font-bold mt-4">Need more? Let's talk.</h3>
          <p className="text-[#5C5C5C] mt-2">Custom SLAs, on-prem deployment, and dedicated success managers — contact sales.</p>
        </div>
      </section>
    </div>
  );
}
