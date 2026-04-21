import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { Shield, LogOut, Building2, Users, Ban, CheckCircle2, Trash2, Search } from "lucide-react";

export default function SuperAdmin() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [institutes, setInstitutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("institutes");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "superadmin") {
      nav("/dashboard");
      return;
    }
    load();
  }, [loading, user]); // eslint-disable-line

  const load = async () => {
    try {
      const [s, i, u] = await Promise.all([
        api.get("/super/stats"), api.get("/super/institutes"), api.get("/super/users"),
      ]);
      setStats(s.data); setInstitutes(i.data); setUsers(u.data);
    } catch (e) { toast.error("Failed to load platform data"); }
  };

  const block = async (id, blocked) => {
    await api.post(`/super/institutes/${id}/${blocked?'unblock':'block'}`);
    toast.success(blocked ? 'Unblocked' : 'Blocked'); load();
  };
  const delInst = async (id) => {
    if (!window.confirm("Delete this institute and ALL its data? This cannot be undone.")) return;
    await api.delete(`/super/institutes/${id}`); toast.success("Deleted"); load();
  };
  const delUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    await api.delete(`/super/users/${id}`); toast.success("Deleted"); load();
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-[#5C5C5C]">Loading…</div>;

  const visibleUsers = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.unique_id||'').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" data-testid="super-admin-page">
      <header className="border-b border-[#E5E1D5] bg-white" data-testid="super-header">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1A362D] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white"/>
            </div>
            <div>
              <div className="overline text-[#D46B4E]">Platform Console</div>
              <div className="font-serif text-xl font-bold">EduCore · Owner</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-[#5C5C5C]">{user.unique_id}</div>
            </div>
            <button onClick={logout} className="btn-secondary text-sm" data-testid="super-logout-btn"><LogOut className="w-4 h-4"/> Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-10 stagger-in">
        <div className="mb-8">
          <div className="overline">Good day, Owner.</div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight mt-2">Platform at a glance.</h1>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { k: "Institutes", v: stats.institutes },
              { k: "Blocked", v: stats.blocked_institutes, color: "text-[#B4442A]" },
              { k: "Total users", v: stats.users_total },
              { k: "Admins", v: stats.admins },
              { k: "Teachers", v: stats.teachers },
              { k: "Students", v: stats.students },
              { k: "Parents", v: stats.parents },
              { k: "HODs", v: stats.hods },
              { k: "Notices", v: stats.notices },
              { k: "Messages", v: stats.messages },
              { k: "AI queries", v: stats.ai_queries, color: "text-[#D46B4E]" },
            ].map((s,i)=>(
              <div key={i} className="card-flat p-5" data-testid={`super-stat-${s.k.toLowerCase().replace(/\s+/g,'-')}`}>
                <div className="overline">{s.k}</div>
                <div className={`font-serif text-3xl font-bold mt-2 ${s.color||''}`}>{s.v}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 flex gap-2 border-b border-[#E5E1D5]">
          {[{id:"institutes", label:"Institutes"}, {id:"users", label:"All Users"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} data-testid={`super-tab-${t.id}`}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${tab===t.id?'border-[#1A362D] text-[#1A362D]':'border-transparent text-[#5C5C5C] hover:text-[#1A362D]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "institutes" && (
          <div className="mt-6 card-flat overflow-hidden" data-testid="institutes-table">
            <table>
              <thead><tr><th>Institute</th><th>Code</th><th>Users</th><th>Students</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {institutes.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[#5C5C5C]">No institutes yet.</td></tr>}
                {institutes.map(i=>(
                  <tr key={i.id} data-testid={`institute-row-${i.code}`}>
                    <td>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-[#5C5C5C]">Since {new Date(i.created_at).toLocaleDateString()}</div>
                    </td>
                    <td><span className="badge-flat">{i.code}</span></td>
                    <td><Users className="w-3 h-3 inline mr-1"/>{i.user_count}</td>
                    <td>{i.student_count}</td>
                    <td><span className={`badge-flat ${i.blocked?'text-[#B4442A]':'text-[#1A362D]'}`}>{i.blocked?'Blocked':'Active'}</span></td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={()=>block(i.id, i.blocked)} className="text-sm underline mr-4" data-testid={`toggle-block-${i.code}`}>
                        {i.blocked ? <><CheckCircle2 className="w-4 h-4 inline"/> Unblock</> : <><Ban className="w-4 h-4 inline"/> Block</>}
                      </button>
                      <button onClick={()=>delInst(i.id)} className="text-[#B4442A]" data-testid={`delete-institute-${i.code}`}><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "users" && (
          <div className="mt-6">
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute top-3 left-3 text-[#5C5C5C]"/>
              <input placeholder="Search users…" value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" data-testid="super-user-search"/>
            </div>
            <div className="card-flat overflow-hidden" data-testid="super-users-table">
              <table>
                <thead><tr><th>Name</th><th>Unique ID</th><th>Email</th><th>Role</th><th>Institute</th><th></th></tr></thead>
                <tbody>
                  {visibleUsers.slice(0,200).map(u=>(
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td><span className="badge-flat">{u.unique_id}</span></td>
                      <td className="text-[#5C5C5C]">{u.email}</td>
                      <td><span className="badge-flat">{u.role}</span></td>
                      <td className="text-sm text-[#5C5C5C]">{institutes.find(i=>i.id===u.institute_id)?.code || '—'}</td>
                      <td className="text-right">
                        {u.role !== 'superadmin' && <button onClick={()=>delUser(u.id)} className="text-[#B4442A]" data-testid={`delete-user-${u.id}`}><Trash2 className="w-4 h-4"/></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-16 card-flat p-8 bg-[#F7F5F0]">
          <div className="overline text-[#D46B4E]">Owner-only notes</div>
          <h3 className="font-serif text-2xl font-bold mt-2">This console controls every institute on the platform.</h3>
          <p className="text-[#5C5C5C] mt-3 leading-relaxed">Blocking an institute freezes new logins & registrations for it. Deleting cascades all departments, users, notices. Use with care.</p>
        </div>
      </main>
    </div>
  );
}
