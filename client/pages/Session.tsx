import { useEffect, useMemo, useRef, useState } from "react";
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
    let scheduled: any = null;

    const safeLog = (e: any) => {
      try {
        console.warn('Session poll top-level error', e);
      } catch {}
    };

    const scheduleNext = () => {
      try {
        scheduled = setTimeout(() => {
          poll().catch(safeLog);
        }, 1000);
      } catch (e) {
        try {
          safeLog(e);
        } catch {}
      }
    };

    const shouldSkip = () => {
      if (typeof window === 'undefined') return false;
      if (!navigator.onLine) return true;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return true;
      return false;
    };

    const poll = async () => {
      // avoid noisy fetch attempts when offline or when page hidden
      if (shouldSkip()) {
        if (!cancelled && isActive) scheduleNext();
        return;
      }

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 5000);
      try {
        const r = await fetch(`/api/session/${sessionId}`, { signal: ac.signal });
        if (!r.ok) {
          // stop polling on not found/invalid
          if (r.status === 404 || r.status === 400) {
            setIsActive(false);
            return;
          }
          return; // transient
        }
        const d = await r.json().catch(() => null);
        if (cancelled) return;
        setIsActive(Boolean(d?.isActive));
        if (d?.expiresAt) setExpiresAt(new Date(d.expiresAt));
      } catch (e: any) {
        // Log network errors for easier debugging but do not crash
        try {
          if (e && e.name === "AbortError") {
            // request aborted due to timeout or cancellation
          } else {
            console.warn("Session poll fetch failed:", e);
          }
        } catch (err) {}
      } finally {
        clearTimeout(timeout);
        try {
          ac.abort();
        } catch {}
        if (!cancelled && isActive) scheduleNext();
      }
    };

    // kick off the first poll and ensure any rejection is handled
    poll().catch(safeLog);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        // try immediately when tab becomes visible
        poll().catch(safeLog);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      try {
        if (scheduled) clearTimeout(scheduled);
      } catch {}
      try {
        document.removeEventListener('visibilitychange', onVisibility);
      } catch {}
    };
  }, [sessionId, isActive]);

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
    return () => {
      cancelled = true;
      clearTimeout(handle as any);
    };
  }, [expiresAt, isActive]);

  const link = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/attend/${sessionId ?? ""}`
        : `/attend/${sessionId ?? ""}`,
    [sessionId],
  );
  const remaining = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000))
    : null;
  const mm =
    remaining != null
      ? Math.floor(remaining / 60)
          .toString()
          .padStart(2, "0")
      : "--";
  const ss =
    remaining != null ? (remaining % 60).toString().padStart(2, "0") : "--";

  const [qrSize, setQrSize] = useState<number>(220);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      const w = Math.min(520, Math.max(120, Math.floor((window.innerWidth || 360) * 0.6)));
      setQrSize(w);
    }

    let ro: ResizeObserver | null = null;

    function updateSize() {
      try {
        const el = containerRef.current;
        if (!el) return;
        const style = getComputedStyle(el);
        const paddingLeft = parseFloat(style.paddingLeft || "0");
        const paddingRight = parseFloat(style.paddingRight || "0");
        const available = Math.max(120, el.clientWidth - (paddingLeft + paddingRight));
        const size = Math.min(520, Math.floor(available * 0.95));
        setQrSize(size);
      } catch {}
    }

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(updateSize);
      ro.observe(containerRef.current);
      updateSize();
    } else {
      updateSize();
      window.addEventListener("resize", updateSize);
    }

    return () => {
      if (ro && containerRef.current) ro.unobserve(containerRef.current);
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const userRole = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw).role : undefined;
    } catch {
      return undefined;
    }
  }, []);
  const location = useLocation();
  const classIdFromState = (location.state as any)?.classId as
    | string
    | undefined;
  const backHref = classIdFromState
    ? `/classes/${classIdFromState}`
    : userRole === "student"
      ? "/student"
      : "/classes";

  return (
    <main className="min-h-[calc(100vh-56px)] flex items-center justify-center py-10">
      <div className="w-full max-w-lg px-4 text-center">
        <div className="mb-4">
          <Link to={backHref} className="text-sm text-foreground/70 hover:text-foreground">
            <span className="back-arrow">←</span>&nbsp;Back to class
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold">Scan to mark attendance</h1>
        <p className="text-foreground/70">Share this QR or link with students.</p>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div ref={containerRef} className="p-4 rounded-xl border border-border bg-card w-full max-w-[520px]">
            <QRCodeCanvas value={link} size={qrSize} includeMargin style={{ width: '100%', height: 'auto' }} />
          </div>

          {isActive && (
            <a href={link} className="mt-3 text-sm underline break-words max-w-[90vw]">
              {link}
            </a>
          )}

          <div className="mt-2 text-xl font-mono">
            {isActive ? `${mm}:${ss}` : '00:00'}
          </div>

          {!isActive && (
            <>
              <p className="mt-4 text-destructive glow-text text-lg font-semibold">
                Session ended
              </p>
              <button
                className="mt-4 px-4 py-2 rounded-lg border border-border"
                onClick={() => nav(-1)}
              >
                Return
              </button>
            </>
          )}
        </div>

        {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
        <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

      </div>
    </main>
  );
}
