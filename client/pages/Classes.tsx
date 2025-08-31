import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface ClassItem { id: string; name: string; joinCode: string; isActive: boolean; }

export default function Classes() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/classes", { headers: { Authorization: token ? `Bearer ${token}` : "" } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load");
        setClasses(data.classes.map((c: any) => ({ id: c._id, name: c.name, joinCode: c.joinCode, isActive: c.isActive })));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="container mx-auto py-10">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <MakeClassCard />
          <h2 className="mt-8 mb-3 text-lg font-semibold">Your classes</h2>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-foreground/70">No classes yet. Create one to get started.</p>
          ) : (
            <ul className="space-y-3">
              {classes.map((c) => (
                <li key={c.id} className="rounded-xl border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-foreground/60">Join code: {c.joinCode}</p>
                  </div>
                  <span className={"text-xs px-2 py-1 rounded-full " + (c.isActive ? "bg-green-600 text-white" : "bg-muted text-foreground/70")}>{c.isActive ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="md:col-span-1">
          <div className="rounded-2xl border border-border p-5 bg-card shadow">
            <h3 className="font-semibold mb-2">Downloads</h3>
            <p className="text-sm text-foreground/70 mb-3">View PDFs generated for each day and class.</p>
            <Link to="#" className="inline-block px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground text-sm">Open PDF list</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function MakeClassCard() {
  return (
    <div className="rounded-2xl border border-border p-6 bg-card shadow">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Make your class</h2>
          <p className="text-foreground/70 mt-1">Name it, add students manually, via join link, or import a spreadsheet.</p>
          <div className="mt-4 flex gap-3">
            <Link to="#" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">Create class</Link>
            <Link to="#" className="px-4 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground">Import spreadsheet</Link>
          </div>
        </div>
        <div className="w-48 h-48 relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-400/30 to-brand-700/30 blur-2xl" />
          <TeacherLoop />
        </div>
      </div>
    </div>
  );
}

function TeacherLoop() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <circle cx="100" cy="100" r="80" className="fill-[hsl(var(--muted))]" />
      <g>
        <rect x="60" y="120" width="80" height="40" rx="8" className="fill-[hsl(var(--accent))]" />
        <circle cx="120" cy="80" r="10" className="fill-[hsl(var(--brand-600))]">
          <animate attributeName="cy" values="80;70;80" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
