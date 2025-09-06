import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface Item { date: string; present: boolean }

export default function StudentAttendance() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userRole = useMemo(() => {
    try { const raw = localStorage.getItem("user"); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/student/classes/${id}/attendance`, { headers: { Authorization: token ? `Bearer ${token}` : "" }, cache: 'no-store' });
        const data = await res.json().catch(()=>({}));
        if (!res.ok) throw new Error(data?.message || res.statusText);
        setItems((data.items || []).slice().sort((a: Item, b: Item) => a.date < b.date ? 1 : -1));
      } catch (e: any) { setError(e.message || "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [id, token]);

  const backHref = userRole === "student" ? "/student" : `/classes/${id}`;

  return (
    <main className="container mx-auto py-8">
      <Link to={backHref} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <h1 className="mt-2 text-2xl font-bold">My attendance</h1>
      {loading ? <p className="text-sm text-foreground/70">Loading…</p> : error ? <p className="text-sm text-destructive">{error}</p> : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden">
          {items.map((it) => (
            <li key={it.date} className="flex items-center justify-between p-3">
              <span className="font-mono">{it.date}</span>
              {it.present ? (
                <span className="inline-flex items-center gap-2 text-green-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Present</span>
              ) : (
                <span className="inline-flex items-center gap-2 text-foreground/50"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg> Absent</span>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="p-3 text-sm text-foreground/70">No attendance records yet.</li>}
        </ul>
      )}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
