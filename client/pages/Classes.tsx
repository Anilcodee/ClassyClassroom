import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import React from "react";
import { toast } from "@/hooks/use-toast";

interface ClassItem { id: string; name: string; joinCode: string; isActive: boolean; imageUrl?: string }
interface NewStudent { name: string; rollNo: string }

export default function Classes() {
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [showCodeFor, setShowCodeFor] = React.useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/classes", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || (res.status === 401 ? "Please log in" : "Failed to load"));
      setClasses(data.classes.map((c: any) => ({ id: c._id, name: c.name, joinCode: c.joinCode, isActive: c.isActive, imageUrl: c.imageUrl })));
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  React.React.useEffect(() => { void load(); }, []);

  const [imagePickFor, setImagePickFor] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handlePickedFile(file: File, classId: string) {
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/classes/${classId}/image`, { method: "PATCH", headers, body: JSON.stringify({ imageUrl: dataUrl }) });
      const d = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(d?.message || res.statusText);
      toast({ title: "Image added" });
      await load();
    } catch (e: any) {
      toast({ title: "Failed to add image", description: e.message || "" });
    } finally {
      setImagePickFor(null);
      if ((fileRef as any).current) (fileRef as any).current.value = "";
    }
  }

  return (
    <main className="container mx-auto py-10">
      <input ref={fileRef as any} type="file" accept="image/*" className="hidden" onChange={(e)=>{
        const f = e.target.files?.[0];
        if (!f || !imagePickFor) return;
        void handlePickedFile(f, imagePickFor);
      }} />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <MakeClassCard onCreated={load} />
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
        <div className="md:col-span-3">
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
                <li
                  key={c.id}
                  className="rounded-xl border border-border hover:bg-accent cursor-pointer overflow-hidden relative"
                  onClick={() => (window.location.href = `/classes/${c.id}`)}
                  style={{ minHeight: "10rem" }}
>
                  {!c.imageUrl && (
                    <button
                      className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded-md border border-border bg-background/80 hover:bg-accent"
                      onClick={(e)=>{ e.stopPropagation(); setImagePickFor(c.id); (fileRef as any).current?.click(); }}
                      title="Add image"
                    >
                      + Add image
                    </button>
                  )}
                  {c.imageUrl ? (
                    <div className="w-full h-28 md:h-40">
                      <img src={c.imageUrl} alt="Class cover" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-28 md:h-40 bg-muted/50" />
                  )}
                  <div className="p-5">
                    <p className="font-medium">{c.name}</p>
                    <div className="mt-2 text-xs text-foreground/60 flex items-center gap-2">
                      <span className="relative inline-flex items-center">
                        <button
                          className="p-1 rounded border border-border hover:bg-accent group"
                          onClick={(e) => {
                            e.stopPropagation();
                            const code = c.joinCode;
                            navigator.clipboard.writeText(code).then(() => {
                              toast({ title: "Copied", description: "Join code copied" });
                            }).catch(() => {
                              try {
                                const ta = document.createElement("textarea");
                                ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                                toast({ title: "Copied", description: "Join code copied" });
                              } catch {}
                            });
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setShowCodeFor(c.id);
                          }}
                          onMouseLeave={() => setShowCodeFor("")}
                          title="Copy join code"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        {showCodeFor === c.id && (
                          <span className="absolute left-full ml-2 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80 shadow">
                            {c.joinCode}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <span className={"absolute top-2 right-2 text-xs px-2 py-1 rounded-full " + (c.isActive ? "bg-green-600 text-white" : "bg-muted text-foreground/70")}>{c.isActive ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function MakeClassCard({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [coverDataUrl, setCoverDataUrl] = React.useState<string>("");
  const [students, setStudents] = React.useState<NewStudent[]>([{ name: "", rollNo: "" }]);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function setStudent(i: number, patch: Partial<NewStudent>) {
    setStudents((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const token = localStorage.getItem("token");
      const body = { name, imageUrl: coverDataUrl || undefined, students: students.filter(s => s.name && s.rollNo) };
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText || "Failed to create");
      setOpen(false); setName(""); setCoverDataUrl(""); setStudents([{ name: "", rollNo: "" }]);
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
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Cover image</label>
            <input
              type="file"
              accept="image/*"
              className="rounded-lg border border-input bg-background px-3 py-2"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) { setCoverDataUrl(""); return; }
                const reader = new FileReader();
                reader.onload = () => setCoverDataUrl(String(reader.result || ""));
                reader.readAsDataURL(f);
              }}
            />
            {coverDataUrl && (
              <div className="h-32 w-full rounded-lg overflow-hidden border border-border">
                <img src={coverDataUrl} alt="Cover preview" className="w-full h-full object-cover" />
              </div>
            )}
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
