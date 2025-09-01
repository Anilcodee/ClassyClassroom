import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface MessageItem { id: string; title?: string; content: string; createdAt: string; pinned?: boolean }

export default function ClassMessages() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

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

  async function post() {
    setPosting(true); setError(null);
    try {
      const r = await fetch(`/api/classes/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify({ title: title || undefined, content }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setTitle(""); setContent("");
      setMessages((prev) => [d.message, ...prev]);
    } catch (e: any) { setError(e.message); }
    finally { setPosting(false); }
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
            <button disabled={!content.trim() || posting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" onClick={post}>{posting? 'Posting…' : 'Post'}</button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
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
              <p className="mt-1 text-xs text-foreground/60">{new Date(m.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {messages.length === 0 && <p className="text-sm text-foreground/70">No messages yet.</p>}
        </ul>
      )}
    </main>
  );
}
