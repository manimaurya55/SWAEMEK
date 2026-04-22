import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Send, X, Sparkles, Zap } from "lucide-react";

export default function AIAssistant({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! I'm the SWAEK assistant. Ask me about your institute — departments, notices, stats. I won't share private info." },
  ]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState(null);

  useEffect(() => {
    api.get("/subscription").then(r=>setSub(r.data)).catch(()=>{});
  }, []);

  const refreshUsage = () => api.get("/subscription").then(r=>setSub(r.data)).catch(()=>{});

  const ask = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q; setQ("");
    setMessages(m=>[...m, {role:"user", text:question}]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/ask", { question });
      setMessages(m=>[...m, {role:"ai", text: data.answer, usedCredit: data.used_credit, limitReached: data.limit_reached}]);
      refreshUsage();
    } catch (e) {
      setMessages(m=>[...m, {role:"ai", text: "Sorry, I couldn't reach the assistant. " + (e.response?.data?.detail || e.message)}]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed bottom-24 right-6 w-96 max-w-[92vw] h-[540px] z-40 glass border border-[#E5E1D5] shadow-2xl flex flex-col" data-testid="ai-widget">
      <div className="p-4 border-b border-[#E5E1D5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#D46B4E] rounded-full"/>
          <div className="font-serif text-lg font-bold">SWAEK Assistant</div>
        </div>
        <button onClick={onClose} data-testid="ai-close-btn"><X className="w-4 h-4"/></button>
      </div>
      {sub && (
        <div className="px-4 py-2 border-b border-[#E5E1D5] text-[11px] text-[#5C5C5C] flex items-center justify-between" data-testid="ai-usage-bar">
          <span>{sub.ai_used_this_month || 0} / {sub.ai_limit_monthly} this month</span>
          {sub.ai_credits_remaining > 0 && <span className="flex items-center gap-1 text-[#1A362D] font-medium"><Zap className="w-3 h-3"/> {sub.ai_credits_remaining} credits</span>}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-fade" data-testid="ai-messages">
        {messages.map((m,i)=>(
          <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            <div className={`max-w-[80%] p-3 text-sm ${m.role==='user'?'bg-[#1A362D] text-white':'bg-[#F7F5F0] text-[#1A1A1A] border border-[#E5E1D5]'}`}>
              {m.role==='ai' && <Sparkles className="w-3 h-3 inline mr-1 text-[#D46B4E]"/>}
              <span className="whitespace-pre-wrap">{m.text}</span>
              {m.usedCredit && <div className="text-[10px] mt-1 text-[#D46B4E] flex items-center gap-1"><Zap className="w-3 h-3"/> Used 1 credit</div>}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-[#5C5C5C]">Thinking…</div>}
      </div>
      <form onSubmit={ask} className="p-3 border-t border-[#E5E1D5] flex gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Ask about the institute…" data-testid="ai-input"/>
        <button disabled={loading} className="btn-primary" data-testid="ai-send-btn"><Send className="w-4 h-4"/></button>
      </form>
    </div>
  );
}
