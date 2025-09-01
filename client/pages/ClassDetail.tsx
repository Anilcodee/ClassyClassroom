import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface ClassDoc { _id: string; name: string; students: { name: string; rollNo: string }[]; isActive: boolean; activeSession?: string | null; imageUrl?: string }

export default function ClassDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cls, setCls] = useState<ClassDoc | null>(null);
  const [records, setRecords] = useState<{ student: { name: string; rollNo: string }; markedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const token = useMemo(() => localStorage.getItem("token"), []);

  async function load() {
    setLoading(true); setError(null);
    try {
      if (!token) throw new Error("Please log in");
      const headers: Record<string,string> = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/classes/${id}`, { headers, cache: 'no-store' });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data?.message || res.statusText);
      setCls(data.class);
      const r = await fetch(`/api/classes/${id}/attendance/today`, { headers, cache: 'no-store' });
      const rraw = await r.text();
      const rd = rraw ? JSON.parse(rraw) : {};
      if (r.ok) setRecords(rd.records || []);
    } catch (e: any) {
      setError(e.message || "Network error");
      if (e.message === "Please log in") nav("/auth");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) { nav('/auth'); return; }
    void load();
  }, [id, token]);

  // Auto-refresh status while active so button re-enables after 4 minutes
  useEffect(() => {
    if (!cls?.isActive || !cls?.activeSession) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/session/${cls.activeSession}`);
        const d = await r.json();
        if (d?.expiresAt) setExpiresAt(new Date(d.expiresAt));
        if (!stop && d && d.isActive === false) {
          setCls((prev) => (prev ? { ...prev, isActive: false, activeSession: null as any } : prev));
          setExpiresAt(null);
        }
      } catch {}
    };
    const i = setInterval(tick, 1000);
    return () => { stop = true; clearInterval(i); };
  }, [cls?.isActive, cls?.activeSession]);

  // Local second tick for countdown display
  useEffect(() => {
    if (!expiresAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [expiresAt]);

  async function activate() {
    try {
      if (!token) throw new Error("Please log in");
      const res = await fetch(`/api/classes/${id}/activate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || res.statusText);
      nav(`/session/${data.sessionId}`);
    } catch (e: any) {
      setError(e.message);
      if (e.message === "Please log in") nav("/auth");
    }
  }

  const remainingSec = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000)) : null;
  const mm = remainingSec != null ? String(Math.floor(remainingSec / 60)).padStart(2, "0") : null;
  const ss = remainingSec != null ? String(remainingSec % 60).padStart(2, "0") : null;

  const presentKeys = new Set(records.map((r) => `${r.student.name}|${r.student.rollNo}`));

  return (
    <main className="container mx-auto py-8">
      <Link to="/classes" className="text-sm text-foreground/70 hover:text-foreground">← Back to classes</Link>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : cls ? (
        <div className="mt-4">
          {cls.imageUrl && (
            <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden mb-4">
              <img src={cls.imageUrl} alt="Class cover" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {cls.name}
              {cls.isActive && mm && ss && (
                <span className="text-base font-mono px-2 py-1 rounded-md bg-muted text-foreground/80">{mm}:{ss}</span>
              )}
            </h1>
            <div className="flex items-center gap-3">
              <button disabled={cls.isActive} onClick={activate} className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
                {cls.isActive ? "Inactive class" : "Activate class"}
              </button>
              <button onClick={async ()=>{
                const token = localStorage.getItem('token');
                const headers: Record<string,string> = {};
                if (token) headers.Authorization = `Bearer ${token}`;
                const res = await fetch(`/api/classes/${id}/attendance/pdf`, { headers });
                if (!res.ok) { alert('Failed to download'); return; }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${cls?.name||'class'}-${new Date().toISOString().slice(0,10)}.pdf`;
                a.click(); URL.revokeObjectURL(url);
              }} className="px-3 py-2 rounded-lg border border-border">Download today PDF</button>
              <Link to={`/classes/${id}/history`} className="px-3 py-2 rounded-lg border border-border">PDF history</Link>
            </div>
          </div>
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Students</h2>
            <div className="rounded-xl border border-border divide-y">
              {(cls.students || []).map((s, i) => {
                const key = `${s.name}|${s.rollNo}`;
                const present = presentKeys.has(key);
                return (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-500/15 grid place-items-center text-brand-700 font-semibold">{s.name.slice(0,1).toUpperCase()}</div>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-foreground/60">Roll: {s.rollNo}</p>
                      </div>
                    </div>
                    {present ? <span className="text-green-600">✔</span> : <span className="text-foreground/40">—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
