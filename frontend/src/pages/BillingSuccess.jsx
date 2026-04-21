import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const [state, setState] = useState("checking"); // checking | paid | expired | pending
  const [payload, setPayload] = useState(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) { setState("expired"); return; }
    let cancel = false;

    const poll = async () => {
      if (cancel) return;
      attemptsRef.current += 1;
      if (attemptsRef.current > 15) { setState("pending"); return; }
      try {
        const { data } = await api.get(`/checkout/status/${sid}`);
        setPayload(data);
        if (data.payment_status === "paid") { setState("paid"); return; }
        if (data.status === "expired") { setState("expired"); return; }
        setTimeout(poll, 2000);
      } catch (e) {
        setTimeout(poll, 2500);
      }
    };
    poll();
    return () => { cancel = true; };
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="billing-success-page">
      <div className="max-w-lg w-full card-flat p-12 text-center">
        {state === "checking" && (<>
          <Loader2 className="w-12 h-12 mx-auto text-[#1A362D] animate-spin"/>
          <h1 className="font-serif text-3xl font-bold mt-6">Confirming your payment…</h1>
          <p className="text-[#5C5C5C] mt-3">This usually takes a few seconds.</p>
        </>)}
        {state === "paid" && (<>
          <div className="w-16 h-16 mx-auto bg-[#1A362D] flex items-center justify-center rounded-full"><CheckCircle2 className="w-10 h-10 text-white"/></div>
          <h1 className="font-serif text-4xl font-bold mt-6">Payment successful</h1>
          <p className="text-[#5C5C5C] mt-3">Your institute is now on the <b className="capitalize">{payload?.metadata?.plan_id || 'Pro'}</b> plan.</p>
          {payload?.amount_total != null && <div className="mt-4 text-sm text-[#5C5C5C]">Amount · ${(payload.amount_total/100).toFixed(2)} {payload.currency?.toUpperCase()}</div>}
          <Link to="/dashboard" className="btn-primary mt-10" data-testid="back-to-dashboard-btn">Back to dashboard <ArrowRight className="w-4 h-4"/></Link>
        </>)}
        {state === "expired" && (<>
          <XCircle className="w-12 h-12 mx-auto text-[#B4442A]"/>
          <h1 className="font-serif text-3xl font-bold mt-6">Session expired</h1>
          <p className="text-[#5C5C5C] mt-3">Please try the checkout again.</p>
          <Link to="/dashboard" className="btn-primary mt-10" data-testid="retry-dashboard-btn">Back to dashboard</Link>
        </>)}
        {state === "pending" && (<>
          <Loader2 className="w-12 h-12 mx-auto text-[#5C5C5C]"/>
          <h1 className="font-serif text-3xl font-bold mt-6">Still processing…</h1>
          <p className="text-[#5C5C5C] mt-3">You'll receive an email once confirmed. You can return to the dashboard safely.</p>
          <Link to="/dashboard" className="btn-primary mt-10">Back to dashboard</Link>
        </>)}
      </div>
    </div>
  );
}
