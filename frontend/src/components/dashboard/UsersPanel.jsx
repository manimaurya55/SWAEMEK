import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  useEffect(() => { api.get("/users").then(r=>setUsers(r.data)); }, []);
  const visible = filter === "all" ? users : users.filter(u=>u.role===filter);
  return (
    <div className="space-y-6" data-testid="users-panel">
      <div className="flex flex-wrap gap-2">
        {["all","admin","hod","teacher","student","parent"].map(r=>(
          <button key={r} onClick={()=>setFilter(r)} data-testid={`filter-${r}`}
            className={`px-4 py-2 text-sm border transition ${filter===r ? 'bg-[#1A362D] text-white border-[#1A362D]' : 'border-[#E5E1D5] bg-white hover:bg-[#F7F5F0]'}`}>{r}</button>
        ))}
      </div>
      <div className="card-flat overflow-hidden">
        <table data-testid="users-table">
          <thead><tr><th>Name</th><th>Unique ID</th><th>Email</th><th>Role</th><th>Phone</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="text-center text-[#5C5C5C] py-10">No users.</td></tr>}
            {visible.map(u=>(
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="font-medium">{u.name}</td>
                <td><span className="badge-flat">{u.unique_id}</span></td>
                <td className="text-[#5C5C5C]">{u.email}</td>
                <td><span className="badge-flat">{u.role}</span></td>
                <td className="text-[#5C5C5C]">{u.phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
