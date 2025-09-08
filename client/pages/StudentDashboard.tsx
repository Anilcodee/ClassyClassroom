import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";

interface ClassItem {
  id?: string;
  _id?: string;
  name: string;
  joinCode?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export default function StudentDashboard() {
  const nav = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [menuOpenFor, setMenuOpenFor] = useState<string>("");
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState<"before" | "after" | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [latestMap, setLatestMap] = useState<
    Record<string, { latestAt: number | null; latestBy: string | null }>
  >({});
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userRaw =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const userId = userRaw ? JSON.parse(userRaw)?.id || null : null;
  const role = userRaw ? JSON.parse(userRaw)?.role || "teacher" : null;

  async function fetchWithRetry(
    url: string,
    init: RequestInit = {},
    attempt = 1,
  ): Promise<Response> {
    const { signal, ...rest } = init as any;
    try {
      // Use globalThis.fetch to avoid potential site wrappers; ensure we always return a Response or a handled error
      const nativeFetch = (globalThis as any).fetch?.bind(globalThis) ?? fetch;
      const resolvedUrl =
        typeof location !== "undefined" &&
        typeof url === "string" &&
        url.startsWith("/")
          ? `${location.origin}${url}`
          : url;
      // Diagnostic: resolved URL
      try {
        console.debug("fetchWithRetry resolvedUrl:", resolvedUrl);
      } catch {}
      const options = {
        ...rest,
        signal,
        credentials: (rest as any).credentials ?? "same-origin",
        mode: (rest as any).mode ?? "cors",
      } as any;
      const res = await nativeFetch(resolvedUrl, options);
      return res;
    } catch (e: any) {
      // Diagnostic logging to help identify failing URL and error
      try {
        // eslint-disable-next-line no-console
        console.error(
          "fetchWithRetry error",
          JSON.stringify({
            url,
            attempt,
            error: String(e && e.message ? e.message : e),
          }),
        );
      } catch {}

      // If fetch throws synchronously (some wrappers may), try an XHR fallback for GET/POST/PATCH
      try {
        const method = (rest && rest.method) || "GET";
        const headers = (rest && rest.headers) || {};
        const body = (rest && rest.body) || null;
        const xhrRes = await new Promise<Response>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open(method, resolvedUrl, true);
            Object.keys(headers || {}).forEach((hk) => {
              try {
                xhr.setRequestHeader(hk, (headers as any)[hk]);
              } catch {}
            });
            xhr.onreadystatechange = () => {
              if (xhr.readyState !== 4) return;
              const hdrs: Record<string, string> = {};
              try {
                const raw = xhr.getAllResponseHeaders() || "";
                raw
                  .trim()
                  .split(/\r?\n/)
                  .forEach((line) => {
                    const idx = line.indexOf(":");
                    if (idx > 0) {
                      const k = line.slice(0, idx).trim();
                      const v = line.slice(idx + 1).trim();
                      hdrs[k] = v;
                    }
                  });
              } catch {}
              const responseInit: ResponseInit = {
                status: xhr.status,
                headers: hdrs,
              };
              resolve(new Response(xhr.responseText, responseInit));
            };
            xhr.onerror = () => reject(new Error("XHR error"));
            if (body) xhr.send(body as any);
            else xhr.send();
          } catch (err) {
            reject(err);
          }
        });
        return xhrRes;
      } catch (xhrErr) {
        // ignore and continue to other handling
      }

