import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface Attachment { name: string; type: string; size: number; dataUrl: string }
interface CommentItem { userId: string; name: string; content: string; createdAt: string }
interface MessageItem { id: string; title?: string; content: string; createdAt: string; pinned?: boolean; attachments?: Attachment[]; comments?: CommentItem[] }

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
  const [commentText, setCommentText] = useState<Record<string, string>>({});

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
    const MAX = 4; const MAX_SIZE = 1.5 * 1024 * 1024;
    const picked = fs.slice(0, MAX).filter(f => f.size <= MAX_SIZE);
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

  async function postComment(mid: string) {
    const txt = (commentText[mid] || "").trim();
    if (!txt) return;
    try {
      const r = await fetch(`/api/messages/${mid}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ content: txt }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setMessages(prev => prev.map(m => m.id === mid ? { ...m, comments: [...(m.comments||[]), d.comment] } : m));
      setCommentText(prev => ({ ...prev, [mid]: "" }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}`} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <h1 className="mt-2 text-2xl font-bold">Messages</h1>
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="grid gap-2">
          <input className="rounded-lg border border-input bg-background px-3 py-2" placeholder="Title (optional)" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <textarea className="rounded-lg border border-input bg-background px-3 py-2 min-h-24" placeholder="Write a message for your students" value={content} onChange={(e)=>setContent(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
              Attach files
              <input type="file" multiple className="hidden" onChange={(e)=> setFiles(Array.from(e.target.files || []))} />
            </label>
            <button disabled={!content.trim() || posting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" onClick={post}>{posting? 'Posting…' : 'Post'}</button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
              {files.map((f,i)=> (
                <span key={i} className="px-2 py-1 rounded border border-border bg-muted/50">{f.name} ({Math.round(f.size/1024)} KB)</span>
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
              {m.title && <p className="font-semibold">{m.title}</p>}
              <p className="whitespace-pre-wrap text-foreground/90">{m.content}</p>
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((a, idx) => (
                    <a key={idx} href={a.dataUrl} download={a.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border text-xs hover:bg-accent">
                      {a.type.startsWith('image/') ? (
                        <img src={a.dataUrl} alt={a.name} className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <span className="px-2 py-1 rounded bg-muted text-foreground/80">File</span>
                      )}
                      <span className="max-w-[12rem] truncate">{a.name}</span>
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-foreground/60">{new Date(m.createdAt).toLocaleString()}</p>

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
                <div className="mt-2 flex items-center gap-2">
                  <input className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Write a comment" value={commentText[m.id] || ""} onChange={(e)=> setCommentText(prev => ({ ...prev, [m.id]: e.target.value }))} />
                  <button className="px-3 py-2 rounded-lg border border-border text-sm" onClick={()=> postComment(m.id)}>Comment</button>
                </div>
              </div>
            </li>
          ))}
          {messages.length === 0 && <p className="text-sm text-foreground/70">No messages yet.</p>}
        </ul>
      )}
    </main>
  );
}
