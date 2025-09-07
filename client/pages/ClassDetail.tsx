import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface ClassDoc {
  _id: string;
  name: string;
  students: { name: string; rollNo: string }[];
  isActive: boolean;
  activeSession?: string | null;
  imageUrl?: string;
}

export default function ClassDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cls, setCls] = useState<ClassDoc | null>(null);
  const [records, setRecords] = useState<
    { student: { name: string; rollNo: string }; markedAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const token = useMemo(() => localStorage.getItem("token"), []);
  const userRole = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw).role : undefined;
    } catch {
      return undefined;
    }
  }, []);

  async function fetchWithRetry(
    url: string,
    init: RequestInit & { timeoutMs?: number } = {},
    attempt = 1,
  ): Promise<Response> {
    const { timeoutMs = 8000, signal, ...rest } = init as any;
    const ac = new AbortController();
    let removedListener = false;
    const onAbort = () => {
      try {
        ac.abort();
      } catch (e) {
        /* ignore */
      }
    };
    try {
      if (signal) {
        if ((signal as AbortSignal).aborted) {
          // Propagate immediately
          ac.abort();
        } else {
          try {
            (signal as AbortSignal).addEventListener("abort", onAbort, {
              once: true,
            });
          } catch (e) {
            /* ignore */
          }
        }
      }
      const t = setTimeout(() => {
        try {
          ac.abort();
        } catch {}
      }, timeoutMs);
      try {
        return await fetch(url, { ...rest, signal: ac.signal });
      } catch (e: any) {
        try {
          const emsg = e && e.message ? e.message : String(e);
          console.error(`fetchWithRetry failed: url=${url} attempt=${attempt} error=${emsg}`, e);
        } catch {}
        if (attempt < 2 && (!signal || !(signal as any).aborted)) {
          await new Promise((r) => setTimeout(r, 400));
          return fetchWithRetry(url, init, attempt + 1);
        }
        // Normalize thrown value to an Error with readable message including the url
        const toThrow = e instanceof Error ? e : new Error(`Fetch failed for ${url}: ${typeof e === 'string' ? e : JSON.stringify(e)}`);
        throw toThrow;
      } finally {
        clearTimeout(t);
      }
    } finally {
      try {
        if (signal && (signal as any).removeEventListener)
          (signal as any).removeEventListener("abort", onAbort as any);
      } catch (e) {}
    }
  }

  async function load(signal?: AbortSignal) {
    if (!token) {
      setError("Please log in");
      nav("/auth");
      return;
    }

    // Avoid noisy fetch errors when offline
    if (typeof window !== "undefined" && !navigator.onLine) {
      setError("You appear to be offline — check your connection.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    try {
      let res: Response | null = null;
      try {
        res = await fetchWithRetry(`/api/classes/${id}`, {
          headers,
          cache: "no-store",
          signal,
        });
      } catch (err: any) {
        // Network-level failure
        try {
          const emsg = err && err.message ? err.message : String(err || '');
          console.warn(`load() network error for /api/classes/${id}:`, emsg, err);
          setError(emsg || "Network error: failed to reach API");
        } catch {
          setError("Network error: failed to reach API");
        }
        setLoading(false);
        return;
      }

      const raw = await res.text().catch(() => "");
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) {
        setError(data?.message || res.statusText || "Request failed");
        setLoading(false);
        return;
      }
      setCls(data.class);

      // Attendance is best-effort
      try {
        if (typeof window !== "undefined" && !navigator.onLine) {
          setRecords([]);
        } else {
          const r = await fetchWithRetry(`/api/classes/${id}/attendance/today`, {
            headers,
            cache: "no-store",
            signal,
          });
          const rraw = await r.text().catch(() => "");
          const rd = rraw ? JSON.parse(rraw) : {};
          setRecords(r.ok ? rd.records || [] : []);
        }
      } catch (e: any) {
        // ignore attendance fetch failures (network or abort)
        setRecords([]);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e && e.message ? e.message : String(e || '');
      setError(msg || "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      nav("/auth");
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        await load(ac.signal);
      } catch (e) {
        console.error('ClassDetail load error (caught):', e);
        // show friendly message
        setError((e as any)?.message || 'Network error');
      }
    })();
    return () => {
      try {
        ac.abort();
      } catch {}
    };
  }, [id, token]);

  // Auto-refresh status while active so button re-enables after 4 minutes
  useEffect(() => {
    if (!cls?.isActive || !cls?.activeSession) return;
    let stop = false;
    const tick = async () => {
      try {
        if (typeof window !== "undefined" && !navigator.onLine) return;
        const r = await fetchWithRetry(`/api/session/${cls.activeSession}`, { timeoutMs: 5000 });
        const d = await r.json().catch(() => null);
        if (d?.expiresAt) setExpiresAt(new Date(d.expiresAt));
        if (!stop && d && d.isActive === false) {
          setCls((prev) =>
            prev
              ? { ...prev, isActive: false, activeSession: null as any }
              : prev,
          );
          setExpiresAt(null);
        }
      } catch (e) {
        // ignore network errors for session polling
      }
    };
    const i = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(i);
    };
  }, [cls?.isActive, cls?.activeSession]);

  // Local second tick for countdown display (aligned to second boundaries)
  useEffect(() => {
    if (!expiresAt) return;
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
  }, [expiresAt]);

  async function activate() {
    try {
      if (!token) throw new Error("Please log in");
      if (typeof window !== "undefined" && !navigator.onLine) {
        setError("You appear to be offline — cannot activate class.");
        return;
      }
      let res: Response | null = null;
      try {
        res = await fetchWithRetry(`/api/classes/${id}/activate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 8000,
        });
      } catch (err: any) {
        const msg = err && err.message ? err.message : String(err || '');
        setError(msg || "Network error: failed to activate class");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || res.statusText || "Activation failed");
        return;
      }
      nav(`/session/${data.sessionId}`, { state: { classId: id } });
    } catch (e: any) {
      const msg = e && e.message ? e.message : String(e || '');
      setError(msg || 'Unexpected error');
      if (msg === "Please log in") nav("/auth");
    }
  }

  const remainingSec = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000))
    : null;
  const mm =
    remainingSec != null
      ? String(Math.floor(remainingSec / 60)).padStart(2, "0")
      : null;
  const ss =
    remainingSec != null ? String(remainingSec % 60).padStart(2, "0") : null;

  const presentKeys = new Set(
    records.map((r) => `${r.student.name}|${r.student.rollNo}`),
  );

  async function togglePresent(
    name: string,
    rollNo: string,
    nextPresent: boolean,
  ) {
    try {
      if (!token) throw new Error("Please log in");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const r = await fetch(`/api/classes/${id}/attendance/manual`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, rollNo, present: nextPresent }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || r.statusText);
      setRecords(d.records || []);
    } catch (e: any) {
      const msg = e && e.message ? e.message : String(e || '');
      setError(msg || "Failed to update");
      if (msg === "Please log in") nav("/auth");
    }
  }

  return (
    <main className="container mx-auto py-8">
      <Link
        to="/classes"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        <span className="back-arrow">←</span>&nbsp;Back to classes
      </Link>
      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : cls ? (
        <div className="mt-4">
          {cls.imageUrl && (
            <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden mb-4">
              <img
                src={cls.imageUrl}
                alt="Class cover"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {cls.name}
                {cls.isActive && mm && ss && (
                  <span className="text-base font-mono px-2 py-1 rounded-md bg-muted text-foreground/80 ml-2 time-lift">
                    {mm}:{ss}
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={cls.isActive}
                onClick={activate}
                className="px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {cls.isActive ? "Inactive class" : "Activate class"}
              </button>
              <button
                onClick={async () => {
                  const token = localStorage.getItem("token");
                  const headers: Record<string, string> = {};
                  if (token) headers.Authorization = `Bearer ${token}`;
                  const res = await fetch(`/api/classes/${id}/attendance/pdf`, {
                    headers,
                  });
                  if (!res.ok) {
                    alert("Failed to download");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${cls?.name || "class"}-${new Date().toISOString().slice(0, 10)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-2 rounded-lg border border-border"
              >
                Download today PDF
              </button>
              <Link
                to={`/classes/${id}/history`}
                className="px-3 py-2 rounded-lg border border-border"
              >
                PDF history
              </Link>
            </div>
          </div>
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Students</h2>
            <div className="rounded-xl border border-border divide-y">
              {(cls.students || []).map((s, i) => {
                const key = `${s.name}|${s.rollNo}`;
                const present = presentKeys.has(key);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={present}
                        disabled={userRole === "student"}
                        title={
                          userRole === "student"
                            ? undefined
                            : present
                              ? "Mark absent"
                              : "Mark present"
                        }
                        onClick={() =>
                          userRole !== "student" &&
                          togglePresent(s.name, s.rollNo, !present)
                        }
                        className={`h-8 w-8 rounded-full grid place-items-center font-semibold border border-border shadow-sm ${present ? "bg-green-500 text-white" : "bg-accent/30 text-foreground/80"} ${userRole !== "student" ? "cursor-pointer hover:opacity-80" : ""}`}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </button>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-foreground/60">
                          Roll: {s.rollNo}
                        </p>
                      </div>
                    </div>
                    {present ? (
                      <span className="text-green-600">✔</span>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
