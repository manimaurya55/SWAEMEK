import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";

export default function DepartmentsPanel({ user }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [users, setUsers] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);

  const load = () => {
    api.get("/departments").then(r=>setList(r.data));
    api.get("/users").then(r=>setUsers(r.data));
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/departments", form);
      toast.success("Department created");
      setForm({ name: "", code: "", description: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete department?")) return;
    await api.delete(`/departments/${id}`); load();
  };

  const assignHod = async (userId) => {
    await api.post(`/departments/${assignTarget}/assign-hod/${userId}`);
    toast.success("HOD assigned"); setAssignTarget(null); load();
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8" data-testid="departments-panel">
      {isAdmin && (
        <form onSubmit={create} className="card-flat p-8" data-testid="create-department-form">
          <div className="overline mb-3">Create department</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="Name (e.g., Computer Science)" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} required data-testid="dept-name-input"/>
            <input placeholder="Code (e.g., CS)" value={form.code} onChange={(e)=>setForm({...form, code:e.target.value})} required data-testid="dept-code-input"/>
            <input placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} data-testid="dept-desc-input"/>
          </div>
          <button className="btn-primary mt-4" data-testid="dept-create-btn"><Plus className="w-4 h-4"/> Add department</button>
        </form>
      )}

      <div className="card-flat overflow-hidden">
        <table data-testid="departments-table">
          <thead><tr><th>Name</th><th>Code</th><th>HOD</th><th>Description</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="text-center text-[#5C5C5C] py-10">No departments yet.</td></tr>}
            {list.map(d => {
              const hod = users.find(u=>u.id===d.hod_id);
              return (
                <tr key={d.id} data-testid={`dept-row-${d.code}`}>
                  <td className="font-medium">{d.name}</td>
                  <td><span className="badge-flat">{d.code}</span></td>
                  <td>{hod ? hod.name : <span className="text-[#5C5C5C]">Unassigned</span>}</td>
                  <td className="text-[#5C5C5C] text-sm">{d.description}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <button onClick={()=>setAssignTarget(d.id)} className="text-sm underline mr-4" data-testid={`assign-hod-${d.code}`}><UserPlus className="w-4 h-4 inline"/> Assign HOD</button>
                      <button onClick={()=>del(d.id)} className="text-[#B4442A]" data-testid={`delete-dept-${d.code}`}><Trash2 className="w-4 h-4"/></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assignTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={()=>setAssignTarget(null)}>
          <div className="bg-white max-w-md w-full p-6" onClick={(e)=>e.stopPropagation()}>
            <h3 className="font-serif text-xl font-bold mb-4">Assign HOD</h3>
            <div className="max-h-64 overflow-y-auto">
              {users.filter(u=>["teacher","hod"].includes(u.role)).map(u=>(
                <button key={u.id} onClick={()=>assignHod(u.id)} className="w-full text-left p-3 border-b border-[#E5E1D5] hover:bg-[#F7F5F0]">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-[#5C5C5C]">{u.email} · {u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
