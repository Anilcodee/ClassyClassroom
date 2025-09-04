import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import React from "react";
import { toast } from "@/hooks/use-toast";
import { MoreVertical } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  joinCode: string;
  isActive: boolean;
  imageUrl?: string;
}
interface NewStudent {
  name: string;
  rollNo: string;
}

export default function Classes() {
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [latestMap, setLatestMap] = React.useState<
    Record<string, { latestAt: number | null; latestBy: string | null }>
  >({});
  const userRaw =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const userId = userRaw ? JSON.parse(userRaw)?.id || null : null;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [showCodeFor, setShowCodeFor] = React.useState<string>("");
  const [menuOpenFor, setMenuOpenFor] = React.useState<string>("");

  async function canReachOrigin(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return true;
      if (navigator.onLine === false) return false;
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        const done = () => {
          cleanup();
          resolve();
        };
        const fail = () => {
          cleanup();
          reject(new Error("unreachable"));
        };
        const cleanup = () => {
          img.onload = null;
          img.onerror = null;
        };
        img.onload = done;
        img.onerror = fail;
        img.src = `/placeholder.svg?ping=${Date.now()}`;
      });
      return true;
    } catch {
      return false;
    }
  }

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
        typeof location !== "undefined" && typeof url === "string" && url.startsWith("/")
          ? `${location.origin}${url}`
          : url;
      // Diagnostic: resolved URL
      try { console.debug("fetchWithRetry resolvedUrl:", resolvedUrl); } catch {}
      const res = await nativeFetch(resolvedUrl, { ...rest, signal });
      return res;
    } catch (e: any) {
      // Diagnostic logging to help identify failing URL and error
      try {
        // eslint-disable-next-line no-console
        console.error("fetchWithRetry error", JSON.stringify({ url, attempt, error: String(e && e.message ? e.message : e) }));
      } catch {}

      // If fetch throws synchronously (some wrappers may), try an XHR fallback for GET/POST/PATCH
      try {
        const method = (rest && rest.method) || "GET";
        const headers = (rest && rest.headers) || {};
        const body = (rest && rest.body) || null;
        const xhrRes = await new Promise<Response>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
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
                raw.trim().split(/\r?\n/).forEach((line) => {
                  const idx = line.indexOf(":");
                  if (idx > 0) {
                    const k = line.slice(0, idx).trim();
                    const v = line.slice(idx + 1).trim();
                    hdrs[k] = v;
                  }
                });
              } catch {}
              const responseInit: ResponseInit = { status: xhr.status, headers: hdrs };
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

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const ok = await canReachOrigin();
      if (!ok) throw new Error("Network error. Please retry.");
      const res = await fetchWithRetry("/api/classes", {
        headers,
        cache: "no-store",
      });
      if (res.status === 0 || res.status === 499)
        throw new Error("Network error. Please retry.");
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.message ||
            (res.status === 401 ? "Please log in" : "Failed to load"),
        );
      const list = data.classes.map((c: any) => ({
        id: c._id,
        name: c.name,
        joinCode: c.joinCode,
        isActive: c.isActive,
        imageUrl: c.imageUrl,
      }));
      setClasses(list);
      // latest map (single request)
      const idsParam = list.map((c: any) => c.id).join(",");
      const latestRes = await fetchWithRetry(
        `/api/messages/latest?classIds=${encodeURIComponent(idsParam)}`,
        { headers, cache: "no-store" },
      );
      if (latestRes.status !== 0 && latestRes.status !== 499) {
        const latestData = await latestRes.json().catch(() => ({}));
        const src = latestData?.latest || {};
        const map: Record<
          string,
          { latestAt: number | null; latestBy: string | null }
        > = {};
        Object.keys(src).forEach((cid) => {
          map[cid] = {
            latestAt: src[cid]?.latestAt
              ? new Date(src[cid].latestAt).getTime()
              : null,
            latestBy: src[cid]?.latestBy ? String(src[cid].latestBy) : null,
          };
        });
        setLatestMap(map);
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  const [imagePickFor, setImagePickFor] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [showActiveOnly, setShowActiveOnly] = React.useState(false);

  async function handlePickedFile(file: File, classId: string) {
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/classes/${classId}/image`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ imageUrl: dataUrl }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || res.statusText);
      toast({ title: "Image added" });
      // Optimistically update UI
      setClasses((prev) =>
        prev.map((c) => (c.id === classId ? { ...c, imageUrl: dataUrl } : c)),
      );
    } catch (e: any) {
      toast({ title: "Failed to add image", description: e.message || "" });
    } finally {
      setImagePickFor(null);
      if ((fileRef as any).current) (fileRef as any).current.value = "";
    }
  }

  return (
    <main className="container mx-auto py-10">
      <input
        ref={fileRef as any}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f || !imagePickFor) return;
          if (f.size > 2 * 1024 * 1024) {
            toast({
              title: "Image too large",
              description: "Please select an image under 2MB.",
            });
            (fileRef as any).current && ((fileRef as any).current.value = "");
            return;
          }
          void handlePickedFile(f, imagePickFor);
        }}
      />
      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        <div className="md:col-span-2">
          <MakeClassCard onCreated={load} />
        </div>
        <aside className="md:col-span-1 space-y-5 flex flex-col">
          <div className="rounded-2xl border border-border p-5 bg-card shadow flex-none">
            <h3 className="font-semibold mb-2">Downloads</h3>
            <p className="text-sm text-foreground/70 mb-3">
              Download PDF list (all days) for a specific class.
            </p>
            <div className="space-y-2">
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="w-full px-3 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground text-sm disabled:opacity-50"
                disabled={!selectedId}
                onClick={async () => {
                  const token = localStorage.getItem("token");
                  const headers: Record<string, string> = {};
                  if (token) headers.Authorization = `Bearer ${token}`;
                  const res = await fetch(
                    `/api/classes/${selectedId}/attendance/pdf/all`,
                    { headers },
                  );
                  if (!res.ok) {
                    alert("Failed to download");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `attendance-all-days.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download PDF list (all days)
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-5 bg-card shadow flex-1 flex flex-col">
            <h3 className="font-semibold mb-2">Archived classes</h3>
            <Link to="/classes/archived" className="flex-1">
              <button className="w-full h-full flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
                View archived classes
              </button>
            </Link>
          </div>
        </aside>
        <div className="md:col-span-3">
          <h2 className="mt-8 mb-3 text-lg font-semibold">Your classes</h2>
          <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search classes by name…"
              className="w-full sm:max-w-sm rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                className="rounded border border-input"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
              />
              Active only
            </label>
          </div>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-foreground/70">
              No classes yet. Create one to get started.
            </p>
          ) : (
            (() => {
              const filtered = classes.filter((c) => {
                const matchesQuery =
                  !query || c.name.toLowerCase().includes(query.toLowerCase());
                const matchesActive = !showActiveOnly || c.isActive;
                return matchesQuery && matchesActive;
              });
              if (classes.length > 0 && filtered.length === 0) {
                return (
                  <p className="text-sm text-foreground/70">
                    No matching classes.
                  </p>
                );
              }
              return (
                <ul className="space-y-3">
                  {filtered.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-border overflow-hidden relative min-h-40 md:min-h-56"
                    >
                      {!c.imageUrl && (
                        <button
                          className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded-md border border-border bg-background/80 hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePickFor(c.id);
                            (fileRef as any).current?.click();
                          }}
                          title="Add image"
                        >
                          + Add image
                        </button>
                      )}
                      {c.imageUrl ? (
                        <div className="w-full h-28 md:h-40">
                          <img
                            src={c.imageUrl}
                            alt="Class cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-28 md:h-40 bg-muted/50" />
                      )}
                      <div className="p-5 relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col items-start gap-2 min-w-0">
                            <div className="flex items-center gap-0.5 min-w-0">
                              <p className="font-medium truncate flex-1 min-w-0 mr-1">{c.name}</p>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  className="p-1 rounded border border-border hover:bg-accent group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const code = c.joinCode;
                                    navigator.clipboard
                                      .writeText(code)
                                      .then(() => {
                                        toast({ title: "Copied", description: "Join code copied" });
                                      })
                                      .catch(() => {});
                                  }}
                                  onMouseEnter={(e) => {
                                    e.stopPropagation();
                                    setShowCodeFor(c.id);
                                  }}
                                  onMouseLeave={() => setShowCodeFor("")}
                                  title="Copy join code"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                </button>
                                {showCodeFor === c.id && (
                                  <span className="ml-2 inline-block font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80 shadow">
                                    {c.joinCode}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-1 flex flex-col sm:flex-row gap-2">
                              <Link
                                to={`/classes/${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 px-2.5 rounded-md text-xs inline-flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90"
                                title="View attendance"
                              >
                                Attendance
                              </Link>
                              <div className="relative inline-block">
                                <Link
                                  to={`/classes/${c.id}/messages`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    try {
                                      localStorage.setItem(
                                        `lastSeenMsgs:${c.id}`,
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
                                  const meta = latestMap[c.id];
                                  const key = `lastSeenMsgs:${c.id}`;
                                  const seen = Number(
                                    typeof window !== "undefined"
                                      ? localStorage.getItem(key) || 0
                                      : 0,
                                  );
                                  const isNew =
                                    meta &&
                                    meta.latestAt &&
                                    (!userId ||
                                      String(meta.latestBy) !== String(userId)) &&
                                    meta.latestAt > seen;
                                  return isNew ? (
                                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow ring-2 ring-background" />
                                  ) : null;
                                })()}
                              </div>
                              <Link
                                to={`/classes/${c.id}/modify`}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 px-2.5 rounded-md text-xs inline-flex items-center justify-center border border-border bg-background hover:bg-accent hover:text-accent-foreground"
                                title="Modify class"
                              >
                                Modify
                              </Link>
                            </div>
                          </div>

                          <button
                            className="p-1 rounded hover:bg-accent"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenFor(menuOpenFor === c.id ? "" : c.id);
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        {menuOpenFor === c.id && (
                          <div className="absolute z-20 right-4 top-12 rounded-md border border-border bg-background shadow flex flex-col items-end">
                            <button
                              className="text-left px-2 py-1 text-sm hover:bg-accent whitespace-nowrap ml-auto"
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem("token");
                                  const headers: Record<string, string> = {
                                    "Content-Type": "application/json",
                                  };
                                  if (token)
                                    headers.Authorization = `Bearer ${token}`;
                                  const res = await fetchWithRetry(
                                    `/api/classes/${c.id}/archive`,
                                    { method: "PATCH", headers },
                                  );
                                  const d = await res.json().catch(() => ({}));
                                  if (!res.ok)
                                    throw new Error(
                                      d?.message || res.statusText,
                                    );
                                  toast({ title: "Class archived" });
                                  await load();
                                } catch (e: any) {
                                  toast({
                                    title: "Failed to archive",
                                    description: e.message || "",
                                  });
                                } finally {
                                  setMenuOpenFor("");
                                }
                              }}
                            >
                              Archive class
                            </button>
                          </div>
                        )}
                      </div>
                      <span
                        className={
                          "absolute top-2 right-2 text-xs px-2 py-1 rounded-full " +
                          (c.isActive
                            ? "bg-green-600 text-white"
                            : "bg-muted text-foreground/70")
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </div>
      </div>
    </main>
  );
}

function MakeClassCard({
  onCreated,
}: {
  onCreated: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [coverDataUrl, setCoverDataUrl] = React.useState<string>("");
  const [students, setStudents] = React.useState<NewStudent[]>([
    { name: "", rollNo: "" },
  ]);
  const [duration, setDuration] = React.useState<number>(4);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [joinCode, setJoinCode] = React.useState("");
  const [joining, setJoining] = React.useState(false);

  function setStudent(i: number, patch: Partial<NewStudent>) {
    setStudents((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const token = localStorage.getItem("token");
      const body = {
        name,
        imageUrl: coverDataUrl || undefined,
        durationMinutes: duration,
        students: students.filter((s) => s.name && s.rollNo),
      };
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || res.statusText || "Failed to create");
      setOpen(false);
      setName("");
      setCoverDataUrl("");
      setStudents([{ name: "", rollNo: "" }]);
      await onCreated();
    } catch (e: any) {
      setErr(e.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-6 bg-card shadow min-h-[20rem] md:min-h-[24rem]">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Make your class</h2>
          <p className="text-foreground/70 mt-1">
            Name it, add students manually, via join link, or import a
            spreadsheet.
          </p>
          <div className="mt-4 flex flex-col md:flex-row gap-3">
            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              Create class
            </button>
            <label className="px-4 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground cursor-pointer">
              Import spreadsheet (CSV)
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const rows = text
                    .split(/\r?\n/)
                    .map((r) => r.trim())
                    .filter(Boolean);
                  if (rows.length === 0) return;
                  // Try to detect header
                  let start = 0;
                  let nameIdx = 0;
                  let rollIdx = 1;
                  const first = rows[0]
                    .split(",")
                    .map((c) => c.trim().toLowerCase());
                  if (
                    first.some((h) => h.includes("name")) ||
                    first.some((h) => h.includes("roll"))
                  ) {
                    nameIdx = first.findIndex((h) => h.includes("name"));
                    rollIdx = first.findIndex((h) => h.includes("roll"));
                    start = 1;
                  }
                  const parsed = [] as { name: string; rollNo: string }[];
                  for (let i = start; i < rows.length; i++) {
                    const cols = rows[i].split(",").map((c) => c.trim());
                    const n = cols[nameIdx] || cols[0];
                    const r = cols[rollIdx] || cols[1];
                    if (n && r) parsed.push({ name: n, rollNo: r });
                  }
                  setStudents((prev) => [
                    ...prev.filter((s) => s.name || s.rollNo),
                    ...parsed,
                  ]);
                }}
              />
            </label>
          </div>
          <div className="mt-3 rounded-xl border border-border p-3 bg-background/50">
            <p className="text-sm font-medium mb-2">Join class as co‑teacher</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2"
                placeholder="Enter class code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button
                className="px-4 py-2 rounded-lg border border-border disabled:opacity-50"
                disabled={joining || !joinCode}
                onClick={async () => {
                  setJoining(true);
                  setErr(null);
                  try {
                    const token = localStorage.getItem("token");
                    const res = await fetch("/api/classes/join-as-teacher", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                      },
                      body: JSON.stringify({ joinCode: joinCode.trim() }),
                    });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(d?.message || res.statusText);
                    toast({
                      title: "Joined as co‑teacher",
                      description: d?.class?.name || "",
                    });
                    setJoinCode("");
                    await onCreated();
                  } catch (e: any) {
                    setErr(e.message || "Failed to join");
                    toast({
                      title: "Failed to join",
                      description: e.message || "",
                    });
                  } finally {
                    setJoining(false);
                  }
                }}
              >
                {joining ? "Joining…" : "Join"}
              </button>
            </div>
          </div>
        </div>
        <div className="w-40 h-40 md:w-48 md:h-48 relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-400/30 to-brand-700/30 blur-2xl" />
          <TeacherLoop />
        </div>
      </div>

      {open && (
        <div className="mt-6 border-t border-border pt-6">
          <div className="grid gap-3">
            <label className="text-sm">Class name</label>
            <input
              className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Physics 101"
            />
          </div>
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Cover image</label>
            <input
              type="file"
              accept="image/*"
              className="rounded-lg border border-input bg-background px-3 py-2"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  setCoverDataUrl("");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () =>
                  setCoverDataUrl(String(reader.result || ""));
                reader.readAsDataURL(f);
              }}
            />
            {coverDataUrl && (
              <div className="h-32 w-full rounded-lg overflow-hidden border border-border">
                <img
                  src={coverDataUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Active session duration (minutes)</label>
            <select
              className="rounded-lg border border-input bg-background px-3 py-2"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} minute{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Students</label>
              <button
                className="text-sm text-foreground/70 hover:text-foreground"
                onClick={() =>
                  setStudents((s) => [...s, { name: "", rollNo: "" }])
                }
              >
                + Add student
              </button>
            </div>
            <div className="space-y-2">
              {students.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    className="col-span-7 rounded-lg border border-input bg-background px-3 py-2"
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) => setStudent(i, { name: e.target.value })}
                  />
                  <input
                    className="col-span-4 rounded-lg border border-input bg-background px-3 py-2"
                    placeholder="Roll No."
                    value={s.rollNo}
                    onChange={(e) => setStudent(i, { rollNo: e.target.value })}
                  />
                  <button
                    className="col-span-1 text-sm text-destructive"
                    onClick={() =>
                      setStudents((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-4 flex gap-3">
            <button
              disabled={saving || !name}
              onClick={submit}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherLoop() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <circle cx="100" cy="100" r="80" className="fill-[hsl(var(--muted))]" />
      <g>
        <rect
          x="60"
          y="120"
          width="80"
          height="40"
          rx="8"
          className="fill-[hsl(var(--accent))]"
        />
        <circle
          cx="120"
          cy="80"
          r="10"
          className="fill-[hsl(var(--brand-600))]"
        >
          <animate
            attributeName="cy"
            values="80;70;80"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}
