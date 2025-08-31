import { useEffect, useMemo, useState } from "react";
import { QRCode } from "qrcode.react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function Session() {
  const { sessionId } = useParams();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const i = setInterval(() => {
      fetch(`/api/session/${sessionId}`)
        .then((r) => r.json())
        .then((d) => {
          setIsActive(Boolean(d.isActive));
          if (d.expiresAt) setExpiresAt(new Date(d.expiresAt));
        })
        .catch(() => {});
    }, 1000);
    return () => clearInterval(i);
  }, [sessionId]);

  useEffect(() => {
    if (expiresAt && Date.now() > expiresAt.getTime()) setIsActive(false);
  }, [expiresAt]);

  const link = useMemo(() => `${window.location.origin}/attend/${sessionId}`, [sessionId]);
  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : null;
  const mm = remaining != null ? Math.floor(remaining / 60).toString().padStart(2, "0") : "--";
  const ss = remaining != null ? (remaining % 60).toString().padStart(2, "0") : "--";

  return (
    <main className="container mx-auto py-10 text-center">
      <Link to="/classes" className="text-sm text-foreground/70 hover:text-foreground">← Back to classes</Link>
      <h1 className="mt-2 text-2xl font-bold">Scan to mark attendance</h1>
      <p className="text-foreground/70">Share this QR or link with students.</p>
      <div className="mt-6 grid place-items-center">
        <div className="p-4 rounded-xl border border-border bg-card">
          <QRCode value={link} size={220} includeMargin />
        </div>
        <a href={link} className="mt-3 text-sm underline break-all">{link}</a>
        <div className="mt-4 text-xl font-mono">{mm}:{ss}</div>
        {!isActive && <p className="mt-2 text-destructive">Session ended</p>}
        {!isActive && (
          <button className="mt-4 px-4 py-2 rounded-lg border border-border" onClick={() => nav(-1)}>Return</button>
        )}
      </div>
    </main>
  );
}
