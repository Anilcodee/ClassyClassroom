import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface ClassItem { id: string; name: string; joinCode: string; isActive: boolean; }
interface NewStudent { name: string; rollNo: string }

export default function Classes() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/classes", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || (res.status === 401 ? "Please log in" : "Failed to load"));
      setClasses(data.classes.map((c: any) => ({ id: c._id, name: c.name, joinCode: c.joinCode, isActive: c.isActive })));
    } catch (e: any) {
      setError(e.message || "Network error");
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
                    <p className="text-xs text-foreground/60 flex items-center gap-2">
                      <span>Join code:</span>
                      <span className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80">{c.joinCode}</span>
                      <button
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-accent hover:text-accent-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          const code = c.joinCode;
                          navigator.clipboard.writeText(code).then(() => {
                            toast({ title: "Copied", description: "Join code copied to clipboard" });
                          }).catch(async () => {
                            try {
                              const ta = document.createElement("textarea");
                              ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                              toast({ title: "Copied", description: "Join code copied to clipboard" });
                            } catch {
                              toast({ title: "Could not copy", description: code });
                            }
                          });
                        }}
                        title="Copy join code"
                      >
                        Copy
                      </button>
                    </p>
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
            <p className="text-sm text-foreground/70 mb-3">Download PDF list (all days) for a specific class.</p>
            <div className="space-y-2">
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
                value={selectedId}
                onChange={(e)=>setSelectedId(e.target.value)}
              >
                <option value="">Select a class…</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                className="w-full px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground text-sm disabled:opacity-50"
                disabled={!selectedId}
                onClick={async ()=>{
                  const token = localStorage.getItem('token');
                  const headers: Record<string,string> = {};
                  if (token) headers.Authorization = `Bearer ${token}`;
                  const res = await fetch(`/api/classes/${selectedId}/attendance/pdf/all`, { headers });
                  if (!res.ok) { alert('Failed to download'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `attendance-all-days.pdf`;
                  a.click(); URL.revokeObjectURL(url);
                }}
              >
                Download PDF list (all days)
              </button>
            </div>
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
            <label className="px-4 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer">
              Import spreadsheet (CSV)
              <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
                if (rows.length === 0) return;
                // Try to detect header
                let start = 0; let nameIdx = 0; let rollIdx = 1;
                const first = rows[0].split(",").map(c=>c.trim().toLowerCase());
                if (first.some(h => h.includes("name")) || first.some(h => h.includes("roll"))) {
                  nameIdx = first.findIndex(h => h.includes("name"));
                  rollIdx = first.findIndex(h => h.includes("roll"));
                  start = 1;
                }
                const parsed = [] as { name: string; rollNo: string }[];
                for (let i=start;i<rows.length;i++) {
                  const cols = rows[i].split(",").map(c=>c.trim());
                  const n = cols[nameIdx] || cols[0];
                  const r = cols[rollIdx] || cols[1];
                  if (n && r) parsed.push({ name: n, rollNo: r });
                }
                setStudents((prev) => [...prev.filter(s=>s.name||s.rollNo), ...parsed]);
              }} />
            </label>
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
