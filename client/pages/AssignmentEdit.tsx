import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AssignmentEdit(){
  const { assignmentId } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [publishAt, setPublishAt] = useState<string>("");
  const [isDraft, setIsDraft] = useState(true);
  const [allowLate, setAllowLate] = useState(true);
  const [allowedRollNos, setAllowedRollNos] = useState<string>("");

  async function load(){
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {}; if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`/api/assignments/${assignmentId}`, { headers, cache: 'no-store' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setA(d.assignment);
      setTitle(d.assignment.title || "");
      setDescription(d.assignment.description || "");
      setDueAt(d.assignment.dueAt ? new Date(d.assignment.dueAt).toISOString().slice(0,16) : "");
      setPublishAt(d.assignment.publishAt ? new Date(d.assignment.publishAt).toISOString().slice(0,16) : "");
      setIsDraft(Boolean(d.assignment.isDraft));
      setAllowLate(Boolean(d.assignment.allowLate));
      setAllowedRollNos((d.assignment.allowedRollNos||[]).join(", "));
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ void load(); }, [assignmentId]);

  async function save(){
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/assignments/${assignmentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({
        title, description, dueAt: dueAt ? new Date(dueAt).toISOString() : null, publishAt: publishAt ? new Date(publishAt).toISOString() : null, isDraft, allowLate, allowedRollNos: allowedRollNos.split(',').map((s)=>s.trim()).filter(Boolean)
      }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      nav(-1);
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <button type="button" onClick={()=>nav(-1)} className="text-sm text-foreground/70 hover:text-foreground">← Back</button>
      <h1 className="mt-2 text-2xl font-bold">Edit assignment</h1>
      {loading ? <p className="mt-4 text-sm text-foreground/70">Loading…</p> : error ? <p className="mt-4 text-sm text-destructive">{error}</p> : (
        <div className="mt-4 rounded-xl border border-border p-4 bg-card">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm">Title</label>
              <input className="rounded-lg border border-input bg-background px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} />
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
            <button disabled={saving || !title.trim()} onClick={save} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
