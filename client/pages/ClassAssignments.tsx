import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface AssignmentItem { id: string; title: string; type: 'assignment'|'quiz'; description?: string; dueAt?: string|null; publishAt?: string|null; isDraft: boolean; allowLate: boolean; allowedRollNos?: string[] }

export default function ClassAssignments(){
  const { id } = useParams();
  const nav = useNavigate();
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<'assignment'|'quiz'>("assignment");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [publishAt, setPublishAt] = useState<string>("");
  const [isDraft, setIsDraft] = useState(true);
  const [allowLate, setAllowLate] = useState(true);
  const [allowedRollNos, setAllowedRollNos] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const role = useMemo(()=>{ try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; } }, []);

  async function load(){
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {}; if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`/api/classes/${id}/assignments`, { headers, cache: 'no-store' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setItems((d.assignments||[]).map((a:any)=> ({ id: a._id, title: a.title, type: a.type, description: a.description, dueAt: a.dueAt, publishAt: a.publishAt, isDraft: a.isDraft, allowLate: a.allowLate, allowedRollNos: a.allowedRollNos })));
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ void load(); }, [id]);

  async function create(){
    setCreating(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/classes/${id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          questions: [],
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          isDraft,
          allowLate,
          allowedRollNos: allowedRollNos.split(',').map(s=>s.trim()).filter(Boolean)
        })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setTitle(""); setDescription(""); setType('assignment'); setDueAt(""); setPublishAt(""); setIsDraft(true); setAllowLate(true); setAllowedRollNos("");
      await load();
    } catch(e:any){ setError(e.message || 'Failed'); }
    finally { setCreating(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}`} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <h1 className="mt-2 text-2xl font-bold">Assignments</h1>
      {role !== 'student' && (
        <div className="mt-4 rounded-xl border border-border p-4 bg-card">
          <h2 className="font-semibold mb-3">Create assignment or quiz</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm">Title</label>
              <input className="rounded-lg border border-input bg-background px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Type</label>
              <select className="rounded-lg border border-input bg-background px-3 py-2" value={type} onChange={(e)=> setType(e.target.value as any)}>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm">Description</label>
              <textarea className="rounded-lg border border-input bg-background px-3 py-2 min-h-24" value={description} onChange={(e)=>setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Due date</label>
              <input type="datetime-local" className="rounded-lg border border-input bg-background px-3 py-2" value={dueAt} onChange={(e)=>setDueAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Publish at</label>
              <input type="datetime-local" className="rounded-lg border border-input bg-background px-3 py-2" value={publishAt} onChange={(e)=>setPublishAt(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={isDraft} onChange={(e)=>setIsDraft(e.target.checked)} /> Draft</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={allowLate} onChange={(e)=>setAllowLate(e.target.checked)} /> Allow late</label>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm">Only for these roll numbers (comma separated, optional)</label>
              <input className="rounded-lg border border-input bg-background px-3 py-2" value={allowedRollNos} onChange={(e)=>setAllowedRollNos(e.target.value)} placeholder="e.g. 23, 42, 77" />
            </div>
          </div>
          <div className="mt-3">
            <button disabled={creating || !title.trim()} onClick={create} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{creating? 'Creating…' : 'Create'}</button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      )}

      <h2 className="mt-6 font-semibold">All assignments</h2>
      {loading ? (
        <p className="text-sm text-foreground/70 mt-2">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive mt-2">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-foreground/70 mt-2">No assignments yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map(a => (
            <li key={a.id} className="rounded-xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{a.title} <span className="text-xs text-foreground/60">({a.type})</span></p>
                <p className="text-xs text-foreground/60">{a.isDraft ? 'Draft' : (a.publishAt ? `Publishes ${new Date(a.publishAt).toLocaleString()}` : 'Published')}</p>
                {a.dueAt && <p className="text-xs text-foreground/60">Due {new Date(a.dueAt).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-2">
                {role === 'student' ? (
                  <Link to={`/assign/${a.id}`} className="px-3 py-1.5 rounded-md border border-border text-sm">Open</Link>
                ) : (
                  <Link to={`/assign/${a.id}`} className="px-3 py-1.5 rounded-md border border-border text-sm">Open</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
