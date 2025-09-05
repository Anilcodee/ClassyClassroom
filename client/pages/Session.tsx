import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

export default function Session() {
  const { sessionId } = useParams();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [now, setNow] = useState(Date.now());
  const nav = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/session/${sessionId}`);
        if (!r.ok) {
          // stop polling on not found/invalid
          if (r.status === 404 || r.status === 400) { setIsActive(false); return; }
          return; // transient
        }
        const d = await r.json();
        if (cancelled) return;
        setIsActive(Boolean(d.isActive));
        if (d.expiresAt) setExpiresAt(new Date(d.expiresAt));
      } catch {
        // network issue; ignore and retry on next tick
      } finally {
        if (!cancelled && isActive) setTimeout(poll, 1000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (expiresAt && Date.now() > expiresAt.getTime()) setIsActive(false);
  }, [expiresAt]);

  // Local aligned 1s ticker for smooth countdown
  useEffect(() => {
    if (!expiresAt || !isActive) return;
    let cancelled = false;
    const schedule = () => {
      const delay = Math.max(0, 1000 - (Date.now() % 1000)) + 5;
      const t = setTimeout(() => {
        if (!cancelled) {
          setNow(Date.now());
          schedule();
        }
      }, delay);
      return t;
    };
    const handle = schedule();
    return () => { cancelled = true; clearTimeout(handle as any); };
  }, [expiresAt, isActive]);

  const link = useMemo(() => (typeof window !== 'undefined' ? `${window.location.origin}/attend/${sessionId ?? ""}` : `/attend/${sessionId ?? ""}`), [sessionId]);
  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000)) : null;
  const mm = remaining != null ? Math.floor(remaining / 60).toString().padStart(2, "0") : "--";
  const ss = remaining != null ? (remaining % 60).toString().padStart(2, "0") : "--";

  const [qrSize, setQrSize] = useState<number>(220);
  useEffect(() => {
    function update() {
      try {
        const w = Math.min(520, Math.max(160, Math.floor((window.innerWidth || 360) * 0.6)));
        setQrSize(w);
      } catch {}
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const userRole = useMemo(() => {
    try { const raw = localStorage.getItem("user"); return raw ? JSON.parse(raw).role : undefined; } catch { return undefined; }
  }, []);
  const location = useLocation();
  const classIdFromState = (location.state as any)?.classId as string | undefined;
  const backHref = classIdFromState ? `/classes/${classIdFromState}` : (userRole === "student" ? "/student" : "/classes");

  return (
    <main className="container mx-auto py-10 text-center">
      <Link to={backHref} className="text-sm text-foreground/70 hover:text-foreground">← Back to class</Link>
      <h1 className="mt-2 text-2xl font-bold">Scan to mark attendance</h1>
      <p className="text-foreground/70">Share this QR or link with students.</p>
      <div className="mt-6 grid place-items-center">
        <div className="p-4 rounded-xl border border-border bg-card">
          <QRCodeCanvas value={link} size={qrSize} includeMargin />
        </div>
        <a href={link} className="mt-3 text-sm underline break-words">{link}</a>
        <div className="mt-4 text-xl font-mono">{mm}:{ss}</div>
        {!isActive && <p className="mt-2 text-destructive">Session ended</p>}
        {!isActive && (
          <button className="mt-4 px-4 py-2 rounded-lg border border-border" onClick={() => nav(-1)}>Return</button>
        )}
      </div>
    </main>
  );
}
