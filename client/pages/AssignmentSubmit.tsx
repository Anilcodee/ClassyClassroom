import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDateTime } from "@/lib/utils";

export default function AssignmentSubmit(){
  const { assignmentId } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const role = useMemo(()=>{ try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; } }, []);

  async function load(){
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {}; if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`/api/assignments/${assignmentId}`, { headers, cache: 'no-store' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setA(d.assignment);
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); }, [assignmentId]);

  async function submit(){
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ answers })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      nav(-1);
    } catch(e:any){ setError(e.message||'Failed'); }
  }

  return (
    <main className="container mx-auto py-8">
      <button type="button" onClick={()=>nav(-1)} className="text-sm text-foreground/70 hover:text-foreground">← Back</button>
      {loading ? <p className="mt-4 text-sm text-foreground/70">Loading…</p> : error ? <p className="mt-4 text-sm text-destructive">{error}</p> : a ? (
        <div className="mt-4">
          <h1 className="text-2xl font-bold">{a.title} <span className="text-xs text-foreground/60">({a.type})</span></h1>
          {a.description && <p className="mt-2 text-foreground/70 whitespace-pre-wrap">{a.description}</p>}
          {a.dueAt && <p className="mt-1 text-sm text-foreground/60">Due on {formatDateTime(a.dueAt)}</p>}
          <div className="mt-4 space-y-3">
            {(a.questions||[]).length === 0 ? (
              <p className="text-sm text-foreground/70">No questions. You can still submit notes.</p>
            ) : a.questions.map((q:any, i:number)=> (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Q{i+1}. {q.text}</p>
                {q.type === 'mcq' ? (
                  <div className="mt-2 space-y-1">
                    {(q.options||[]).map((opt:string, oi:number)=> (
                      <label key={oi} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={String(answers[`q${i}-${oi}`]||'')==='1'} onChange={(e)=> setAnswers(p=> ({...p, [`q${i}-${oi}`]: e.target.checked ? '1' : ''}))} /> {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={answers[`q${i}`]||''} onChange={(e)=> setAnswers(p=> ({...p, [`q${i}`]: e.target.value}))} />
                )}
              </div>
            ))}
          </div>
          {role === 'student' && (
            <button className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground" onClick={submit}>Submit</button>
          )}
        </div>
      ) : null}
    </main>
  );
}