      // Normalize abort errors
      const aborted =
        (signal && (signal as any).aborted) ||
        e?.name === "AbortError" ||
        e?.message === "The user aborted a request.";
      if (aborted) {
        return new Response(JSON.stringify({ message: "aborted" }), {
          status: 499,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Retry a few times for transient network errors
      if (
        attempt < 3 &&
        (typeof navigator === "undefined" || navigator.onLine !== false)
      ) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
        try {
          return await fetchWithRetry(url, init, attempt + 1);
        } catch (err) {
          // If recursive call somehow throws, fallthrough to return network error
        }
      }
      // Return a synthetic Response instead of throwing so callers can handle uniformly
      return new Response(JSON.stringify({ message: "Network error" }), {
        status: 0,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  useEffect(() => {
    if (!token) {
      nav("/student-auth");
      return;
    }
    if (role !== "student") {
      nav("/student-auth");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // XHR-based fetch to bypass instrumented window.fetch (eg. FullStory) for critical API calls
  async function xhrFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      try {
        const method = (options && (options as any).method) || "GET";
        const headers = (options && (options as any).headers) || {};
        const body = (options && (options as any).body) || null;
        const resolvedUrl =
          typeof location !== "undefined" && typeof url === "string" && url.startsWith("/")
            ? `${location.origin}${url}`
            : url;
        const xhr = new XMLHttpRequest();
        xhr.open(method, resolvedUrl, true);
        try {
          Object.keys(headers || {}).forEach((hk) => {
            try {
              xhr.setRequestHeader(hk, (headers as any)[hk]);
            } catch {}
          });
        } catch {}
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) return;
          const hdrs: Record<string, string> = {};
          try {
            const raw = xhr.getAllResponseHeaders() || "";
            raw
              .trim()
              .split(/\r?\n/)
              .forEach((line) => {
                const idx = line.indexOf(":");
                if (idx > 0) {
                  const k = line.slice(0, idx).trim();
                  const v = line.slice(idx + 1).trim();
                  hdrs[k] = v;
                }
              });
          } catch {}
          const responseInit: ResponseInit = {
            status: xhr.status,
            headers: hdrs,
          };
          resolve(new Response(xhr.responseText, responseInit));
        };
        xhr.onerror = () => reject(new Error("XHR error"));
        if (body) xhr.send(body as any);
        else xhr.send();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function refresh() {
    try {
      setError(null);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res: Response | null = null;
      // Try XHR first to avoid FullStory or other fetch wrappers interfering
      try {
        res = await xhrFetch("/api/student/classes", { headers });
      } catch (xhrErr) {
        // Fallback to fetchWithRetry
        try {
          res = await fetchWithRetry("/api/student/classes", { headers });
        } catch (fErr) {
          throw fErr;
        }
      }

      const data = await res!.json().catch(() => ({}));
      if (!res!.ok) throw new Error(data?.message || res!.statusText);
      const list = data?.classes || [];
      setClasses(list);

      // Fetch latest message metadata for each class (XHR-first)
      const results = await Promise.allSettled(
        list.map((c: any) =>
          (async () => {
            try {
              const r = await xhrFetch(`/api/classes/${c.id || c._id}/messages?latest=1`, { headers });
              const d = await r.json().catch(() => ({}));
              return {
                id: c.id || c._id,
                latestAt: d?.latestAt ? new Date(d.latestAt).getTime() : null,
                latestBy: d?.latestBy ? String(d.latestBy) : null,
              };
            } catch (err) {
              // fallback to fetchWithRetry
              try {
                const r2 = await fetchWithRetry(`/api/classes/${c.id || c._id}/messages?latest=1`, { headers });
                const d2 = await r2.json().catch(() => ({}));
                return {
                  id: c.id || c._id,
                  latestAt: d2?.latestAt ? new Date(d2.latestAt).getTime() : null,
                  latestBy: d2?.latestBy ? String(d2.latestBy) : null,
                };
              } catch (e2) {
                return { id: c.id || c._id, latestAt: null, latestBy: null };
              }
            }
          })(),
        ),
      );
      const map: Record<string, { latestAt: number | null; latestBy: string | null }> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled")
          map[(r.value as any).id] = {
            latestAt: (r.value as any).latestAt,
            latestBy: (r.value as any).latestBy,
          };
      });
      setLatestMap(map);
    } catch (e: any) {
      setError(e.message || "Failed to load classes");
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/student/classes/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText);
      setJoinCode("");
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to join class");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">Student dashboard</h1>
      <p className="text-foreground/70">
        Join your class with a code from your teacher and see your classes
        below.
      </p>

      <form
        onSubmit={handleJoin}
        className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl"
      >
        <input
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2"
          placeholder="Enter join code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          required
        />
        <button
          disabled={joining}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {joining ? "Joining…" : "Join class"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-3">Your classes</h2>
        {classes.length === 0 ? (
          <p className="text-foreground/70">
            No classes yet. Join one using the code above.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            {classes.map((c) => {
              const cid = (c as any).id || (c as any)._id;
              return (
                <li
                  key={cid}
                  className="w-full rounded-xl border border-border overflow-hidden relative"
                >
                  {c.imageUrl ? (
                    <div className="w-full h-36 sm:h-28 md:h-40 lg:h-48">
                      <img
                        src={c.imageUrl}
                        alt="Class cover"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-36 sm:h-28 md:h-40 lg:h-48 bg-muted/50" />
                  )}
                  <div className="p-5 relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col items-start gap-2 min-w-0">
                        <div className="flex items-center gap-0.5 min-w-0">
                          <p className="font-medium truncate flex-1 min-w-0 mr-1">
                            {c.name}
                          </p>
                        </div>

                        <div className="mt-1 flex flex-row gap-2 flex-nowrap sm:flex-wrap">
                          <div className="relative inline-block">
                            <Link
                              to={`/classes/${cid}/messages`}
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  localStorage.setItem(
                                    `lastSeenMsgs:${cid}`,
                                    String(Date.now()),
                                  );
                                } catch {}
                              }}
                              className="h-8 px-2.5 rounded-md text-xs inline-flex items-center justify-center bg-secondary text-secondary-foreground hover:opacity-90"
                              title="Messages"
                            >
                              Messages
                            </Link>
                            {(() => {
                              const meta = latestMap[cid];
                              const key = `lastSeenMsgs:${cid}`;
                              const seen = Number(
                                typeof window !== "undefined"
                                  ? localStorage.getItem(key) || 0
                                  : 0,
                              );
                              const isNew =
                                meta &&
                                meta.latestAt &&
                                (!userId || String(meta.latestBy) !== String(userId)) &&
                                meta.latestAt > seen;
                              return isNew ? (
                                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow ring-2 ring-background" />
                              ) : null;
                            })()}
                          </div>

                          <Link
                            to={`/student/classes/${cid}/attendance`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 px-2.5 rounded-md text-xs inline-flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90"
                            title="My Attendance"
                          >
                            Attendance
                          </Link>
                        </div>

                        <div className="mt-2 text-xs text-foreground/60">Joined</div>
                      </div>

                      <button
                        className="p-1 rounded hover:bg-accent"
                        title="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenFor(menuOpenFor === cid ? "" : String(cid));
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    {menuOpenFor === String(cid) && (
                      <div className="absolute z-20 right-2 top-12 w-44 sm:w-40 rounded-md border border-border bg-background shadow max-w-xs overflow-auto">
                        <div className="sm:hidden block w-full px-2 py-1 text-right">
                          <button
                            className="text-sm"
                            onClick={() => setMenuOpenFor("")}
                          >
                            Close
                          </button>
                        </div>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem("token");
                              const headers: Record<string, string> = {};
                              if (token) headers.Authorization = `Bearer ${token}`;
                              const res = await fetch(
                                `/api/student/classes/${cid}/unenroll`,
                                { method: "DELETE", headers },
                              );
                              const d = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(d?.message || res.statusText);
                              setClasses((prev) =>
                                prev.filter((x) => (x.id || (x as any)._id) !== cid),
                              );
                            } catch (e: any) {
                              setError(e.message || "Failed to unenroll");
                            } finally {
                              setMenuOpenFor("");
                            }
                          }}
                        >
                          Unenrol class
                        </button>
                      </div>
                    )}
                  </div>
                  <span
                    className={
                      "absolute top-2 right-2 text-xs px-2 py-1 rounded-full " +
                      (c.isActive ? "bg-green-600 text-white" : "bg-muted text-foreground/70")
                    }
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
