import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Check, Crown, Zap, Sparkles, TrendingUp } from "lucide-react";

export default function BillingPanel({ user }) {
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(null);
  const canManage = user?.role === "admin";

  useEffect(() => {
    api.get("/plans").then(r=>setPlans(r.data));
    api.get("/subscription").then(r=>setSub(r.data)).catch(()=>{});
  }, []);

  const upgrade = async (planId) => {
    if (!canManage) { toast.error("Only Institute Admin can change plan"); return; }
    setLoading(planId);
    try {
      const { data } = await api.post("/checkout/session", {
        plan_id: planId,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start checkout");
      setLoading(null);
    }
  };

  const currentPlan = sub?.plan_id || "free";
  const iconFor = (id) => id === "pro" ? Zap : id === "enterprise" ? Crown : Sparkles;

  return (
    <div className="space-y-8" data-testid="billing-panel">
      <div className="card-flat p-8 bg-gradient-to-br from-white to-[#F7F5F0]">
        <div className="overline">Current plan</div>
        <div className="flex items-end gap-4 mt-2 flex-wrap">
          <h2 className="font-serif text-4xl font-bold capitalize">{currentPlan}</h2>
          {sub?.amount != null && currentPlan !== "free" && (
            <div className="text-[#5C5C5C] pb-2">${sub.amount}/{plans.find(p=>p.id===currentPlan)?.interval || 'month'}</div>
          )}
          <span className="badge-flat ml-auto" data-testid="current-plan-badge">{sub?.status || 'active'}</span>
        </div>
        {sub?.current_period_end && (
          <div className="text-sm text-[#5C5C5C] mt-3">
            <TrendingUp className="w-3 h-3 inline mr-1"/> Renews {new Date(sub.current_period_end).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="plans-grid">
        {plans.map(p => {
          const Icon = iconFor(p.id);
          const isCurrent = currentPlan === p.id;
          const isPro = p.id === "pro";
          return (
            <div key={p.id} className="card-flat p-8 relative" style={isPro?{background:'#1A362D', color:'#fff'}:{}} data-testid={`billing-plan-${p.id}`}>
              {isCurrent && <span className="absolute top-0 right-6 -translate-y-1/2 bg-[#D46B4E] text-white text-[11px] px-3 py-1 uppercase tracking-wider">Current</span>}
              <Icon className="w-5 h-5" style={isPro?{color:'#DDAA55'}:{color:'#1A362D'}}/>
              <div className="overline mt-4" style={isPro?{color:'rgba(255,255,255,0.7)'}:{}}>{p.name}</div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-serif text-4xl font-black" style={isPro?{color:'#fff'}:{}}>${p.amount}</span>
                <span className="text-xs" style={isPro?{color:'rgba(255,255,255,0.7)'}:{color:'#5C5C5C'}}>/{p.interval}</span>
              </div>
              <ul className="mt-6 space-y-2">
                {p.features.map((f,i)=>(
                  <li key={i} className="flex items-start gap-2 text-sm" style={isPro?{color:'rgba(255,255,255,0.9)'}:{}}>
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={isPro?{color:'#DDAA55'}:{color:'#1A362D'}}/> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className={`mt-8 text-center text-xs ${isPro?'text-white/60':'text-[#5C5C5C]'}`}>You're on this plan</div>
              ) : p.id === "free" ? (
                <div className="mt-8 text-center text-xs text-[#5C5C5C]">Downgrade via support</div>
              ) : (
                <button onClick={()=>upgrade(p.id)} disabled={loading===p.id || !canManage}
                  className={`${isPro ? 'bg-white text-[#1A362D] hover:bg-[#F7F5F0]' : 'bg-[#1A362D] text-white hover:bg-[#264F42]'} px-5 py-2.5 w-full mt-8 font-medium rounded-sm disabled:opacity-50`}
                  data-testid={`upgrade-${p.id}-btn`}>
                  {loading===p.id ? 'Redirecting…' : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!canManage && (
        <div className="card-flat p-6 text-sm text-[#5C5C5C]">Only Institute Admin can change the subscription plan.</div>
      )}
    </div>
  );
}
