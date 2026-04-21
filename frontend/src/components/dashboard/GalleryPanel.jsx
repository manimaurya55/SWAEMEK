import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";

const CATEGORIES = ["general","events","sports","department","campus","achievements"];

export default function GalleryPanel({ user }) {
  const [items, setItems] = useState([]);
  const [deps, setDeps] = useState([]);
  const [filterDep, setFilterDep] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [form, setForm] = useState({ title: "", image_url: "", caption: "", category: "general", department_id: "" });
  const canUpload = ["admin","hod","teacher"].includes(user?.role);

  const load = () => {
    const params = {};
    if (filterDep) params.department_id = filterDep;
    if (filterCat) params.category = filterCat;
    api.get("/gallery", { params }).then(r=>setItems(r.data));
  };
  useEffect(()=>{ api.get("/departments").then(r=>setDeps(r.data)); }, []);
  useEffect(load, [filterDep, filterCat]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/gallery", { ...form, department_id: form.department_id || null });
      setForm({ title:"", image_url:"", caption:"", category:"general", department_id:"" });
      toast.success("Added to gallery"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/gallery/${id}`); load(); };

  return (
    <div className="space-y-8" data-testid="gallery-panel">
      {canUpload && (
        <form onSubmit={create} className="card-flat p-8" data-testid="add-gallery-form">
          <div className="overline mb-3">Add to gallery</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Title (e.g., Annual Sports Day 2026)" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} required data-testid="gallery-title-input"/>
            <input placeholder="Image URL (paste from Unsplash / drive link)" value={form.image_url} onChange={(e)=>setForm({...form, image_url:e.target.value})} required data-testid="gallery-url-input"/>
            <input placeholder="Caption (optional)" value={form.caption} onChange={(e)=>setForm({...form, caption:e.target.value})} data-testid="gallery-caption-input"/>
            <div className="grid grid-cols-2 gap-4">
              <select value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})} data-testid="gallery-category-select">
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.department_id} onChange={(e)=>setForm({...form, department_id:e.target.value})} data-testid="gallery-dept-select">
                <option value="">All departments</option>
                {deps.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary mt-4" data-testid="gallery-add-btn"><ImagePlus className="w-4 h-4"/> Add photo</button>
          <div className="text-xs text-[#5C5C5C] mt-3">Tip: Use a direct image URL (ending in .jpg, .png). For local uploads, host via imgur/cloudinary and paste URL.</div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="overline mr-2">Filter</div>
        <select value={filterDep} onChange={(e)=>setFilterDep(e.target.value)} className="!w-auto" data-testid="gallery-filter-dept">
          <option value="">All departments</option>{deps.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className="!w-auto" data-testid="gallery-filter-cat">
          <option value="">All categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="gallery-grid">
        {items.length === 0 && <div className="col-span-full card-flat p-16 text-center text-[#5C5C5C]">No gallery items yet.</div>}
        {items.map(g=>(
          <article key={g.id} className="card-flat overflow-hidden group" data-testid={`gallery-item-${g.id}`}>
            <div className="aspect-[4/3] overflow-hidden bg-[#F7F5F0]">
              <img src={g.image_url} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e)=>{e.target.style.display='none'}}/>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-lg font-bold">{g.title}</h3>
                {canUpload && <button onClick={()=>del(g.id)} className="text-[#B4442A]" data-testid={`delete-gallery-${g.id}`}><Trash2 className="w-4 h-4"/></button>}
              </div>
              {g.caption && <p className="text-sm text-[#5C5C5C] mt-2">{g.caption}</p>}
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="badge-flat">{g.category}</span>
                {g.department_id && <span className="badge-flat">{deps.find(d=>d.id===g.department_id)?.name || 'dept'}</span>}
              </div>
              <div className="text-xs text-[#5C5C5C] mt-3">— {g.uploader_name} · {new Date(g.created_at).toLocaleDateString()}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
