import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AssignmentCreate(){
  const { id } = useParams();
  const nav = useNavigate();
  const role = useMemo(()=>{ try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; } }, []);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<'assignment'|'quiz'>("assignment");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [publishAt, setPublishAt] = useState<string>("");
  const [isDraft, setIsDraft] = useState(true);
  const [allowLate, setAllowLate] = useState(true);
  const [allowedRollNos, setAllowedRollNos] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const MAX_FILES = 3; const MAX_SIZE = 2 * 1024 * 1024; // base64 overhead; keep small under server 10MB limit
  const MAX_TOTAL = 7 * 1024 * 1024;
  const [err, setErr] = useState<string | null>(null);
  const [errOpen, setErrOpen] = useState(false);

  useEffect(()=>{
    if (role === 'student') nav(`/classes/${id}/assignments`);
  }, [role, id]);

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
    if (!title.trim()) { setErr('Title is required'); setErrOpen(true); return; }
    const totalSize = files.reduce((s,f)=> s + f.size, 0);
    if (files.length > MAX_FILES || totalSize > MAX_TOTAL || files.some(f => f.size > MAX_SIZE)) {
      setErr(`Attachments exceed limits. Max ${MAX_FILES} files, ${Math.round(MAX_SIZE/1024/1024)}MB each, total under ${Math.round(MAX_TOTAL/1024/1024)}MB.`);
      setErrOpen(true);
      return;
    }
    setCreating(true);
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
      toast({ title: 'Assignment created' });
      nav(`/classes/${id}/assignments`);
    } catch(e:any) { setErr(e.message || 'Failed'); setErrOpen(true); }
    finally { setCreating(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}/assignments`} className="text-sm text-foreground/70 hover:text-foreground">
        <span className="back-arrow">←</span>&nbsp;Back to assignments
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Create assignment or quiz</h1>
      <div className="mt-4 rounded-xl border border-border p-4 bg-card">
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
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm">Attachments (any file type, up to {MAX_FILES} files, {Math.round(MAX_SIZE/1024/1024)}MB each)</label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
                Choose files
                <input type="file" multiple className="hidden" onChange={(e)=>{
                  const incoming = Array.from(e.target.files || []);
                  const valid = incoming.filter(f => f.size <= MAX_SIZE);
                  const remaining = Math.max(0, MAX_FILES - files.length);
                  setFiles(prev => [...prev, ...valid.slice(0, remaining)]);
                  if (e.target) (e.target as HTMLInputElement).value = "";
                }} />
              </label>
              <span className="text-xs text-foreground/60">{files.length}/{MAX_FILES} files</span>
            </div>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/70">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/50">
                    <span className="max-w-[12rem] truncate">{f.name}</span>
                    <button type="button" className="h-5 w-5 leading-none grid place-items-center rounded hover:bg-destructive/10 text-destructive" onClick={()=> setFiles(prev => prev.filter((_, idx)=> idx !== i))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3">
          <button disabled={creating || !title.trim()} onClick={create} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{creating? 'Creating…' : 'Create'}</button>
        </div>
      </div>
      <AlertDialog open={errOpen} onOpenChange={setErrOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to create assignment</AlertDialogTitle>
            <AlertDialogDescription>{err || 'Something went wrong. Please try again.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={()=> setErrOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
