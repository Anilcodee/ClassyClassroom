import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDateTime } from "@/lib/utils";

export default function AssignmentSubmissions() {
  const { assignmentId } = useParams();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const token = useMemo(() => localStorage.getItem("token"), []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const headers: Record<string,string> = {}; if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`/api/assignments/${assignmentId}/submissions`, { headers, cache: 'no-store' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText || 'Failed');
      setSubs(d.submissions || []);
    } catch (e:any) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ void load(); }, [assignmentId]);

  async function saveGrade(subId: string, score: number|null, feedback: string) {
    setSavingFor(subId);
    try {
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`/api/assignments/${assignmentId}/submissions/${subId}/grade`, {
        method: 'POST', headers, body: JSON.stringify({ score, feedback })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText || 'Failed');
      // update local list
      setSubs((prev)=> prev.map(s => s._id === subId ? d.submission : s));
    } catch (e:any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSavingFor(null);
    }
  }

  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string,string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const r = await fetch(`/api/assignments/${assignmentId}`, { headers, cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (r.ok && mounted && d.assignment) setClassId(d.assignment.classId || null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [assignmentId]);

  return (
    <main className="container mx-auto py-8">
      <Link to={classId ? `/classes/${classId}/assignments` : '/classes'} className="text-sm text-foreground/70 hover:text-foreground">← Back</Link>
      <h1 className="mt-2 text-2xl font-bold">Submissions</h1>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {subs.length === 0 ? <p className="text-sm text-foreground/70">No submissions yet.</p> : (
            <ul className="space-y-3">
              {subs.map(s => (
                <li key={s._id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{s.user?.name || s.user?.rollNo || 'Student'}</p>
                      <p className="text-xs text-foreground/60">{s.user?.rollNo ? `Roll: ${s.user.rollNo}` : ''} {s.submittedAt ? ` • ${formatDateTime(s.submittedAt)}` : ''}</p>
                      <p className="text-sm mt-2">Status: {s.status}</p>
                    </div>
                    <div className="w-48">
                      <label className="text-xs">Score</label>
                      <input type="number" className="mt-1 w-full rounded-lg border border-input px-2 py-1" defaultValue={s.score ?? ''} onChange={(e)=> { const v = e.target.value; s._pendingScore = v === '' ? null : Number(v); }} />
                      <label className="text-xs mt-2 block">Feedback</label>
                      <textarea className="mt-1 w-full rounded-lg border border-input px-2 py-1" defaultValue={s.feedback || ''} onChange={(e)=> { s._pendingFeedback = e.target.value; }} />
                      <div className="mt-2 flex justify-end">
                        <button disabled={savingFor === s._id} onClick={()=> saveGrade(s._id, s._pendingScore !== undefined ? s._pendingScore : (s.score ?? null), s._pendingFeedback !== undefined ? s._pendingFeedback : (s.feedback || ''))} className="px-3 py-1.5 rounded-md border border-border text-sm">{savingFor === s._id ? 'Saving…' : 'Save'}</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />
    </main>
  );
}
