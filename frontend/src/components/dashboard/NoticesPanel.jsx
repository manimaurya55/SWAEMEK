import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function NoticesPanel({ user }) {
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });
  const canPost = ["admin","hod","teacher"].includes(user?.role);
  const load = () => api.get("/notices").then(r=>setNotices(r.data));
  useEffect(load, []);
  const post = async (e) => {
    e.preventDefault();
    try { await api.post("/notices", form); toast.success("Notice posted"); setForm({title:"",body:"",audience:"all"}); load(); }
    catch { toast.error("Failed"); }
  };
  return (
    <div className="space-y-8" data-testid="notices-panel">
      {canPost && (
        <form onSubmit={post} className="card-flat p-8" data-testid="create-notice-form">
          <div className="overline mb-3">Post a notice</div>
          <div className="space-y-4">
            <input placeholder="Title" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} required data-testid="notice-title-input"/>
            <textarea placeholder="Write the notice…" value={form.body} onChange={(e)=>setForm({...form, body:e.target.value})} required rows={4} data-testid="notice-body-input"/>
            <select value={form.audience} onChange={(e)=>setForm({...form, audience:e.target.value})} data-testid="notice-audience-select">
              <option value="all">Everyone</option><option value="teachers">Teachers</option><option value="students">Students</option><option value="parents">Parents</option><option value="hods">HODs</option>
            </select>
          </div>
          <button className="btn-primary mt-4" data-testid="post-notice-btn"><Plus className="w-4 h-4"/> Post notice</button>
        </form>
      )}
      <div className="space-y-6" data-testid="notices-list">
        {notices.length === 0 && <div className="card-flat p-10 text-center text-[#5C5C5C]">No notices yet.</div>}
        {notices.map(n=>(
          <article key={n.id} className="card-flat p-8 border-l-4 border-l-[#D46B4E]" data-testid={`notice-${n.id}`}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-serif text-2xl font-bold">{n.title}</h3>
              <span className="badge-flat">{n.audience}</span>
            </div>
            <p className="text-[#5C5C5C] mt-3 leading-relaxed whitespace-pre-wrap">{n.body}</p>
            <div className="text-xs text-[#5C5C5C] mt-4">— {n.author_name} · {new Date(n.created_at).toLocaleString()}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
