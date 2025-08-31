import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface ClassItem { id: string; name: string; joinCode: string; isActive: boolean; }
interface NewStudent { name: string; rollNo: string }

export default function Classes() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/classes", { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load");
      setClasses(data.classes.map((c: any) => ({ id: c._id, name: c.name, joinCode: c.joinCode, isActive: c.isActive })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <main className="container mx-auto py-10">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <MakeClassCard onCreated={load} />
          <h2 className="mt-8 mb-3 text-lg font-semibold">Your classes</h2>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-foreground/70">No classes yet. Create one to get started.</p>
          ) : (
            <ul className="space-y-3">
              {classes.map((c) => (
                <li key={c.id} className="rounded-xl border border-border p-4 flex items-center justify-between hover:bg-accent cursor-pointer" onClick={() => (window.location.href = `/classes/${c.id}`)}>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-foreground/60">Join code: {c.joinCode}</p>
                  </div>
                  <span className={"text-xs px-2 py-1 rounded-full " + (c.isActive ? "bg-green-600 text-white" : "bg-muted text-foreground/70")}>{c.isActive ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="md:col-span-1">
          <div className="rounded-2xl border border-border p-5 bg-card shadow">
            <h3 className="font-semibold mb-2">Downloads</h3>
            <p className="text-sm text-foreground/70 mb-3">View PDFs generated for each day and class.</p>
            <Link to="#" className="inline-block px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground text-sm">Open PDF list</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function MakeClassCard({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [students, setStudents] = useState<NewStudent[]>([{ name: "", rollNo: "" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setStudent(i: number, patch: Partial<NewStudent>) {
    setStudents((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const token = localStorage.getItem("token");
      const body = { name, students: students.filter(s => s.name && s.rollNo) };
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText || "Failed to create");
      setOpen(false); setName(""); setStudents([{ name: "", rollNo: "" }]);
      await onCreated();
    } catch (e: any) {
      setErr(e.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-6 bg-card shadow">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Make your class</h2>
          <p className="text-foreground/70 mt-1">Name it, add students manually, via join link, or import a spreadsheet.</p>
          <div className="mt-4 flex gap-3">
            <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">Create class</button>
            <button disabled className="px-4 py-2 rounded-lg border border-border text-foreground/50 cursor-not-allowed">Import spreadsheet (soon)</button>
          </div>
        </div>
        <div className="w-48 h-48 relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-400/30 to-brand-700/30 blur-2xl" />
          <TeacherLoop />
        </div>
      </div>

      {open && (
        <div className="mt-6 border-t border-border pt-6">
          <div className="grid gap-3">
            <label className="text-sm">Class name</label>
            <input className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics 101" />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Students</label>
              <button className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setStudents((s) => [...s, { name: "", rollNo: "" }])}>+ Add student</button>
            </div>
            <div className="space-y-2">
              {students.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="col-span-7 rounded-lg border border-input bg-background px-3 py-2" placeholder="Name" value={s.name} onChange={(e) => setStudent(i, { name: e.target.value })} />
                  <input className="col-span-4 rounded-lg border border-input bg-background px-3 py-2" placeholder="Roll No." value={s.rollNo} onChange={(e) => setStudent(i, { rollNo: e.target.value })} />
                  <button className="col-span-1 text-sm text-destructive" onClick={() => setStudents((prev)=> prev.filter((_, idx) => idx !== i))}>×</button>
                </div>
              ))}
            </div>
          </div>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-4 flex gap-3">
            <button disabled={saving || !name} onClick={submit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving ? "Creating…" : "Create"}</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherLoop() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <circle cx="100" cy="100" r="80" className="fill-[hsl(var(--muted))]" />
      <g>
        <rect x="60" y="120" width="80" height="40" rx="8" className="fill-[hsl(var(--accent))]" />
        <circle cx="120" cy="80" r="10" className="fill-[hsl(var(--brand-600))]">
          <animate attributeName="cy" values="80;70;80" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
