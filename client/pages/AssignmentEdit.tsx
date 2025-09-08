import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AssignmentEdit(){
  const { assignmentId } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [publishAt, setPublishAt] = useState<string>("");
  const [points, setPoints] = useState<number|string>(100);
  const [isDraft, setIsDraft] = useState(true);
  const [allowLate, setAllowLate] = useState(true);
  const [allowedRollNos, setAllowedRollNos] = useState<string>("");
  const mountedRef = useRef(true);

  async function fetchWithRetry(url: string, init: RequestInit = {}, attempt = 1): Promise<Response> {
    const { signal, ...rest } = init as any;
    try {
      const nativeFetch = (globalThis as any).fetch?.bind(globalThis) ?? fetch;
      const resolvedUrl = typeof location !== 'undefined' && typeof url === 'string' && url.startsWith('/') ? `${location.origin}${url}` : url;
      return await nativeFetch(resolvedUrl, { ...rest, signal });
    } catch (e: any) {
      const aborted = (signal && (signal as any).aborted) || e?.name === 'AbortError';
      if (aborted) {
        return new Response(JSON.stringify({ message: 'aborted' }), { status: 499, headers: { 'Content-Type': 'application/json' } });
      }
      // Try XHR fallback
      try {
        const method = (rest && rest.method) || 'GET';
        const headers = (rest && rest.headers) || {};
        const body = (rest && rest.body) || null;
        const xhrRes = await new Promise<Response>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open(method, resolvedUrl, true);
            Object.keys(headers || {}).forEach((hk) => {
              try { xhr.setRequestHeader(hk, (headers as any)[hk]); } catch {}
            });
            xhr.onreadystatechange = () => {
              if (xhr.readyState !== 4) return;
              const hdrs: Record<string,string> = {};
              try {
                const raw = xhr.getAllResponseHeaders() || '';
                raw.trim().split(/\r?\n/).forEach((line) => {
                  const idx = line.indexOf(':');
                  if (idx > 0) { const k = line.slice(0,idx).trim(); const v = line.slice(idx+1).trim(); hdrs[k]=v; }
                });
              } catch {}
              const responseInit: ResponseInit = { status: xhr.status || 0, headers: hdrs };
              resolve(new Response(xhr.responseText, responseInit));
            };
            xhr.onerror = () => reject(new Error('XHR error'));
            if (body) xhr.send(body as any); else xhr.send();
          } catch (err) { reject(err); }
        });
        return xhrRes;
      } catch (xhrErr) {
        // fall through to retry logic
      }

      if (attempt < 3 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        return fetchWithRetry(url, init, attempt + 1);
      }
      return new Response(JSON.stringify({ message: 'Network error' }), { status: 0, headers: { 'Content-Type': 'application/json' } });
    }
  }

  async function xhrFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      try {
        const method = (options && (options as any).method) || 'GET';
        const headers = (options && (options as any).headers) || {};
        const body = (options && (options as any).body) || null;
        const resolvedUrl = typeof location !== 'undefined' && typeof url === 'string' && url.startsWith('/') ? `${location.origin}${url}` : url;
        const xhr = new XMLHttpRequest();
        xhr.open(method, resolvedUrl, true);
        try {
          Object.keys(headers || {}).forEach((hk) => {
            try { xhr.setRequestHeader(hk, (headers as any)[hk]); } catch {}
          });
        } catch {}
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) return;
          const hdrs: Record<string,string> = {};
          try {
            const raw = xhr.getAllResponseHeaders() || '';
            raw.trim().split(/\r?\n/).forEach((line) => {
              const idx = line.indexOf(':');
              if (idx > 0) { const k = line.slice(0,idx).trim(); const v = line.slice(idx+1).trim(); hdrs[k] = v; }
            });
          } catch {}
          const responseInit: ResponseInit = { status: xhr.status || 0, headers: hdrs };
          resolve(new Response(xhr.responseText, responseInit));
        };
        xhr.onerror = () => reject(new Error('XHR error'));
        if (body) xhr.send(body as any); else xhr.send();
      } catch (err) { reject(err); }
    });
  }

  async function load(signal?: AbortSignal){
    if (!mountedRef.current) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {}; if (token) headers.Authorization = `Bearer ${token}`;
      let r: Response | null = null;
      try {
        // Try XHR first to avoid instrumented fetch wrappers
        r = await xhrFetch(`/api/assignments/${assignmentId}`, { headers });
      } catch (xhrErr) {
        // fallback to fetchWithRetry (supports AbortSignal)
        r = await fetchWithRetry(`/api/assignments/${assignmentId}`, { headers, cache: 'no-store', signal });
      }
      if (!r) throw new Error('Network error');
      if (r.status === 0 || r.status === 499) return;
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      if (!mountedRef.current) return;
      setA(d.assignment);
      setTitle(d.assignment.title || "");
      setDescription(d.assignment.description || "");
      function toLocalDateTimeInput(v: string | Date) {
        const d = new Date(v);
        if (isNaN(d.getTime())) return "";
        const pad = (n: number) => String(n).padStart(2, "0");
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
      }
      setDueAt(d.assignment.dueAt ? toLocalDateTimeInput(d.assignment.dueAt) : "");
      setPublishAt(d.assignment.publishAt ? toLocalDateTimeInput(d.assignment.publishAt) : "");
      setPoints(d.assignment.points ?? 100);
      setIsDraft(Boolean(d.assignment.isDraft));
      setAllowLate(Boolean(d.assignment.allowLate));
      setAllowedRollNos((d.assignment.allowedRollNos||[]).join(", "));
    } catch(e:any){ if (e?.name === 'AbortError') return; setError(e.message||'Failed'); }
    finally { if (mountedRef.current) setLoading(false); }
  }

  useEffect(()=>{
    mountedRef.current = true;
    const ac = new AbortController();
    load(ac.signal).catch(()=>{});
    return ()=>{
      mountedRef.current = false;
      try{ ac.abort(); } catch{}
    };
  }, [assignmentId]);

  async function save(){
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem('token');
      function parseLocalToISOString(v: string | null) {
        if (!v) return null;
        // expecting 'YYYY-MM-DDTHH:mm'
        const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if (!m) {
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : d.toISOString();
        }
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const day = Number(m[3]);
        const hh = Number(m[4]);
        const mm = Number(m[5]);
        const dt = new Date(y, mo, day, hh, mm, 0, 0); // local time
        return isNaN(dt.getTime()) ? null : dt.toISOString();
      }

      const payload = {
        title,
        description,
        points: typeof points === 'number' ? points : (points === '' ? null : Number(points)),
        dueAt: parseLocalToISOString(dueAt),
        publishAt: parseLocalToISOString(publishAt),
        isDraft,
        allowLate,
        allowedRollNos: allowedRollNos.split(',').map((s)=>s.trim()).filter(Boolean),
      };

      const r = await fetchWithRetry(`/api/assignments/${assignmentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      if (r.status === 0 || r.status === 499) throw new Error('Network error');
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      nav(-1);
    } catch(e:any){ setError(e.message||'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <main className="container mx-auto py-8">
      <button
        type="button"
        onClick={() => {
          try {
            // Prefer SPA back when available
            const idx = (window.history && (window.history.state as any)?.idx) || 0;
            if (typeof idx === 'number' && idx > 0) {
              nav(-1);
              return;
            }
            // Fallback to document.referrer if same-origin
            try {
              const ref = document.referrer;
              if (ref) {
                const rurl = new URL(ref);
                if (rurl.origin === location.origin) {
                  window.location.href = ref;
                  return;
                }
              }
            } catch {}
            // Fallback to class assignments or classes list
            if (a && (a as any).classId) nav(`/classes/${(a as any).classId}/assignments`);
            else nav('/classes');
          } catch {
            nav('/classes');
          }
        }}
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        ← Back
      </button>
      <h1 className="mt-2 text-2xl font-bold">Edit assignment</h1>
      {loading ? <p className="mt-4 text-sm text-foreground/70">Loading…</p> : error ? <p className="mt-4 text-sm text-destructive">{error}</p> : (
        <div className="mt-4 rounded-xl border border-border p-4 bg-card">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm">Title</label>
              <input className="rounded-lg border border-input bg-background px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm">Description</label>
              <textarea className="rounded-lg border border-input bg-background px-3 py-2 min-h-24" value={description} onChange={(e)=>setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Due date</label>
              <input type="datetime-local" className="rounded-lg border border-input bg-background px-3 py-2" value={dueAt} onChange={(e)=>setDueAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Publish at</label>
              <input type="datetime-local" className="rounded-lg border border-input bg-background px-3 py-2" value={publishAt} onChange={(e)=>setPublishAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Points (total points for grading)</label>
              <input type="number" min="0" className="rounded-lg border border-input bg-background px-3 py-2" value={(points ?? '') as any} onChange={(e)=> setPoints(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={isDraft} onChange={(e)=>setIsDraft(e.target.checked)} /> Draft</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={allowLate} onChange={(e)=>setAllowLate(e.target.checked)} /> Allow late</label>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm">Only for these roll numbers (comma separated, optional)</label>
              <input className="rounded-lg border border-input bg-background px-3 py-2" value={allowedRollNos} onChange={(e)=>setAllowedRollNos(e.target.value)} placeholder="e.g. 23, 42, 77" />
            </div>
          </div>
          <div className="mt-3">
            <button disabled={saving || !title.trim()} onClick={save} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
