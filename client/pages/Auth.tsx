import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (!token) return;
    (async () => {
      try {
        localStorage.setItem("token", token);
        const resp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) {
          // clear token on failure
          localStorage.removeItem("token");
          return;
        }
        const user = await resp.json();
        localStorage.setItem("user", JSON.stringify(user));
        window.dispatchEvent(new Event("auth-changed"));
        nav(user?.role === "student" ? "/student" : "/classes");
      } catch (e) {
        console.error(e);
      }
    })();
  }, [location.search, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const emailNorm = email.trim().toLowerCase();
      const nameNorm = name.trim();
      const res = await fetch(`/api/auth/${mode === "signup" ? "signup/teacher" : "login/teacher"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email: emailNorm, name: nameNorm, password, role: "teacher" }
            : { email: emailNorm, password, role: "teacher" }
        ),
      });
      let data: any = null;
      let raw: string | null = null;
      if (!res.bodyUsed) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try { data = await res.json(); } catch { /* ignore */ }
        } else {
          try { raw = await res.text(); data = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }
        }
      }
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || raw || res.statusText || "Request failed";
        throw new Error(`${res.status} ${msg}`);
      }
      localStorage.setItem("token", data?.token);
      localStorage.setItem("user", JSON.stringify(data?.user));
      window.dispatchEvent(new Event("auth-changed"));
      const role = data?.user?.role || "teacher";
      nav(role === "student" ? "/student" : "/classes");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function startGoogle() {
    // open backend endpoint that starts Google OAuth
    window.location.href = `/api/auth/google?role=teacher`;
  }

  return (
    <main className="container mx-auto min-h-[calc(100vh-56px)] grid place-items-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {mode === "signup" ? "Create your teacher account" : "Welcome back"}
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
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
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
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={startGoogle}
            className="w-full rounded-lg border border-border py-2 flex items-center justify-center gap-2 hover:bg-muted"
          >
            <img src="/placeholder.svg" alt="Google" className="w-5 h-5" />
            <span>Sign in with Google</span>
          </button>
        </div>

        <p className="mt-4 text-xs text-foreground/60">
          Secure by design. We use JWT for sessions and store your data in MongoDB.
        </p>
      </div>
    </main>
  );
}
