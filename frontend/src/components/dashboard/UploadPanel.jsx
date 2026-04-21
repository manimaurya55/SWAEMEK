import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function UploadPanel() {
  const [file, setFile] = useState(null);
  const [depId, setDepId] = useState("");
  const [deps, setDeps] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get("/departments").then(r=>setDeps(r.data)); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    if (depId) fd.append("department_id", depId);
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/upload/students-pdf", fd, { headers: {'Content-Type':'multipart/form-data'}});
      setResult(data); toast.success(`Parsed ${data.parsed}, created ${data.created}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-6" data-testid="upload-panel">
      <div className="card-flat p-10 max-w-2xl">
        <div className="overline mb-3">Import students from PDF</div>
        <h3 className="font-serif text-3xl font-bold">Upload a student list.</h3>
        <p className="text-[#5C5C5C] mt-3">We'll parse tables in the PDF and create student accounts with a default password.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <select value={depId} onChange={(e)=>setDepId(e.target.value)} data-testid="upload-dept-select">
            <option value="">No department</option>{deps.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="file" accept=".pdf" onChange={(e)=>setFile(e.target.files[0])} data-testid="upload-file-input"/>
          <button disabled={loading || !file} className="btn-primary" data-testid="upload-submit-btn">
            <Upload className="w-4 h-4"/> {loading ? 'Parsing…' : 'Upload & parse'}
          </button>
        </form>
        {result && (
          <div className="mt-6 p-5 bg-[#F7F5F0] border border-[#E5E1D5]" data-testid="upload-result">
            <div className="font-serif text-xl font-bold">Parsed {result.parsed} rows</div>
            <div className="text-sm text-[#5C5C5C] mt-2">Created {result.created} new students · default password <code>{result.default_password}</code></div>
          </div>
        )}
      </div>
    </div>
  );
}
