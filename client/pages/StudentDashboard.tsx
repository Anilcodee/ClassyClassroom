import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface ClassItem { id?: string; _id?: string; name: string; joinCode?: string; }

export default function StudentDashboard() {
  const nav = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const role = userRaw ? (JSON.parse(userRaw)?.role || "teacher") : null;
  const isStudent = role === "student";

  useEffect(() => {
    if (!token) { nav("/student-auth"); return; }
    if (isStudent) refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  async function refresh() {
    try {
      setError(null);
      const res = await fetch("/api/student/classes", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText);
      setClasses(data?.classes || []);
    } catch (e: any) {
      setError(e.message || "Failed to load classes");
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    if (!isStudent) { nav("/student-auth"); return; }
    setJoining(true); setError(null);
    try {
      const res = await fetch("/api/student/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
      <p className="text-foreground/70">Join your class with a code from your teacher and see your classes below.</p>

      {!isStudent && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-foreground/80">
          You are signed in as a teacher. To join classes as a student, continue to
          <Link to="/student-auth" className="ml-1 underline">student sign-in</Link>.
        </div>
      )}

      <form onSubmit={handleJoin} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
        <input
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2"
          placeholder="Enter join code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          required
          disabled={!isStudent}
        />
        <button disabled={joining || !isStudent} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
          {joining ? "Joining…" : "Join class"}
        </button>
      </form>
      {isStudent && error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-3">Your classes</h2>
        {!isStudent ? (
          <p className="text-foreground/70">Sign in as a student to see your joined classes.</p>
        ) : classes.length === 0 ? (
          <p className="text-foreground/70">No classes yet. Join one using the code above.</p>
        ) : (
          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <li key={(c as any).id || (c as any)._id} className="rounded-lg border border-border p-4">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-foreground/60">Joined</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 text-sm text-foreground/60">
        Teachers? <Link className="underline" to="/auth">Go to teacher login</Link>
      </div>
    </main>
  );
}
