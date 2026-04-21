import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Utensils } from "lucide-react";

export default function HostelPanel({ user }) {
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ room_number: "", capacity: 2, block: "A" });
  const [messToday, setMessToday] = useState(0);
  const canEdit = ["admin","hod"].includes(user?.role);

  const load = () => {
    api.get("/hostel/rooms").then(r=>setRooms(r.data));
    api.get("/users", {params:{role:"student"}}).then(r=>setStudents(r.data));
    api.get("/hostel/mess-count").then(r=>setMessToday(r.data.today));
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/hostel/rooms", { ...form, capacity: parseInt(form.capacity) });
    setForm({ room_number:"", capacity:2, block:"A" }); toast.success("Room added"); load();
  };

  const allocate = async (roomId, studentId) => {
    try { await api.post("/hostel/allocate", { room_id: roomId, student_id: studentId }); toast.success("Allocated"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const addMess = async (sid) => {
    await api.post(`/hostel/mess-entry/${sid}`); toast.success("Mess entry added"); load();
  };

  return (
    <div className="space-y-8" data-testid="hostel-panel">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-flat p-6"><div className="overline">Total rooms</div><div className="font-serif text-4xl font-bold mt-3">{rooms.length}</div></div>
        <div className="card-flat p-6"><div className="overline">Occupied beds</div><div className="font-serif text-4xl font-bold mt-3">{rooms.reduce((a,r)=>a+(r.occupants?.length||0),0)}</div></div>
        <div className="card-flat p-6"><div className="overline flex items-center gap-2"><Utensils className="w-3 h-3"/> Mess today</div><div className="font-serif text-4xl font-bold mt-3">{messToday}</div></div>
      </div>

      {canEdit && (
        <form onSubmit={create} className="card-flat p-8" data-testid="create-room-form">
          <div className="overline mb-3">Add room</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="Room # (e.g., 101)" value={form.room_number} onChange={(e)=>setForm({...form, room_number:e.target.value})} required data-testid="room-number-input"/>
            <input type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={(e)=>setForm({...form, capacity:e.target.value})} required data-testid="room-capacity-input"/>
            <input placeholder="Block" value={form.block} onChange={(e)=>setForm({...form, block:e.target.value})} data-testid="room-block-input"/>
          </div>
          <button className="btn-primary mt-4" data-testid="create-room-btn"><Plus className="w-4 h-4"/> Add room</button>
        </form>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="rooms-grid">
        {rooms.map(r=>{
          const full = (r.occupants?.length||0) >= r.capacity;
          return (
            <div key={r.id} className={`card-flat p-5 ${full?'bg-[#F7F5F0]':''}`} data-testid={`room-${r.room_number}`}>
              <div className="overline">Block {r.block}</div>
              <div className="font-serif text-2xl font-bold mt-1">Room {r.room_number}</div>
              <div className="text-sm text-[#5C5C5C] mt-2">{r.occupants?.length||0} / {r.capacity} beds</div>
              <div className="h-1.5 bg-[#E5E1D5] mt-3"><div className="h-full bg-[#1A362D]" style={{width: `${((r.occupants?.length||0)/r.capacity)*100}%`}}/></div>
              {canEdit && !full && (
                <select onChange={(e)=>{ if(e.target.value) allocate(r.id, e.target.value); e.target.value=""; }} className="mt-3 text-xs" data-testid={`allocate-${r.room_number}`}>
                  <option value="">Allocate student…</option>
                  {students.filter(s=>!rooms.some(rr=>rr.occupants?.includes(s.id))).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="card-flat p-8">
          <div className="overline mb-3">Mess entry today</div>
          <div className="flex flex-wrap gap-2">
            {students.slice(0,30).map(s=>(
              <button key={s.id} onClick={()=>addMess(s.id)} className="btn-secondary text-xs" data-testid={`mess-${s.id}`}>{s.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
