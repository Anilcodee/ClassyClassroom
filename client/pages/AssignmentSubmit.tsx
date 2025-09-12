import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDateTime } from "@/lib/utils";

interface Attachment { name: string; type: string; size: number; dataUrl: string }

export default function AssignmentSubmit(){
  const { assignmentId } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const role = useMemo(()=>{ try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; } }, []);

  const [files, setFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preview, setPreview] = useState<{ name: string; type: string; url: string } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  useEffect(()=>{ const onFs = ()=> setIsFs(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', onFs); return ()=> document.removeEventListener('fullscreenchange', onFs); }, []);

  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const MAX_FILES = 4;
  const MAX_SIZE = 4 * 1024 * 1024;

  import { fetchWithRetry } from "@/lib/fetch";


  const [submission, setSubmission] = useState<any>(null);

  async function load(signal?: AbortSignal){
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) { if (role === 'student') nav('/student-auth'); else nav('/auth'); return; }
      const headers: Record<string,string> = { Authorization: `Bearer ${token}` };
      const r = await fetchWithRetry(`/api/assignments/${assignmentId}`, { headers, cache: 'no-store', signal });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setA(d.assignment);
      setSubmission(d.submission || null);
    } catch(e:any){ if (e?.name !== 'AbortError') setError(e.message||'Failed'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ const ac = new AbortController(); load(ac.signal).catch(()=>{}); return ()=> { try { ac.abort(); } catch {} }; }, [assignmentId]);

  async function readFiles(fs: File[]): Promise<Attachment[]> {
    const picked = fs.slice(0, MAX_FILES).filter(f => f.size <= MAX_SIZE);
    const res: Attachment[] = await Promise.all(picked.map(f => new Promise<Attachment>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, dataUrl: String(reader.result || '') });
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(f);
    })));
    return res;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    const atts = await readFiles(list);
    setFiles(list);
    setAttachments(atts);
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false);
    const list = Array.from(e.dataTransfer.files || []);
    const atts = await readFiles(list);
    setFiles(list);
    setAttachments(atts);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); setDragOver(true); }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); setDragOver(false); }

  async function submit(){
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ answers, attachments })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText || 'Submit failed');
      nav(-1);
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setSubmitting(false); }
  }

  const closed = (() => {
    if (!a?.dueAt) return false;
    const due = new Date(a.dueAt).getTime();
    if (isNaN(due)) return false;
    return due < Date.now() && a?.allowLate === false;
  })();

  return (
    <main className="container mx-auto py-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={()=>{ if (a?.classId) nav(`/classes/${a.classId}/assignments`); else nav('/classes'); }}
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          ← Back
        </button>
        {a?.classId && <Link to={`/classes/${a.classId}/assignments`} className="text-sm text-foreground/70 hover:text-foreground">Assignments</Link>}
      </div>
      {loading ? <p className="mt-4 text-sm text-foreground/70">Loading…</p> : error ? (
        <div className="mt-4 text-sm">
          <p className="text-destructive">{error || (navigator.onLine ? 'Failed to load' : 'You appear to be offline')}</p>
          <div className="mt-2 flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-md border border-border" onClick={()=>{ const ac = new AbortController(); load(ac.signal).catch(()=>{}); }}>Retry</button>
            <button className="px-3 py-1.5 rounded-md border border-border" onClick={()=>{ if (a?.classId) nav(`/classes/${a.classId}/assignments`); else nav('/classes'); }}>Go to assignments</button>
          </div>
        </div>
      ) : a ? (
        <div className="mt-4">
          <h1 className="text-2xl font-bold">{a.title} <span className="text-xs text-foreground/60">({a.type})</span></h1>
          {a.description && <p className="mt-2 text-foreground/70 whitespace-pre-wrap">{a.description}</p>}
          {a.dueAt && <p className="mt-1 text-sm text-foreground/60">Due on {formatDateTime(a.dueAt)}</p>}
          {closed && <p className="mt-1 text-sm text-destructive">Submissions are closed for this assignment.</p>}

          {submission && (typeof submission.score !== 'undefined' && submission.score !== null) && (
            <div className="mt-3 rounded-md border border-border p-3 bg-muted text-left">
              <p className="font-medium">Score: {submission.score} / {a.points ?? 100}</p>
              {submission.feedback && <p className="mt-2 text-sm">Feedback: {submission.feedback}</p>}
              {submission.gradedAt && <p className="mt-1 text-xs text-foreground/60">Graded on {formatDateTime(submission.gradedAt)}</p>}
            </div>
          )}

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

          <div className="mt-6">
            <h2 className="font-semibold">Attachments</h2>
            <div
              className={`mt-2 rounded-lg border border-dashed ${dragOver ? 'border-primary bg-primary/5' : 'border-border'} p-4 text-sm text-foreground/70`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input id="file" type="file" multiple className="hidden" onChange={onPick} />
              <label htmlFor="file" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer">
                Browse files
              </label>
              <p className="mt-1 text-xs text-foreground/60">You can also drag and drop files here. Up to 4 files, 4MB each.</p>
            </div>
            {attachments.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {attachments.map((att, idx)=> (
                  <li key={idx} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm bg-background">
                    <button type="button" className="flex items-center gap-2 truncate" title="Preview" onClick={()=> setPreview({ name: att.name, type: att.type, url: att.dataUrl })}>
                      {att.type.startsWith('image/') ? (
                        <img src={att.dataUrl} alt={att.name} className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <span className="px-2 py-1 rounded bg-muted text-foreground/80">File</span>
                      )}
                      <span className="max-w-[12rem] truncate text-left">{att.name}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-xs text-foreground/50">{Math.ceil(att.size/1024)} KB</span>
                      <button type="button" className="px-2 py-1 rounded border border-border" onClick={()=> { const next = attachments.slice(); next.splice(idx,1); setAttachments(next); }}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {role === 'student' && (
            <button disabled={submitting || closed} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" onClick={submit}>{submitting ? 'Submitting…' : 'Submit'}</button>
          )}
        </div>
      ) : null}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=> setPreview(null)}>
          <div
            ref={contentRef}
            className={(isFs ? "w-screen h-screen max-w-none max-h-none rounded-none" : "w-full max-w-3xl max-h-[90vh] rounded-lg") + " overflow-auto bg-background border border-border"}
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="text-sm font-medium truncate pr-2">{preview.name}</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs rounded border border-border"
                  onClick={async ()=>{
                    if (!document.fullscreenElement && contentRef.current) await contentRef.current.requestFullscreen().catch(()=>{});
                    else await document.exitFullscreen().catch(()=>{});
                  }}
                >
                  {isFs ? 'Exit full screen' : 'Full screen'}
                </button>
                <a href={preview.url} download={preview.name} className="px-2 py-1 text-xs rounded border border-border">Download</a>
                <button className="px-2 py-1 text-xs rounded border border-border" onClick={()=> setPreview(null)}>Close</button>
              </div>
            </div>
            <div className="p-3">
              {preview.type.startsWith('image/') && (
                <img src={preview.url} alt={preview.name} className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-auto object-contain mx-auto"} />
              )}
              {preview.type === 'application/pdf' && (
                <iframe title="pdf" src={preview.url} className={(isFs ? "h-[90vh]" : "h-[70vh]") + " w-full rounded border border-border"} allowFullScreen />
              )}
              {(preview.type.startsWith('text/') || preview.type === 'application/json') && (
                <pre className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-full overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all"}></pre>
              )}
              {preview.type.startsWith('audio/') && (
                <audio controls className="w-full">
                  <source src={preview.url} />
                </audio>
              )}
              {preview.type.startsWith('video/') && (
                <video controls className={(isFs ? "max-h-[90vh]" : "max-h-[70vh]") + " w-full"}>
                  <source src={preview.url} />
                </video>
              )}
              {!preview.type.match(/^(image|audio|video)\//) && !['application/pdf','application/json'].includes(preview.type) && !preview.type.startsWith('text/') && (
                <div className="text-sm text-foreground/70">Preview not supported. Use Download.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
