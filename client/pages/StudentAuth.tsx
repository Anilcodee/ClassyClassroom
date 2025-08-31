import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function StudentAuth() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  // If already authenticated, go to student dashboard
  // eslint-disable-next-line react-hooks/rules-of-hooks
  require("react").useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("token");
    if (t) nav("/student");
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email, name, password, role: "student", rollNo }
            : { email, password }
        ),
      });
      let data: any = null;
      let raw: string | null = null;
      if (!res.bodyUsed) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try { data = await res.json(); } catch {}
        } else {
          try { raw = await res.text(); data = raw ? JSON.parse(raw) : null; } catch {}
        }
      }
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || raw || res.statusText || "Request failed";
        throw new Error(`${res.status} ${msg}`);
      }
      localStorage.setItem("token", data?.token);
      localStorage.setItem("user", JSON.stringify(data?.user));
      const role = data?.user?.role || "teacher";
      nav(role === "student" ? "/student" : "/classes");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto min-h-[calc(100vh-56px)] grid place-items-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {mode === "signup" ? "Create your student account" : "Student login"}
          </h1>
          <button
            className="text-sm text-foreground/70 hover:text-foreground"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Have an account? Log in" : "New here? Sign up"}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Roll number</label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2 font-semibold hover:opacity-90 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create student account" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-foreground/60">
          Students can join classes using a code from their teacher and see their joined classes here.
        </p>
      </div>
    </main>
  );
}
