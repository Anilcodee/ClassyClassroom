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
  const [files, setFiles] = useState<File[]>([]);
  const MAX_FILES = 4;
  const MAX_SIZE = 4 * 1024 * 1024;

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

  async function readFiles(fs: File[]) {
    const picked = fs.slice(0, MAX_FILES).filter(f => f.size <= MAX_SIZE);
    const res = await Promise.all(picked.map(f => new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, dataUrl: String(reader.result || '') });
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(f);
    })));
    return res;
  }

  async function create(){
    setCreating(true); setError(null);
    try {
      const attachments = await readFiles(files);
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/classes/${id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          questions: [],
          attachments,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          isDraft,
          allowLate,
          allowedRollNos: allowedRollNos.split(',').map(s=>s.trim()).filter(Boolean)
        })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setTitle(""); setDescription(""); setType('assignment'); setDueAt(""); setPublishAt(""); setIsDraft(true); setAllowLate(true); setAllowedRollNos(""); setFiles([]);
      await load();
    } catch(e:any){ setError(e.message || 'Failed'); }
    finally { setCreating(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}/messages`} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assignments</h1>
        {role !== 'student' && (
          <Link to={`/classes/${id}/assignments/new`} className="px-3 py-2 rounded-md border border-border text-sm">Create assignment or quiz</Link>
        )}
      </div>

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
