import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function GoogleComplete() {
  const location = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(location.search);
  const emailParam = params.get("email") || "";
  const nameParam = params.get("name") || "";
  const roleParam = params.get("role") || "teacher";
  const idTokenParam = params.get("id_token") || undefined;
  const existing = params.get("existing") === "1";

  const [email] = useState(emailParam);
  const [name, setName] = useState(nameParam);
  const [password, setPassword] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no email present, redirect back to login
    if (!email) {
      nav("/auth");
    }
  }, [email, nav]);

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = { email, name, password, role: roleParam };
      if (idTokenParam) body.idToken = idTokenParam;
      if (rollNo) body.rollNo = rollNo;

      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && (data.message || data.error)) ||
            res.statusText ||
            "Request failed",
        );
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-changed"));
      nav(data.user.role === "student" ? "/student" : "/classes");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto min-h-[calc(100vh-56px)] grid place-items-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">
          Finish signing up with Google
        </h2>
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
              value={email}
              readOnly
            />
          </div>

          {roleParam === "student" && (
            <div>
              <label className="block text-sm mb-1">Roll number</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required={!existing}
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-xs text-foreground/60 mt-1">
              This password will be used to link or create your account for
              email/password sign-in.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2 font-semibold hover:opacity-90 disabled:opacity-60"
            type="submit"
          >
            {loading
              ? "Please wait…"
              : existing
                ? "Verify and link account"
                : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
