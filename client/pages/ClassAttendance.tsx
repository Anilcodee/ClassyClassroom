import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface RecordItem { student: { name: string; rollNo: string }; markedAt: string }

export default function ClassAttendance() {
  const { id } = useParams();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/classes/${id}/attendance/dates`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.message || r.statusText);
        const list: string[] = d.dates || [];
        setDates(list);
        if (list.length > 0) setDate(list[0]);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id, token]);

  useEffect(() => {
    if (!date) return; setLoading(true); setError(null);
    (async () => {
      try {
        const r = await fetch(`/api/classes/${id}/attendance?date=${encodeURIComponent(date)}`, { headers: { Authorization: token ? `Bearer ${token}` : "" }, cache: 'no-store' });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.message || r.statusText);
        setRecords(d.records || []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [id, token, date]);

  return (
    <main className="container mx-auto py-8">
      <Link to={`/classes/${id}`} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm">Date</label>
          <select className="rounded-md border border-input bg-background px-2 py-1" value={date} onChange={(e)=>setDate(e.target.value)}>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
            {dates.length === 0 && <option value={date}>{date}</option>}
          </select>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-4">
          <div className="text-sm text-foreground/70">Total marked: {records.length}</div>
          <div className="mt-3 rounded-xl border border-border divide-y">
            {records.length === 0 && <p className="p-3 text-sm text-foreground/70">No records for this date.</p>}
            {records.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{r.student.name}</p>
                  <p className="text-xs text-foreground/60">Roll: {r.student.rollNo}</p>
                </div>
                <span className="text-xs text-foreground/60">{new Date(r.markedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
