import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from "@/lib/utils";

interface Attachment { name: string; type: string; size: number; dataUrl: string }
interface CommentItem { userId: string; name: string; content: string; createdAt: string }
interface MessageItem { id: string; title?: string; content: string; createdAt: string; updatedAt?: string; pinned?: boolean; attachments?: Attachment[]; comments?: CommentItem[]; canEdit?: boolean; canComment?: boolean }

export default function ClassMessages() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const nav = useNavigate();
  const userRole = useMemo(() => { try { const raw = localStorage.getItem("user"); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; } }, []);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const MAX_FILES = 4;
  const MAX_SIZE = 4 * 1024 * 1024; // ~4MB per file

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [hasNewMsgs, setHasNewMsgs] = useState(false);
  const [hasNewAssigns, setHasNewAssigns] = useState(false);

  const [preview, setPreview] = useState<{ name: string; type: string; url: string; text?: string } | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const mountedRef = useRef(true);
  const controllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    let active = true;
    if (!preview) return;
    if (preview.type.startsWith("text/") || preview.type === "application/json") {
      // Fetch text if data URL or object URL
      fetch(preview.url).then(r => r.text()).then(t => { if (active) setPreview(prev => prev ? { ...prev, text: t } : prev); }).catch(()=>{});
    }
    return () => { active = false; };
  }, [preview?.url, preview?.type]);

  useEffect(() => {
    mountedRef.current = true;
    const onFs = () => mountedRef.current && setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('fullscreenchange', onFs);
      controllersRef.current.forEach((c)=>{ try { c.abort(); } catch {} });
      controllersRef.current = [];
    };
  }, []);

  async function fetchWithRetry(url: string, init: RequestInit & { timeoutMs?: number } = {}, attempt = 1): Promise<Response> {
    const { timeoutMs = 8000, signal, ...rest } = init as any;
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      return await fetch(url, { ...rest, signal: ac.signal });
    } catch (e) {
      if (attempt < 2 && (!signal || !(signal as any).aborted)) {
        await new Promise(r => setTimeout(r, 400));
        return fetchWithRetry(url, init, attempt + 1);
      }
      throw e as any;
    } finally {
      clearTimeout(t);
      if (signal) signal.removeEventListener('abort', onAbort as any);
    }
  }

  async function load(signal?: AbortSignal) {
    if (mountedRef.current) { setLoading(true); setError(null); }
    const headers: Record<string,string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const r = await fetchWithRetry(`/api/classes/${id}/messages`, { headers, cache: 'no-store', signal });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      if (mountedRef.current) {
        setMessages(d.messages || []);
        const latest = (d.messages||[]).reduce((acc:number, m:any)=> Math.max(acc, new Date(m.createdAt).getTime()||0), 0);
        const key = `lastSeenMsgs:${id}`;
        const seen = Number(localStorage.getItem(key) || 0);
        setHasNewMsgs(latest > seen);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError' && mountedRef.current)
        setError(e?.message || (navigator.onLine ? 'Network error. Please retry.' : 'You appear to be offline'));
    } finally { if (mountedRef.current) setLoading(false); }
  }

  useEffect(() => {
    if (!token) {
      if (userRole === 'student') nav('/student-auth'); else nav('/auth');
      return;
    }
    const ac = new AbortController();
    void load(ac.signal);
    // Also fetch latest assignments to compute indicator
    (async ()=>{
      try {
        const headers: Record<string,string> = { Authorization: `Bearer ${token}` };
        const r = await fetch(`/api/classes/${id}/assignments`, { headers, cache: 'no-store', signal: ac.signal });
        const d = await r.json().catch(()=>({}));
        if (r.ok && mountedRef.current) {
          const latest = (d.assignments||[]).reduce((acc:number, a:any)=> Math.max(acc, new Date(a.publishAt || a.createdAt).getTime()||0), 0);
          const key = `lastSeenAssigns:${id}`;
          const seen = Number(localStorage.getItem(key) || 0);
          setHasNewAssigns(latest > seen);
        }
      } catch {}
    })();
    return () => { try { ac.abort(); } catch {} };
  }, [id, token]);

  const backHref = userRole === "student" ? "/student" : "/classes";

  async function readFiles(fs: File[]): Promise<Attachment[]> {
    const picked = fs.slice(0, MAX_FILES).filter(f => f.size <= MAX_SIZE);
    const res: Attachment[] = await Promise.all(picked.map(f => new Promise<Attachment>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, type: f.type || "application/octet-stream", size: f.size, dataUrl: String(reader.result || "") });
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(f);
    })));
    return res;
  }

  async function post() {
    if (mountedRef.current) { setPosting(true); setError(null); }
    try {
      const attachments = await readFiles(files);
      const r = await fetch(`/api/classes/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ title: title || undefined, content, attachments }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      if (mountedRef.current) {
        setTitle(""); setContent(""); setFiles([]);
        setMessages((prev) => [d.message, ...prev]);
      }
    } catch (e: any) { if (e?.name !== 'AbortError' && mountedRef.current) setError(e.message); }
    finally { if (mountedRef.current) setPosting(false); }
  }


  async function saveEdit(mid: string) {
    const ac = new AbortController();
    controllersRef.current.push(ac);
    try {
      const newAtts = await readFiles(editNewFiles);
      if (mountedRef.current) {
        // Optimistic: show appended files locally
        setMessages(prev => prev.map(m => m.id === mid ? { ...m, title: editTitle || m.title, content: editContent, attachments: [...(m.attachments||[]), ...newAtts].slice(0, MAX_FILES), updatedAt: new Date().toISOString() } : m));
      }
      const r = await fetch(`/api/messages/${mid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ title: editTitle || undefined, content: editContent, attachments: newAtts }), signal: ac.signal });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      if (mountedRef.current) {
        setMessages(prev => prev.map(m => m.id === mid ? d.message : m));
        setEditingId(null); setEditTitle(""); setEditContent(""); setEditAttachments([]); setEditNewFiles([]);
      }
      await load();
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        if (mountedRef.current) setError(e.message);
        await load();
      }
    } finally {
      controllersRef.current = controllersRef.current.filter(c => c !== ac);
      // Do not abort here; unmount cleanup already aborts in-flight requests. Late abort triggers AbortError in wrapped fetch.
    }
  }

  async function del(mid: string) {
    setDeleteId(mid);
    setIsDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const r = await fetch(`/api/messages/${deleteId}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!r.ok) {
        const d = await r.json().catch(()=>({}));
        throw new Error(d?.message || r.statusText);
      }
      if (mountedRef.current) {
        setMessages(prev => prev.filter(m => m.id !== deleteId));
      }
      toast({ title: "Message deleted", description: "The post has been removed." });
    } catch (e: any) {
      if (mountedRef.current) setError(e.message);
      toast({ title: "Failed to delete message", description: e.message || "" });
    } finally {
      if (mountedRef.current) setIsDeleteDialogOpen(false);
      setDeleteId(null);
    }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={backHref} className="text-sm text-foreground/70 hover:text-foreground">← Back to classes</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className="relative inline-block" onClick={()=>{ localStorage.setItem(`lastSeenAssigns:${id}`, String(Date.now())); setHasNewAssigns(false); }}>
          <Link to={`/classes/${id}/assignments`}>
            <Button variant="outline" size="sm">Assignments</Button>
          </Link>
          {hasNewAssigns && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-pink-500 shadow ring-2 ring-background" />
          )}
        </div>
      </div>
      <div className="mt-4">
        <div className="relative block" onClick={()=>{ localStorage.setItem(`lastSeenMsgs:${id}`, String(Date.now())); setHasNewMsgs(false); }}>
          <Link to={`/classes/${id}/messages/new`} className="block">
            <Button className="w-full justify-center gap-2 bg-blue-600 hover:bg-blue-600/90 text-white py-5 text-base" variant="default">
              <Pencil className="h-5 w-5" />
              Write an announcement
            </Button>
          </Link>
          {hasNewMsgs && (
            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-green-500 shadow ring-2 ring-background" />
          )}
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editingId === m.id ? (
                    <>
                      <input className="w-full rounded-lg border border-input bg-background px-3 py-2 mb-2" placeholder="Title (optional)" value={editTitle} onChange={(e)=>setEditTitle(e.target.value)} />
                      <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 min-h-24" value={editContent} onChange={(e)=>setEditContent(e.target.value)} />
                    </>
                  ) : (
                    <>
                      {m.title && <p className="font-semibold">{m.title}</p>}
                      <p className="whitespace-pre-wrap text-foreground/90">{m.content}</p>
                    </>
                  )}
                </div>
                <div className="shrink-0">
                  {editingId === m.id ? (
                    m.canEdit ? (
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>saveEdit(m.id)}>Save</button>
                        <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>{ setEditingId(null); setEditTitle(""); setEditContent(""); setEditAttachments([]); setEditNewFiles([]); }}>Cancel</button>
                        <button className="px-2 py-1 rounded border border-border text-xs text-destructive" onClick={()=>del(m.id)}>Delete</button>
                      </div>
                    ) : null
                  ) : (
                    m.canEdit ? (
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>{ setEditingId(m.id); setEditTitle(m.title || ""); setEditContent(m.content); setEditAttachments([...(m.attachments||[])]); setEditNewFiles([]); }}>Edit post</button>
                        <button className="px-2 py-1 rounded border border-border text-xs text-destructive" onClick={()=>del(m.id)}>Delete</button>
                      </div>
                    ) : null
                  )}
                </div>
              </div>

              {editingId === m.id ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer text-xs">
                      Attach files
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e)=>{
                          const incoming = Array.from(e.target.files || []);
                          const valid = incoming.filter(f => f.size <= MAX_SIZE);
                          const rejected = incoming.length - valid.length;
                          const remaining = Math.max(0, MAX_FILES - editAttachments.length - editNewFiles.length);
                          setEditNewFiles(prev => [...prev, ...valid.slice(0, remaining)]);
                          if (rejected > 0) setError(`Some files were too large (max ${(MAX_SIZE/1024/1024).toFixed(1)}MB each).`);
                          if (e.target) (e.target as HTMLInputElement).value = "";
                        }}
                      />
                    </label>
                    <span className="text-[11px] text-foreground/60">{editAttachments.length + editNewFiles.length}/{MAX_FILES} files</span>
                  </div>

                  {editAttachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/70">
                      {editAttachments.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/50">
                          <button type="button" className="max-w-[12rem] truncate text-left hover:underline" onClick={()=> setPreview({ name: a.name, type: a.type, url: a.dataUrl })}>{a.name}</button>
                          <button
                            type="button"
                            className="h-5 w-5 leading-none grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                            onClick={()=> setEditAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {editNewFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/70">
                      {editNewFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/50">
                          <button
                            type="button"
                            className="max-w-[12rem] truncate text-left hover:underline"
                            onClick={() => {
                              const url = URL.createObjectURL(f);
                              setPreview({ name: f.name, type: f.type || 'application/octet-stream', url });
                            }}
                          >
                            {f.name} ({Math.round(f.size/1024)} KB)
                          </button>
                          <button
                            type="button"
                            className="h-5 w-5 leading-none grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                            onClick={()=> setEditNewFiles(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((a, idx) => (
                        <div key={idx} className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border text-xs hover:bg-accent">
                          <button
                            type="button"
                            onClick={() => setPreview({ name: a.name, type: a.type, url: a.dataUrl })}
                            className="inline-flex items-center gap-2"
                            title="Preview"
                          >
                            {a.type.startsWith('image/') ? (
                              <img src={a.dataUrl} alt={a.name} className="h-10 w-10 object-cover rounded" />
                            ) : (
                              <span className="px-2 py-1 rounded bg-muted text-foreground/80">File</span>
                            )}
                            <span className="max-w-[12rem] truncate text-left">{a.name}</span>
                          </button>
                          <a href={a.dataUrl} download={a.name} className="px-1.5 py-0.5 rounded border border-border">Download</a>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <p className="mt-1 text-xs text-foreground/60">{m.updatedAt && new Date(m.updatedAt).getTime() > new Date(m.createdAt).getTime() ? `${formatDateTime(m.updatedAt)} (edited)` : formatDateTime(m.createdAt)}</p>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm font-medium">Comments</p>
                <ul className="mt-2 space-y-2">
                  {(m.comments||[]).map((c, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{c.name}</span>: <span>{c.content}</span>
                      <span className="ml-2 text-xs text-foreground/50">{formatDateTime(c.createdAt)}</span>
                    </li>
                  ))}
                  {(m.comments||[]).length === 0 && <li className="text-sm text-foreground/60">No comments yet.</li>}
                </ul>
                {m.canComment ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder="Write a comment"
                      value={commentInputs[m.id] || ""}
                      onChange={(e)=> setCommentInputs((p)=> ({ ...p, [m.id]: e.target.value }))}
                    />
                    <button
                      className="px-2.5 py-1.5 rounded-md border border-border text-sm disabled:opacity-50"
                      disabled={commentLoading[m.id] || !(commentInputs[m.id]||"").trim()}
                      onClick={async ()=>{
                        const text = (commentInputs[m.id] || "").trim();
                        if (!text) return;
                        setCommentLoading((p)=> ({ ...p, [m.id]: true }));
                        try {
                          const r = await fetch(`/api/messages/${m.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ content: text }) });
                          const d = await r.json().catch(()=>({}));
                          if (!r.ok) throw new Error(d?.message || r.statusText);
                          setMessages((prev)=> prev.map(mm => mm.id === m.id ? { ...mm, comments: [...(mm.comments||[]), d.comment] } : mm));
                          setCommentInputs((p)=> ({ ...p, [m.id]: "" }));
                        } catch (e: any) {
                          setError(e.message || "Failed to comment");
                        } finally {
                          setCommentLoading((p)=> ({ ...p, [m.id]: false }));
                        }
                      }}
                    >
                      {commentLoading[m.id] ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-foreground/60">Only class members can comment. The poster cannot comment on their own message.</p>
                )}
              </div>
            </li>
          ))}
          {messages.length === 0 && <p className="text-sm text-foreground/70">No messages yet.</p>}
        </ul>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=> setPreview(null)}>
          <div
            ref={contentRef}
            className={(isFs ? "w-screen h-screen max-w-none max-h-none rounded-none" : "w-full max-w-3xl max-h-[90vh] rounded-lg") + " overflow-auto bg-background border border-border"}
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="text-sm font-medium truncate pr-2">{preview.name}</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs rounded border border-border"
                  onClick={async ()=>{
                    if (!document.fullscreenElement && contentRef.current) await contentRef.current.requestFullscreen().catch(()=>{});
                    else await document.exitFullscreen().catch(()=>{});
                  }}
                >
                  {isFs ? 'Exit full screen' : 'Full screen'}
                </button>
                <a href={preview.url} download={preview.name} className="px-2 py-1 text-xs rounded border border-border">Download</a>
                <button className="px-2 py-1 text-xs rounded border border-border" onClick={()=> setPreview(null)}>Close</button>
              </div>
            </div>
            <div className="p-3">
              {preview.type.startsWith('image/') && (
                <img src={preview.url} alt={preview.name} className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-auto object-contain mx-auto"} />
              )}
              {preview.type === 'application/pdf' && (
                <iframe title="pdf" src={preview.url} className={(isFs ? "h-[90vh]" : "h-[70vh]") + " w-full rounded border border-border"} allowFullScreen />
              )}
              {(preview.type.startsWith('text/') || preview.type === 'application/json') && (
                <pre className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-full overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"}>{preview.text ?? 'Loading…'}</pre>
              )}
              {preview.type.startsWith('audio/') && (
                <audio controls className="w-full">
                  <source src={preview.url} />
                </audio>
              )}
              {preview.type.startsWith('video/') && (
                <video controls className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-full"}>
                  <source src={preview.url} />
                </video>
              )}
              {!preview.type.match(/^(image|audio|video)\//) && !['application/pdf','application/json'].includes(preview.type) && !preview.type.startsWith('text/') && (
                <div className="text-sm text-foreground/70">Preview not supported. Use Download.</div>
              )}
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(o)=>{ setIsDeleteDialogOpen(o); if(!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the post and its attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
