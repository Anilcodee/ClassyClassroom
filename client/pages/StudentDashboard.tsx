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
  const [latestMap, setLatestMap] = useState<
    Record<string, { latestAt: number | null; latestBy: string | null }>
  >({});
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userRaw =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const userId = userRaw ? JSON.parse(userRaw)?.id || null : null;
  const role = userRaw ? JSON.parse(userRaw)?.role || "teacher" : null;

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

  async function refresh() {
    try {
      setError(null);
      const res = await fetch("/api/student/classes", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText);
      const list = data?.classes || [];
      setClasses(list);
      // Fetch latest message metadata for each class
      const headers = token
        ? { Authorization: `Bearer ${token}` }
        : ({} as any);
      const results = await Promise.allSettled(
        list.map((c: any) =>
          fetch(`/api/classes/${c.id || c._id}/messages?latest=1`, { headers })
            .then((r) => r.json().catch(() => ({})))
            .then((d) => ({
              id: c.id || c._id,
              latestAt: d?.latestAt ? new Date(d.latestAt).getTime() : null,
              latestBy: d?.latestBy ? String(d.latestBy) : null,
            })),
        ),
      );
      const map: Record<
        string,
        { latestAt: number | null; latestBy: string | null }
      > = {};
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
                      <p className="font-medium truncate pr-8">{c.name}</p>
                      <button
                        className="p-1 rounded hover:bg-accent"
                        title="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenFor(
                            menuOpenFor === cid ? "" : String(cid),
                          );
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-foreground/60">
                      Joined
                    </div>
                    {menuOpenFor === String(cid) && (
                      <div className="absolute z-20 right-4 top-12 w-40 rounded-md border border-border bg-background shadow">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem("token");
                              const headers: Record<string, string> = {};
                              if (token)
                                headers.Authorization = `Bearer ${token}`;
                              const res = await fetch(
                                `/api/student/classes/${cid}/unenroll`,
                                { method: "DELETE", headers },
                              );
                              const d = await res.json().catch(() => ({}));
                              if (!res.ok)
                                throw new Error(d?.message || res.statusText);
                              setClasses((prev) =>
                                prev.filter(
                                  (x) => (x.id || (x as any)._id) !== cid,
                                ),
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
                      (c.isActive
                        ? "bg-green-600 text-white"
                        : "bg-muted text-foreground/70")
                    }
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                  <div className="absolute bottom-3 right-3 z-10 flex flex-row gap-2">
                    <div className="relative inline-block">
                      <Link
                        to={`/classes/${cid}/messages`}
                        className="px-2.5 py-1.5 rounded-md text-xs bg-secondary text-secondary-foreground hover:opacity-90 text-center"
                        title="Messages"
                        onClick={() => {
                          try {
                            localStorage.setItem(
                              `lastSeenMsgs:${cid}`,
                              String(Date.now()),
                            );
                          } catch {}
                        }}
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
                          (!userId ||
                            String(meta.latestBy) !== String(userId)) &&
                          meta.latestAt > seen;
                        return isNew ? (
                          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow ring-2 ring-background" />
                        ) : null;
                      })()}
                    </div>
                    <Link
                      to={`/student/classes/${cid}/attendance`}
                      className="px-2.5 py-1.5 rounded-md text-xs border border-border bg-background hover:bg-accent hover:text-accent-foreground text-center"
                      title="My Attendance"
                    >
                      Attendance
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
