import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function AttendanceHistory() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [dates, setDates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const userRole = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw).role : undefined;
    } catch {
      return undefined;
    }
  }, []);
  const backHref = userRole === "student" ? "/student" : `/classes/${id}`;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/classes/${id}/attendance/dates`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || res.statusText);
        setDates(data.dates || []);
      } catch (e: any) { setError(e.message); }
    })();
  }, [id, token]);

  async function download(date: string) {
    const res = await fetch(`/api/classes/${id}/attendance/pdf?date=${date}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${date}.pdf`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="container mx-auto py-8">
      <Link to={backHref} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <h1 className="mt-2 text-2xl font-bold">Attendance PDFs</h1>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="mt-4 space-y-2">
        {dates.map((d) => (
          <li key={d} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span>{d}</span>
            <button className="px-3 py-1.5 rounded-md border border-border" onClick={() => download(d)}>Download</button>
          </li>
        ))}
        {dates.length === 0 && <p className="text-sm text-foreground/70">No attendance days yet.</p>}
      </ul>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
