import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export default function ClassMessageCompose() {
  const { id } = useParams();
  const nav = useNavigate();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAX_FILES = 4;
  const MAX_SIZE = 4 * 1024 * 1024;

  async function readFiles(fs: File[]): Promise<Attachment[]> {
    const picked = fs.slice(0, MAX_FILES).filter((f) => f.size <= MAX_SIZE);
    const res: Attachment[] = await Promise.all(
      picked.map(
        (f) =>
          new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                type: f.type || "application/octet-stream",
                size: f.size,
                dataUrl: String(reader.result || ""),
              });
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(f);
          }),
      ),
    );
    return res;
  }

  async function post() {
    setPosting(true);
    setError(null);
    try {
      const attachments = await readFiles(files);
      const r = await fetch(`/api/classes/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          title: title || undefined,
          content,
          attachments,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 403)
          throw new Error("You are not allowed to post in this class");
        throw new Error(d?.message || r.statusText);
      }
      // Poster has seen this message; clear new-message indicator for self
      try {
        localStorage.setItem(`lastSeenMsgs:${id}`, String(Date.now()));
      } catch {}
      toast({ title: "Announcement posted" });
      nav(`/classes/${id}/messages`);
    } catch (e: any) {
      setError(e.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="container mx-auto py-8">
      <Link
        to={`/classes/${id}/messages`}
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        <span className="back-arrow">←</span>&nbsp;Back to messages
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Make an announcement</h1>
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="grid gap-2">
          <input
            className="rounded-lg border border-input bg-background px-3 py-2"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="rounded-lg border border-input bg-background px-3 py-2 min-h-24"
            placeholder="Write a message for your class"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
              Attach files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  const valid = picked.filter((f) => f.size <= MAX_SIZE);
                  const rejected = picked.length - valid.length;
                  setFiles((prev) => {
                    const remaining = MAX_FILES - prev.length;
                    const merged = [
                      ...prev,
                      ...valid.slice(0, Math.max(0, remaining)),
                    ];
                    return merged.slice(0, MAX_FILES);
                  });
                  if (rejected > 0)
                    setError(
                      `Some files were too large (max ${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB each).`,
                    );
                  if (e.target) (e.target as HTMLInputElement).value = "";
                }}
              />
            </label>
            <button
              disabled={!content.trim() || posting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              onClick={post}
            >
              {posting ? "Posting…" : "Post"}
            </button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/50"
                >
                  <span className="max-w-[12rem] truncate text-left">
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    aria-label="Remove file"
                    className="h-5 w-5 leading-none grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
