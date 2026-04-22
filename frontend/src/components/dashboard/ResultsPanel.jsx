import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Send, GraduationCap, Award } from "lucide-react";

export default function ResultsPanel({ user }) {
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ student_id: "", subject: "", exam_name: "", term: "", marks: "", total_marks: 100, remarks: "" });
  const [selected, setSelected] = useState({});
  const canCreate = ["teacher","hod","admin"].includes(user?.role);
  const canPublish = ["hod","admin"].includes(user?.role);

  const load = () => {
    api.get("/results").then(r=>setResults(r.data));
    if (canCreate) api.get("/users", {params:{role:"student"}}).then(r=>setStudents(r.data));
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/results", { ...form, marks: parseFloat(form.marks), total_marks: parseFloat(form.total_marks || 100) });
      setForm({ student_id: "", subject: "", exam_name: "", term: "", marks: "", total_marks: 100, remarks: "" });
      toast.success("Result recorded"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const togglePublish = async (publish) => {
    const ids = Object.keys(selected).filter(k=>selected[k]);
    if (ids.length === 0) { toast.error("Select at least one result"); return; }
    await api.post("/results/publish", { result_ids: ids, publish });
    setSelected({}); toast.success(publish ? "Published — students notified" : "Unpublished"); load();
  };

  return (
    <div className="space-y-8" data-testid="results-panel">
      {canCreate && (
        <form onSubmit={create} className="card-flat p-8" data-testid="create-result-form">
          <div className="overline mb-3">Record a result</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select required value={form.student_id} onChange={(e)=>setForm({...form, student_id:e.target.value})} data-testid="result-student-select">
              <option value="">Select student</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.name} {s.profile?.roll_no?`(${s.profile.roll_no})`:''}</option>)}
            </select>
            <input placeholder="Subject (e.g., Maths)" value={form.subject} onChange={(e)=>setForm({...form, subject:e.target.value})} required data-testid="result-subject-input"/>
            <input placeholder="Exam name (e.g., Mid-term)" value={form.exam_name} onChange={(e)=>setForm({...form, exam_name:e.target.value})} required data-testid="result-exam-input"/>
            <input placeholder="Term (optional)" value={form.term} onChange={(e)=>setForm({...form, term:e.target.value})} data-testid="result-term-input"/>
            <input type="number" step="0.5" placeholder="Marks obtained" value={form.marks} onChange={(e)=>setForm({...form, marks:e.target.value})} required data-testid="result-marks-input"/>
            <input type="number" step="0.5" placeholder="Total marks" value={form.total_marks} onChange={(e)=>setForm({...form, total_marks:e.target.value})} data-testid="result-total-input"/>
            <div className="md:col-span-3">
              <input placeholder="Remarks (optional)" value={form.remarks} onChange={(e)=>setForm({...form, remarks:e.target.value})} data-testid="result-remarks-input"/>
            </div>
          </div>
          <button className="btn-primary mt-4" data-testid="create-result-btn"><Plus className="w-4 h-4"/> Save result</button>
        </form>
      )}

      {canPublish && Object.values(selected).some(Boolean) && (
        <div className="card-flat p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-[#5C5C5C]">{Object.values(selected).filter(Boolean).length} selected</div>
          <div className="flex gap-2">
            <button onClick={()=>togglePublish(true)} className="btn-primary text-sm" data-testid="publish-btn"><Send className="w-4 h-4"/> Publish selected</button>
            <button onClick={()=>togglePublish(false)} className="btn-secondary text-sm" data-testid="unpublish-btn">Unpublish</button>
          </div>
        </div>
      )}

      <div className="card-flat overflow-hidden">
        <table data-testid="results-table">
          <thead>
            <tr>
              {canPublish && <th className="w-10"></th>}
              <th>Student</th><th>Subject</th><th>Exam</th><th>Marks</th><th>%</th><th>Grade</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && <tr><td colSpan={canPublish?8:7} className="text-center py-10 text-[#5C5C5C]">No results yet.</td></tr>}
            {results.map(r=>(
              <tr key={r.id} data-testid={`result-${r.id}`}>
                {canPublish && <td><input type="checkbox" checked={!!selected[r.id]} onChange={(e)=>setSelected({...selected, [r.id]: e.target.checked})} className="!w-4 !h-4" data-testid={`select-result-${r.id}`}/></td>}
                <td className="font-medium">{r.student_name}{r.student_roll?` · ${r.student_roll}`:''}</td>
                <td>{r.subject}</td>
                <td><span className="badge-flat">{r.exam_name}{r.term?` · ${r.term}`:''}</span></td>
                <td>{r.marks} / {r.total_marks}</td>
                <td className="font-serif">{r.percentage}%</td>
                <td><span className="badge-flat text-[#1A362D] font-bold"><Award className="w-3 h-3 inline"/> {r.grade}</span></td>
                <td><span className={`badge-flat ${r.published?'text-[#1A362D]':'text-[#B4442A]'}`}>{r.published?'Published':'Draft'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {user?.role === "student" && results.length > 0 && (
        <div className="card-flat p-8 bg-gradient-to-br from-white to-[#F7F5F0]" data-testid="student-results-summary">
          <div className="overline"><GraduationCap className="w-3 h-3 inline mr-1"/> Summary</div>
          <div className="flex items-end gap-6 mt-3">
            <div className="font-serif text-5xl font-black">{Math.round(results.reduce((a,r)=>a+r.percentage,0)/results.length)}%</div>
            <div className="text-[#5C5C5C] pb-2">average across {results.length} subjects</div>
          </div>
        </div>
      )}
    </div>
  );
}
