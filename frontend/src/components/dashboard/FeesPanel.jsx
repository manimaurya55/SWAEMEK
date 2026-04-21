import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, CreditCard, QrCode, X } from "lucide-react";

export default function FeesPanel({ user }) {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ student_id: "", amount: "", description: "", due_date: "" });
  const [qrFee, setQrFee] = useState(null);
  const [qrData, setQrData] = useState(null);
  const canCreate = ["admin","hod"].includes(user?.role);
  const load = () => {
    api.get("/fees").then(r=>setFees(r.data));
    if (canCreate) api.get("/users", {params:{role:"student"}}).then(r=>setStudents(r.data));
  };
  useEffect(load, []);
  const create = async (e) => {
    e.preventDefault();
    await api.post("/fees", { ...form, amount: parseFloat(form.amount) });
    setForm({student_id:"",amount:"",description:"",due_date:""}); toast.success("Fee created"); load();
  };
  const pay = async (id) => {
    const { data } = await api.post(`/fees/${id}/pay`);
    toast.success(`Paid · ${data.transaction_id}`); setQrFee(null); load();
  };
  const showQr = async (f) => {
    setQrFee(f); setQrData(null);
    try {
      const { data } = await api.get(`/qr/fee/${f.id}`);
      setQrData(data);
    } catch (e) { toast.error("Could not generate QR"); }
  };
  const total = fees.reduce((a,f)=>a+f.amount,0);
  const pending = fees.filter(f=>!f.paid).reduce((a,f)=>a+f.amount,0);
  return (
    <div className="space-y-8" data-testid="fees-panel">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-flat p-6"><div className="overline">Total</div><div className="font-serif text-4xl font-bold mt-3">₹{total.toLocaleString()}</div></div>
        <div className="card-flat p-6"><div className="overline">Pending</div><div className="font-serif text-4xl font-bold mt-3 text-[#B4442A]">₹{pending.toLocaleString()}</div></div>
        <div className="card-flat p-6"><div className="overline">Paid</div><div className="font-serif text-4xl font-bold mt-3 text-[#1A362D]">₹{(total-pending).toLocaleString()}</div></div>
      </div>
      {canCreate && (
        <form onSubmit={create} className="card-flat p-8" data-testid="create-fee-form">
          <div className="overline mb-3">Create fee invoice</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select required value={form.student_id} onChange={(e)=>setForm({...form, student_id:e.target.value})} data-testid="fee-student-select">
              <option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" min="0" placeholder="Amount (₹)" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} required data-testid="fee-amount-input"/>
            <input placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} required data-testid="fee-desc-input"/>
            <input type="date" value={form.due_date} onChange={(e)=>setForm({...form, due_date:e.target.value})} data-testid="fee-due-input"/>
          </div>
          <button className="btn-primary mt-4" data-testid="create-fee-btn"><Plus className="w-4 h-4"/> Create</button>
        </form>
      )}
      <div className="card-flat overflow-hidden">
        <table data-testid="fees-table">
          <thead><tr><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {fees.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-[#5C5C5C]">No fees yet.</td></tr>}
            {fees.map(f=>(
              <tr key={f.id}>
                <td className="font-medium">{f.description}</td>
                <td>₹{f.amount.toLocaleString()}</td>
                <td className="text-[#5C5C5C] text-sm">{f.due_date || '—'}</td>
                <td><span className={`badge-flat ${f.paid?'text-[#1A362D]':'text-[#B4442A]'}`}>{f.paid?'Paid':'Pending'}</span></td>
                <td className="text-right space-x-2">
                  {!f.paid && (
                    <button onClick={()=>showQr(f)} className="text-xs underline" data-testid={`qr-${f.id}`}><QrCode className="w-3 h-3 inline"/> Pay via QR</button>
                  )}
                  {!f.paid && user?.role==="student" && f.student_id===user?.id && (
                    <button onClick={()=>pay(f.id)} className="btn-primary text-xs" data-testid={`pay-${f.id}`}><CreditCard className="w-3 h-3"/> Pay now</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qrFee && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={()=>setQrFee(null)}>
          <div className="bg-white max-w-md w-full p-8 text-center" onClick={e=>e.stopPropagation()} data-testid="qr-modal">
            <button onClick={()=>setQrFee(null)} className="absolute" style={{top:10, right:10}}><X className="w-4 h-4"/></button>
            <div className="overline">Scan & pay</div>
            <h3 className="font-serif text-2xl font-bold mt-2">{qrFee.description}</h3>
            <div className="text-3xl font-serif font-black mt-2 text-[#1A362D]">₹{qrFee.amount.toLocaleString()}</div>
            {qrData ? (
              <img src={qrData.qr} alt="QR" className="w-64 h-64 mx-auto mt-6 border border-[#E5E1D5]"/>
            ) : <div className="text-sm text-[#5C5C5C] my-20">Generating QR…</div>}
            <div className="text-xs text-[#5C5C5C] mt-4">Scan with any UPI app to pay</div>
            {user?.role === "student" && qrFee.student_id === user.id && (
              <button onClick={()=>pay(qrFee.id)} className="btn-primary w-full justify-center mt-6" data-testid="qr-mark-paid-btn"><CreditCard className="w-4 h-4"/> I've paid (mark complete)</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
