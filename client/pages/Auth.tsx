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
            <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#4285F4" d="M24 12c3.31 0 6.11 1.2 8.19 2.99l6.13-6.13C34.86 5.04 29.7 3 24 3 14.62 3 6.86 8.9 3.7 17.7l7.3 5.64C12.9 15.77 17.98 12 24 12z" />
              <path fill="#34A853" d="M46.5 24c0-1.6-.14-3.14-.4-4.63H24v8.78h12.91c-.56 3.03-2.27 5.6-4.86 7.32l7.45 5.78C43.97 36.69 46.5 30.78 46.5 24z" />
              <path fill="#FBBC05" d="M10.99 28.34A13.95 13.95 0 0 1 9 24c0-1.33.2-2.6.57-3.79L3.7 14.7A23.84 23.84 0 0 0 0 24c0 3.7.9 7.2 2.7 10.3l8.29-6z" />
              <path fill="#EA4335" d="M24 45c6.7 0 12.86-2.04 17.32-5.54l-7.45-5.78C30.11 34.8 27.31 36 24 36c-6.02 0-11.1-3.77-13.01-9.34l-7.3 5.64C6.86 39.1 14.62 45 24 45z" />
            </svg>
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
