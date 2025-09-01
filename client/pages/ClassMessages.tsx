import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface Attachment { name: string; type: string; size: number; dataUrl: string }
interface CommentItem { userId: string; name: string; content: string; createdAt: string }
interface MessageItem { id: string; title?: string; content: string; createdAt: string; updatedAt?: string; pinned?: boolean; attachments?: Attachment[]; comments?: CommentItem[] }

export default function ClassMessages() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
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
  const MAX_SIZE = 1.5 * 1024 * 1024; // ~1.5MB per file

  const [preview, setPreview] = useState<{ name: string; type: string; url: string; text?: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

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
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/classes/${id}/messages`, { headers: { Authorization: token ? `Bearer ${token}` : "" }, cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setMessages(d.messages || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [id, token]);

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
    setPosting(true); setError(null);
    try {
      const attachments = await readFiles(files);
      const r = await fetch(`/api/classes/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ title: title || undefined, content, attachments }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setTitle(""); setContent(""); setFiles([]);
      setMessages((prev) => [d.message, ...prev]);
    } catch (e: any) { setError(e.message); }
    finally { setPosting(false); }
  }


  async function saveEdit(mid: string) {
    try {
      const newAtts = await readFiles(editNewFiles);
      const combined = [...editAttachments, ...newAtts].slice(0, MAX_FILES);
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === mid ? { ...m, title: editTitle || m.title, content: editContent, attachments: combined, updatedAt: new Date().toISOString() } : m));
      const r = await fetch(`/api/messages/${mid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ title: editTitle || undefined, content: editContent, attachments: combined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setMessages(prev => prev.map(m => m.id === mid ? d.message : m));
      setEditingId(null); setEditTitle(""); setEditContent(""); setEditAttachments([]); setEditNewFiles([]);
      await load();
    } catch (e: any) {
      setError(e.message);
      await load();
    }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to="/" className="text-sm text-foreground/70 hover:text-foreground">← Back to home</Link>
      <h1 className="mt-2 text-2xl font-bold">Messages</h1>
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="grid gap-2">
          <input className="rounded-lg border border-input bg-background px-3 py-2" placeholder="Title (optional)" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <textarea className="rounded-lg border border-input bg-background px-3 py-2 min-h-24" placeholder="Write a message for your students" value={content} onChange={(e)=>setContent(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
              Attach files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e)=>{
                  const picked = Array.from(e.target.files || []);
                  const valid = picked.filter(f => f.size <= MAX_SIZE);
                  const rejected = picked.length - valid.length;
                  setFiles(prev => {
                    const remaining = MAX_FILES - prev.length;
                    const merged = [...prev, ...valid.slice(0, Math.max(0, remaining))];
                    return merged.slice(0, MAX_FILES);
                  });
                  if (rejected > 0) setError(`Some files were too large (max ${(MAX_SIZE/1024/1024).toFixed(1)}MB each).`);
                  if (e.target) (e.target as HTMLInputElement).value = "";
                }}
              />
            </label>
            <button disabled={!content.trim() || posting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" onClick={post}>{posting? 'Posting…' : 'Post'}</button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
              {files.map((f,i)=> (
                <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/50">
                  <button
                    type="button"
                    className="max-w-[12rem] truncate text-left hover:underline"
                    onClick={() => {
                      const url = f.type.startsWith('image/') || f.type === 'application/pdf' || f.type.startsWith('text/') || f.type === 'application/json'
                        ? URL.createObjectURL(f)
                        : URL.createObjectURL(f);
                      setPreview({ name: f.name, type: f.type || 'application/octet-stream', url });
                    }}
                    title="Preview"
                  >
                    {f.name} ({Math.round(f.size/1024)} KB)
                  </button>
                  <button
                    type="button"
                    aria-label="Remove file"
                    className="h-5 w-5 leading-none grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                    onClick={()=> setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
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
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>saveEdit(m.id)}>Save</button>
                      <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>{ setEditingId(null); setEditTitle(""); setEditContent(""); setEditAttachments([]); setEditNewFiles([]); }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="px-2 py-1 rounded border border-border text-xs" onClick={()=>{ setEditingId(m.id); setEditTitle(m.title || ""); setEditContent(m.content); setEditAttachments([...(m.attachments||[])]); setEditNewFiles([]); }}>Edit post</button>
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
              <p className="mt-1 text-xs text-foreground/60">{m.updatedAt && new Date(m.updatedAt).getTime() > new Date(m.createdAt).getTime() ? `${new Date(m.updatedAt).toLocaleString()} (edited)` : new Date(m.createdAt).toLocaleString()}</p>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm font-medium">Comments</p>
                <ul className="mt-2 space-y-2">
                  {(m.comments||[]).map((c, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{c.name}</span>: <span>{c.content}</span>
                      <span className="ml-2 text-xs text-foreground/50">{new Date(c.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                  {(m.comments||[]).length === 0 && <li className="text-sm text-foreground/60">No comments yet.</li>}
                </ul>
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
    </main>
  );
}
