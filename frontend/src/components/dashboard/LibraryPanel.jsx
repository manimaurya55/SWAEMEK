import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, BookOpen } from "lucide-react";

export default function LibraryPanel({ user }) {
  const [books, setBooks] = useState([]);
  const [issued, setIssued] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", copies: 1 });
  const [issueModal, setIssueModal] = useState(null);
  const canEdit = ["admin","hod","teacher"].includes(user?.role);

  const load = () => {
    api.get("/library/books").then(r=>setBooks(r.data));
    api.get("/library/issued").then(r=>setIssued(r.data));
    if (canEdit) api.get("/users", {params:{role:"student"}}).then(r=>setStudents(r.data));
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/library/books", { ...form, copies: parseInt(form.copies) });
    setForm({title:"",author:"",isbn:"",copies:1}); toast.success("Book added"); load();
  };
  const issue = async (sid) => {
    try { await api.post("/library/issue", { book_id: issueModal.id, student_id: sid }); toast.success("Issued"); setIssueModal(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const ret = async (id) => { await api.post(`/library/return/${id}`); toast.success("Returned"); load(); };

  return (
    <div className="space-y-8" data-testid="library-panel">
      {canEdit && (
        <form onSubmit={create} className="card-flat p-8" data-testid="create-book-form">
          <div className="overline mb-3">Add book</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input placeholder="Title" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} required data-testid="book-title-input"/>
            <input placeholder="Author" value={form.author} onChange={(e)=>setForm({...form, author:e.target.value})} required data-testid="book-author-input"/>
            <input placeholder="ISBN" value={form.isbn} onChange={(e)=>setForm({...form, isbn:e.target.value})} data-testid="book-isbn-input"/>
            <input type="number" min="1" placeholder="Copies" value={form.copies} onChange={(e)=>setForm({...form, copies:e.target.value})} data-testid="book-copies-input"/>
          </div>
          <button className="btn-primary mt-4" data-testid="add-book-btn"><Plus className="w-4 h-4"/> Add book</button>
        </form>
      )}

      <div className="card-flat overflow-hidden">
        <div className="p-4 overline border-b border-[#E5E1D5]">Catalogue</div>
        <table data-testid="books-table">
          <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Available</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {books.map(b=>(
              <tr key={b.id} data-testid={`book-${b.id}`}>
                <td className="font-medium">{b.title}</td><td>{b.author}</td><td className="text-[#5C5C5C]">{b.isbn||'—'}</td>
                <td>{b.available} / {b.copies}</td>
                {canEdit && <td className="text-right"><button onClick={()=>setIssueModal(b)} disabled={b.available<=0} className="text-sm underline disabled:opacity-40" data-testid={`issue-book-${b.id}`}><BookOpen className="w-4 h-4 inline"/> Issue</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="p-4 overline border-b border-[#E5E1D5]">Issued books</div>
        <table data-testid="issued-table">
          <thead><tr><th>Book</th><th>Issued</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {issued.length === 0 && <tr><td colSpan={4} className="text-center text-[#5C5C5C] py-8">No records.</td></tr>}
            {issued.map(i=>(
              <tr key={i.id}>
                <td className="font-medium">{i.book_title}</td>
                <td className="text-[#5C5C5C] text-sm">{new Date(i.issued_at).toLocaleDateString()}</td>
                <td><span className="badge-flat">{i.returned?'Returned':'Issued'}</span></td>
                {canEdit && <td className="text-right">{!i.returned && <button onClick={()=>ret(i.id)} className="text-sm underline" data-testid={`return-${i.id}`}>Return</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issueModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={()=>setIssueModal(null)}>
          <div className="bg-white max-w-md w-full p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-serif text-xl font-bold mb-4">Issue "{issueModal.title}"</h3>
            <div className="max-h-64 overflow-y-auto">
              {students.map(s=>(
                <button key={s.id} onClick={()=>issue(s.id)} className="w-full text-left p-3 border-b border-[#E5E1D5] hover:bg-[#F7F5F0]">
                  <div className="font-medium">{s.name}</div><div className="text-xs text-[#5C5C5C]">{s.unique_id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
