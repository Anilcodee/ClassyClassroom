import React from "react";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ArchivedClasses() {
  const [archived, setArchived] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [archMenuFor, setArchMenuFor] = React.useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      let res: Response;
      const resolvedUrl =
        typeof location !== "undefined" ? `${location.origin}/api/classes/archived` : "/api/classes/archived";
      try {
        const nativeFetch = (globalThis as any).fetch?.bind(globalThis) ?? fetch;
        try {
          res = await nativeFetch(resolvedUrl, { headers, cache: "no-store" });
        } catch (e) {
          // XHR fallback for environments where fetch is wrapped or blocked
          res = await new Promise<Response>((resolve, reject) => {
            try {
              const xhr = new XMLHttpRequest();
              xhr.open("GET", resolvedUrl, true);
              try {
                Object.keys(headers || {}).forEach((hk) => {
                  try {
                    xhr.setRequestHeader(hk, (headers as any)[hk]);
                  } catch {}
                });
              } catch {}
              xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) return;
                const hdrs: Record<string, string> = {};
                try {
                  const raw = xhr.getAllResponseHeaders() || "";
                  raw.trim().split(/\r?\n/).forEach((line) => {
                    const idx = line.indexOf(":");
                    if (idx > 0) {
                      const k = line.slice(0, idx).trim();
                      const v = line.slice(idx + 1).trim();
                      hdrs[k] = v;
                    }
                  });
                } catch {}
                const responseInit: ResponseInit = { status: xhr.status, headers: hdrs };
                resolve(new Response(xhr.responseText, responseInit));
              };
              xhr.onerror = () => reject(new Error("XHR error"));
              xhr.send();
            } catch (err) {
              reject(err);
            }
          });
        }
      } catch (e: any) {
        console.error("ArchivedClasses fetch failed", e);
        throw e;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || res.statusText || "Failed to load");
      const list = (d.classes || []).map((c: any) => ({
        id: c._id,
        name: c.name,
        imageUrl: c.imageUrl,
      }));
      setArchived(list);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function unarchive(id: string) {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/classes/${id}/unarchive`, { method: "PATCH", headers });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || res.statusText);
      toast({ title: "Class unarchived" });
      await load();
    } catch (e: any) {
      toast({ title: "Failed to unarchive", description: e.message || "" });
    } finally {
      setArchMenuFor("");
    }
  }

  return (
    <main className="container mx-auto py-10">
      <Link to="/classes" className="text-sm text-foreground/70 hover:text-foreground">← Back to classes</Link>
      <h2 className="text-lg font-semibold mb-4 mt-4">Archived classes</h2>
      {loading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : archived.length === 0 ? (
        <p className="text-sm text-foreground/70">No archived classes.</p>
      ) : (
        <ul className="space-y-3">
          {archived.map((c) => (
            <li key={c.id} className="rounded-xl border border-border overflow-hidden relative" style={{ minHeight: "10rem" }}>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setArchMenuFor(archMenuFor === c.id ? "" : c.id);
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-row gap-2">
                  <button disabled className="px-2.5 py-1.5 rounded-md text-xs bg-primary text-primary-foreground text-center opacity-50 cursor-not-allowed">Attendance</button>
                  <button disabled className="px-2.5 py-1.5 rounded-md text-xs bg-secondary text-secondary-foreground text-center opacity-50 cursor-not-allowed">Messages</button>
                  <button disabled className="px-2.5 py-1.5 rounded-md text-xs border border-border bg-background text-center opacity-50 cursor-not-allowed">Modify</button>
                </div>
                {archMenuFor === c.id && (
                  <div className="absolute z-20 right-4 top-12 rounded-md border border-border bg-background shadow flex flex-col items-end">
                    <button className="text-left px-2 py-1 text-sm hover:bg-accent whitespace-nowrap ml-auto" onClick={() => unarchive(c.id)}>
                      Unarchive
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
