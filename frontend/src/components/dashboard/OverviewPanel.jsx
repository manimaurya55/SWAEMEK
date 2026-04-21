import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Building2, Megaphone, Library, Home, TrendingUp } from "lucide-react";

export default function OverviewPanel({ user, institute }) {
  const [stats, setStats] = useState(null);
  const [att, setAtt] = useState(null);
  useEffect(() => {
    api.get("/institute/stats").then((r)=>setStats(r.data)).catch(()=>{});
    if (user?.role === "student") {
      api.get(`/attendance/student/${user.id}`).then(r=>setAtt(r.data)).catch(()=>{});
    }
  }, [user]);

  const cards = [
    { icon: Users, label: "Students", value: stats?.students ?? "–" },
    { icon: Users, label: "Teachers", value: stats?.teachers ?? "–" },
    { icon: Building2, label: "Departments", value: stats?.departments ?? "–" },
    { icon: Megaphone, label: "Notices", value: stats?.notices ?? "–" },
    { icon: Library, label: "Library Books", value: stats?.books ?? "–" },
    { icon: Home, label: "Hostel Rooms", value: stats?.rooms ?? "–" },
  ];

  return (
    <div className="space-y-10" data-testid="overview-panel">
      <div className="card-flat p-10 bg-gradient-to-br from-white to-[#F7F5F0]">
        <div className="overline">Welcome back</div>
        <h1 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight mt-3">{user?.name}</h1>
        <div className="text-[#5C5C5C] mt-3 text-base">
          <span className="badge-flat">Unique ID · {user?.unique_id}</span>
          <span className="ml-2 badge-flat">Role · {user?.role}</span>
          {institute && <span className="ml-2 badge-flat">Institute · {institute.code}</span>}
        </div>
      </div>

      <div>
        <div className="overline mb-4">Institute at a glance</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map((c,i)=>(
            <div key={i} className="card-flat p-6" data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g,'-')}`}>
              <c.icon className="w-5 h-5 text-[#1A362D]"/>
              <div className="font-serif text-3xl font-bold mt-4">{c.value}</div>
              <div className="text-xs text-[#5C5C5C] mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {user?.role === "student" && att && (
        <div className="card-flat p-8" data-testid="student-attendance-overview">
          <div className="overline">Your attendance</div>
          <div className="flex items-end gap-6 mt-4">
            <div className="font-serif text-6xl font-black text-[#1A362D]">{att.percentage}%</div>
            <div className="text-[#5C5C5C] pb-2">
              <TrendingUp className="w-4 h-4 inline mr-1"/> {att.present} / {att.total} classes attended
            </div>
          </div>
          <div className="h-3 bg-[#F7F5F0] mt-6 rounded-sm overflow-hidden">
            <div className="h-full bg-[#1A362D]" style={{width: `${att.percentage}%`}}/>
          </div>
        </div>
      )}
    </div>
  );
}
