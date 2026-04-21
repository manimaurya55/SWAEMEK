import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Play, Send, Save, StopCircle, Edit3 } from "lucide-react";

export default function AttendancePanel({ user }) {
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [entries, setEntries] = useState({});
  const [phase, setPhase] = useState("mark"); // mark -> review -> submitted
  const [form, setForm] = useState({ department_id: "", class_name: "", subject: "" });
  const [myAtt, setMyAtt] = useState(null);

  const isTeacher = user?.role === "teacher" || user?.role === "hod";

  const load = () => {
    api.get("/departments").then(r=>setDepartments(r.data));
    api.get("/attendance/sessions").then(r=>setSessions(r.data));
    if (user?.role === "student") api.get(`/attendance/student/${user.id}`).then(r=>setMyAtt(r.data));
  };
  useEffect(load, [user]);

  const startSession = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/attendance/sessions", form);
      setCurrent(data); setPhase("mark");
      const { data: us } = await api.get("/users", { params: { role: "student", department_id: form.department_id }});
      setStudents(us);
      const init = {}; us.forEach(s => init[s.id] = true);
      setEntries(init);
      toast.success("Session started");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const saveDraft = async () => {
    const payload = { session_id: current.id, entries: students.map(s=>({student_id:s.id, present:!!entries[s.id]})), end_class: false };
    await api.post("/attendance/save", payload);
    toast.success("Draft saved"); load();
  };

  const endClass = async () => {
    const payload = { session_id: current.id, entries: students.map(s=>({student_id:s.id, present:!!entries[s.id]})), end_class: true };
    await api.post("/attendance/save", payload);
    toast.success("Class ended. Review & submit.");
    setPhase("review");
  };

  const finalSubmit = async () => {
    if (!window.confirm("Final submit? You won't be able to edit after this.")) return;
    const payload = { session_id: current.id, entries: students.map(s=>({student_id:s.id, present:!!entries[s.id]})) };
    await api.post("/attendance/submit", payload);
    toast.success("Attendance submitted. Notifications sent.");
    setCurrent(null); setStudents([]); setEntries({}); setPhase("mark"); load();
  };

  const presentCount = students.filter(s=>entries[s.id]).length;

  return (
    <div className="space-y-8" data-testid="attendance-panel">
      {isTeacher && !current && (
        <form onSubmit={startSession} className="card-flat p-8" data-testid="start-session-form">
          <div className="overline mb-3">Start a new class session</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select required value={form.department_id} onChange={(e)=>setForm({...form, department_id:e.target.value})} data-testid="session-dept-select">
              <option value="">Select department</option>
              {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input placeholder="Class (e.g., CS-Sem-3)" value={form.class_name} onChange={(e)=>setForm({...form, class_name:e.target.value})} required data-testid="session-class-input"/>
            <input placeholder="Subject" value={form.subject} onChange={(e)=>setForm({...form, subject:e.target.value})} required data-testid="session-subject-input"/>
          </div>
          <button className="btn-primary mt-4" data-testid="start-session-btn"><Play className="w-4 h-4"/> Start session</button>
        </form>
      )}

      {current && (
        <div className="card-flat p-8" data-testid="active-session">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <div>
              <div className="overline">{phase === "review" ? "Review attendance" : "Live session"}</div>
              <h3 className="font-serif text-2xl font-bold mt-1">{current.subject} · {current.class_name}</h3>
              <div className="text-xs text-[#5C5C5C] mt-1">
                Started {new Date(current.start_time).toLocaleTimeString()}
                {current.end_time && ` · Ended ${new Date(current.end_time).toLocaleTimeString()}`}
              </div>
              <div className="mt-3 flex gap-2">
                <span className="badge-flat">Present · {presentCount}</span>
                <span className="badge-flat">Absent · {students.length - presentCount}</span>
                <span className="badge-flat">Total · {students.length}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {phase === "mark" && (
                <>
                  <button onClick={saveDraft} className="btn-secondary text-sm" data-testid="save-draft-btn"><Save className="w-4 h-4"/> Save draft</button>
                  <button onClick={endClass} className="btn-secondary text-sm" data-testid="end-class-btn"><StopCircle className="w-4 h-4"/> End class</button>
                </>
              )}
              {phase === "review" && (
                <>
                  <button onClick={()=>setPhase("mark")} className="btn-secondary text-sm" data-testid="edit-back-btn"><Edit3 className="w-4 h-4"/> Back to edit</button>
                  <button onClick={finalSubmit} className="btn-primary" data-testid="final-submit-btn"><Send className="w-4 h-4"/> Final submit</button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto scroll-fade">
            {students.length === 0 && <div className="text-[#5C5C5C] text-sm">No students in this department.</div>}
            {students.map(s=>(
              <label key={s.id} className={`flex items-center justify-between p-3 border cursor-pointer hover:bg-[#F7F5F0] transition ${entries[s.id]?'border-[#1A362D] bg-[#F7F5F0]':'border-[#E5E1D5]'}`} data-testid={`att-entry-${s.id}`}>
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[#5C5C5C]">{s.unique_id} {s.profile?.roll_no ? `· Roll ${s.profile.roll_no}` : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${entries[s.id] ? 'text-[#1A362D]' : 'text-[#B4442A]'}`}>{entries[s.id] ? 'Present' : 'Absent'}</span>
                  <input type="checkbox" disabled={phase==="review"} checked={!!entries[s.id]} onChange={(e)=>setEntries({...entries, [s.id]: e.target.checked})} className="!w-5 !h-5" data-testid={`att-check-${s.id}`}/>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {(user?.role === "student") && myAtt && (
        <div className="card-flat p-8" data-testid="my-attendance">
          <div className="overline">Your attendance</div>
          <div className="flex items-end gap-6 mt-3"><div className="font-serif text-5xl font-black">{myAtt.percentage}%</div><div className="text-[#5C5C5C] pb-2">{myAtt.present}/{myAtt.total} classes</div></div>
          <div className="h-3 bg-[#F7F5F0] mt-5"><div className="h-full bg-[#1A362D]" style={{width:`${myAtt.percentage}%`}}/></div>
        </div>
      )}

      <div className="card-flat overflow-hidden" data-testid="sessions-list">
        <table>
          <thead><tr><th>Subject</th><th>Class</th><th>Teacher</th><th>Started</th><th>Status</th></tr></thead>
          <tbody>
            {sessions.length === 0 && <tr><td colSpan={5} className="text-center text-[#5C5C5C] py-10">No sessions yet.</td></tr>}
            {sessions.map(s=>(
              <tr key={s.id}>
                <td className="font-medium">{s.subject}</td>
                <td>{s.class_name}</td>
                <td>{s.teacher_name}</td>
                <td className="text-[#5C5C5C] text-sm">{new Date(s.start_time).toLocaleString()}</td>
                <td><span className={`badge-flat ${s.submitted?'text-[#1A362D]':'text-[#B4442A]'}`}>{s.submitted?'Submitted':(s.end_time?'Ended (pending)':'Active')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
