import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface Student { name: string; rollNo: string }
interface ClassDoc { _id: string; name: string; durationMinutes: number; students: Student[]; imageUrl?: string }

export default function ModifyClass() {
  const { id } = useParams();
  const nav = useNavigate();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(4);
  const [students, setStudents] = useState<Student[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function setStudent(i: number, patch: Partial<Student>) {
    setStudents((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/classes/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : "" }, cache: 'no-store' });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.message || r.statusText);
        const cls = d.class as ClassDoc;
        setName(cls.name);
        setDuration((cls as any).durationMinutes || 4);
        setStudents((cls.students || []).map(s => ({ name: s.name, rollNo: s.rollNo })));
        setImageUrl(cls.imageUrl || "");
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [id, token]);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const body: any = { name, durationMinutes: duration, students };
      if (imageUrl) body.imageUrl = imageUrl;
      const r = await fetch(`/api/classes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify(body) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      nav(`/classes/${id}`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}`} className="text-sm text-foreground/70 hover:text-foreground">
        <span className="back-arrow">←</span>&nbsp;Back to class
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Modify class</h1>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : (
        <div className="mt-4 grid gap-4 max-w-2xl">
          <div>
            <label className="text-sm">Name</label>
            <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Active session duration (minutes)</label>
            <select className="mt-1 rounded-lg border border-input bg-background px-3 py-2" value={duration} onChange={(e)=>setDuration(Number(e.target.value))}>
              {Array.from({length:10}, (_,i)=>i+1).map(m => (
                <option key={m} value={m}>{m} minute{m>1? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm">Cover image (data URL)</label>
            <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="Paste image data URL or leave blank" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Students</label>
              <button className="text-sm text-foreground/70 hover:text-foreground" onClick={()=>setStudents((prev)=>[...prev, { name: "", rollNo: "" }])}>+ Add student</button>
            </div>
            <div className="space-y-2">
              {students.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="col-span-7 rounded-lg border border-input bg-background px-3 py-2" placeholder="Name" value={s.name} onChange={(e)=>setStudent(i, { name: e.target.value })} />
                  <input className="col-span-4 rounded-lg border border-input bg-background px-3 py-2" placeholder="Roll No." value={s.rollNo} onChange={(e)=>setStudent(i, { rollNo: e.target.value })} />
                  <button className="col-span-1 text-sm text-destructive" onClick={()=>setStudents((prev)=>prev.filter((_, idx)=>idx!==i))}>×</button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button disabled={saving || !name.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" onClick={submit}>{saving? 'Saving…' : 'Save changes'}</button>
            <button className="px-4 py-2 rounded-lg border border-border" onClick={()=>nav(`/classes/${id}`)}>Cancel</button>
          </div>
        </div>
      )}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
