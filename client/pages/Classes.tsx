import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import React from "react";
import { toast } from "@/hooks/use-toast";
import { MoreVertical } from "lucide-react";

interface ClassItem { id: string; name: string; joinCode: string; isActive: boolean; imageUrl?: string }
interface NewStudent { name: string; rollNo: string }

export default function Classes() {
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [latestMap, setLatestMap] = React.useState<Record<string, { latestAt: number | null; latestBy: string | null }>>({});
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const userId = userRaw ? (JSON.parse(userRaw)?.id || null) : null;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [archived, setArchived] = React.useState<ClassItem[]>([]);
  const [archMenuFor, setArchMenuFor] = React.useState<string>("");
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [showCodeFor, setShowCodeFor] = React.useState<string>("");
  const [menuOpenFor, setMenuOpenFor] = React.useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/classes", { headers, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || (res.status === 401 ? "Please log in" : "Failed to load"));
      const list = data.classes.map((c: any) => ({ id: c._id, name: c.name, joinCode: c.joinCode, isActive: c.isActive, imageUrl: c.imageUrl }));
      setClasses(list);
      // latest map
      const results = await Promise.allSettled(list.map((c: any) => fetch(`/api/classes/${c.id}/messages?latest=1`, { headers }).then(r => r.json().catch(()=>({}))).then(d => ({ id: c.id, latestAt: d?.latestAt ? new Date(d.latestAt).getTime() : null, latestBy: d?.latestBy ? String(d.latestBy) : null }))));
      const map: Record<string, { latestAt: number | null; latestBy: string | null }> = {};
      results.forEach(r => { if (r.status === 'fulfilled') map[(r.value as any).id] = { latestAt: (r.value as any).latestAt, latestBy: (r.value as any).latestBy }; });
      setLatestMap(map);
      // archived list
      const ar = await fetch('/api/classes/archived', { headers, cache: 'no-store' });
      const ad = await ar.json().catch(()=>({}));
      if (ar.ok) setArchived((ad.classes||[]).map((c:any)=> ({ id: c._id, name: c.name, joinCode: '', isActive: false, imageUrl: c.imageUrl })));
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void load(); }, []);

  const [imagePickFor, setImagePickFor] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [showActiveOnly, setShowActiveOnly] = React.useState(false);

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
      // Optimistically update UI
      setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, imageUrl: dataUrl } : c)));
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
        if (f.size > 2 * 1024 * 1024) {
          toast({ title: "Image too large", description: "Please select an image under 2MB." });
          (fileRef as any).current && ((fileRef as any).current.value = "");
          return;
        }
        void handlePickedFile(f, imagePickFor);
      }} />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <MakeClassCard onCreated={load} />
        </div>
        <aside className="md:col-span-1 space-y-5 self-start">
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

          <div className="rounded-2xl border border-border p-5 bg-card shadow">
            <h3 className="font-semibold mb-2">Archived classes</h3>
            {archived.length === 0 ? (
              <p className="text-sm text-foreground/70">No archived classes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {archived.map((c)=> (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="truncate">{c.name}</span>
                    <div className="relative">
                      <button
                        className="p-1 rounded hover:bg-accent"
                        onClick={() => setArchMenuFor(archMenuFor === c.id ? "" : c.id)}
                        title="More"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {archMenuFor === c.id && (
                        <div className="absolute right-0 top-6 z-20 w-40 rounded-md border border-border bg-background shadow">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={async ()=>{
                              try {
                                const token = localStorage.getItem('token');
                                const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                                if (token) headers.Authorization = `Bearer ${token}`;
                                const res = await fetch(`/api/classes/${c.id}/unarchive`, { method: 'PATCH', headers });
                                const d = await res.json().catch(()=>({}));
                                if (!res.ok) throw new Error(d?.message || res.statusText);
                                setArchMenuFor("");
                                await load();
                              } catch (e: any) {
                                toast({ title: 'Failed to unarchive', description: e.message || '' });
                              }
                            }}
                          >
                            Unarchive
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <div className="md:col-span-3">
          <h2 className="mt-8 mb-3 text-lg font-semibold">Your classes</h2>
          <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Search classes by name…"
              className="w-full sm:max-w-sm rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
              <input type="checkbox" className="rounded border border-input" checked={showActiveOnly} onChange={(e)=>setShowActiveOnly(e.target.checked)} />
              Active only
            </label>
          </div>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-foreground/70">No classes yet. Create one to get started.</p>
          ) : (
            (() => {
              const filtered = classes.filter(c => {
                const matchesQuery = !query || c.name.toLowerCase().includes(query.toLowerCase());
                const matchesActive = !showActiveOnly || c.isActive;
                return matchesQuery && matchesActive;
              });
              if (classes.length > 0 && filtered.length === 0) {
                return <p className="text-sm text-foreground/70">No matching classes.</p>;
              }
              return (
                <ul className="space-y-3">
                  {filtered.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-border overflow-hidden relative"
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
                  <div className="p-5 relative">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium truncate pr-8">{c.name}</p>
                      <button
                        className="p-1 rounded hover:bg-accent"
                        title="More"
                        onClick={(e)=>{ e.stopPropagation(); setMenuOpenFor(menuOpenFor === c.id ? "" : c.id); }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
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
                    {menuOpenFor === c.id && (
                      <div className="absolute z-20 right-4 top-12 w-40 rounded-md border border-border bg-background shadow">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={async ()=>{
                            try {
                              const token = localStorage.getItem("token");
                              const headers: Record<string,string> = { "Content-Type": "application/json" };
                              if (token) headers.Authorization = `Bearer ${token}`;
                              const res = await fetch(`/api/classes/${c.id}/archive`, { method: 'PATCH', headers });
                              const d = await res.json().catch(()=>({}));
                              if (!res.ok) throw new Error(d?.message || res.statusText);
                              toast({ title: "Class archived" });
                              await load();
                            } catch (e: any) {
                              toast({ title: "Failed to archive", description: e.message || "" });
                            } finally { setMenuOpenFor(""); }
                          }}
                        >
                          Archive class
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={"absolute top-2 right-2 text-xs px-2 py-1 rounded-full " + (c.isActive ? "bg-green-600 text-white" : "bg-muted text-foreground/70")}>{c.isActive ? "Active" : "Inactive"}</span>
                {/* Action buttons bottom-right */}
                <div className="absolute bottom-3 right-3 z-10 flex flex-row gap-2">
                  <Link
                    to={`/classes/${c.id}`}
                    onClick={(e)=>e.stopPropagation()}
                    className="px-2.5 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 text-center"
                    title="View attendance"
                  >
                    Attendance
                  </Link>
                  <div className="relative inline-block">
                    <Link
                      to={`/classes/${c.id}/messages`}
                      onClick={(e)=>{ e.stopPropagation(); try { localStorage.setItem(`lastSeenMsgs:${c.id}`, String(Date.now())); } catch {} }}
                      className="px-2.5 py-1.5 rounded-md text-xs bg-secondary text-secondary-foreground hover:opacity-90 text-center"
                      title="Messages"
                    >
                      Messages
                    </Link>
                    {(() => {
                      const meta = latestMap[c.id];
                      const key = `lastSeenMsgs:${c.id}`;
                      const seen = Number(typeof window !== 'undefined' ? (localStorage.getItem(key) || 0) : 0);
                      const isNew = meta && meta.latestAt && (!userId || String(meta.latestBy) !== String(userId)) && meta.latestAt > seen;
                      return isNew ? (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow ring-2 ring-background" />
                      ) : null;
                    })()}
                  </div>
                  <Link
                    to={`/classes/${c.id}/modify`}
                    onClick={(e)=>e.stopPropagation()}
                    className="px-2.5 py-1.5 rounded-md text-xs border border-border bg-background hover:bg-accent hover:text-accent-foreground text-center"
                    title="Modify class"
                  >
                    Modify
                  </Link>
                </div>
                </li>
                  ))}
                </ul>
              );
            })()
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
  const [duration, setDuration] = React.useState<number>(4);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [joinCode, setJoinCode] = React.useState("");
  const [joining, setJoining] = React.useState(false);

  function setStudent(i: number, patch: Partial<NewStudent>) {
    setStudents((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const token = localStorage.getItem("token");
      const body = { name, imageUrl: coverDataUrl || undefined, durationMinutes: duration, students: students.filter(s => s.name && s.rollNo) };
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
          <div className="mt-4 flex flex-col md:flex-row gap-3">
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
          <div className="mt-3 rounded-xl border border-border p-3 bg-background/50">
            <p className="text-sm font-medium mb-2">Join class as co‑teacher</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2"
                placeholder="Enter class code"
                value={joinCode}
                onChange={(e)=> setJoinCode(e.target.value)}
              />
              <button
                className="px-4 py-2 rounded-lg border border-border disabled:opacity-50"
                disabled={joining || !joinCode}
                onClick={async ()=>{
                  setJoining(true); setErr(null);
                  try {
                    const token = localStorage.getItem("token");
                    const res = await fetch("/api/classes/join-as-teacher", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
                      body: JSON.stringify({ joinCode: joinCode.trim() })
                    });
                    const d = await res.json().catch(()=>({}));
                    if (!res.ok) throw new Error(d?.message || res.statusText);
                    toast({ title: "Joined as co‑teacher", description: d?.class?.name || "" });
                    setJoinCode("");
                    await onCreated();
                  } catch (e: any) {
                    setErr(e.message || "Failed to join");
                    toast({ title: "Failed to join", description: e.message || "" });
                  } finally { setJoining(false); }
                }}
              >
                {joining ? "Joining…" : "Join"}
              </button>
            </div>
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
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Active session duration (minutes)</label>
            <select
              className="rounded-lg border border-input bg-background px-3 py-2"
              value={duration}
              onChange={(e)=> setDuration(Number(e.target.value))}
            >
              {Array.from({length:10}, (_,i)=>i+1).map(m => (
                <option key={m} value={m}>{m} minute{m>1?"s":""}</option>
              ))}
            </select>
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
