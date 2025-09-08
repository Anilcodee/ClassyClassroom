import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function Header() {
  const { pathname } = useLocation();
  const nav = [] as { to: string; label: string }[];
  const [user, setUser] = useState<any>(null);
  const navg = useNavigate();

  useEffect(() => {
    function readUser() {
      try {
        const u = localStorage.getItem("user");
        setUser(u ? JSON.parse(u) : null);
      } catch {}
    }
    readUser();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "user" || e.key === "token") readUser();
    };
    const onAuthChanged = () => readUser();
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", onAuthChanged as any);

    // Warm up connectivity using image ping to avoid fetch errors in console
    let interval: any;
    const pingImg = () => {
      try {
        const img = new Image();
        img.src = `/placeholder.svg?warm=${Date.now()}`;
      } catch {}
    };
    pingImg();
    interval = setInterval(
      () => {
        pingImg();
      },
      10 * 60 * 1000,
    );

    // Global handler to suppress AbortError unhandledrejection noise
    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      try {
        const reason: any = (ev && (ev as any).reason) || ev;
        if (!reason) return;
        if (
          reason?.name === "AbortError" ||
          String(reason).toLowerCase().includes("aborted") ||
          String(reason).toLowerCase().includes("signal")
        ) {
          ev.preventDefault();
        }
      } catch {}
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChanged as any);
      window.removeEventListener("unhandledrejection", onUnhandledRejection as any);
      if (interval) clearInterval(interval);
    };
  }, []);

  const role = user?.role || null;
  const roleHome =
    role === "teacher" ? "/classes" : role === "student" ? "/student" : "/";
  const dynamicNavRaw = user
    ? [
        { to: roleHome, label: "Home" },
        ...(role === "teacher" ? [] : []),
        ...(role === "student" ? [] : []),
      ]
    : [{ to: "/", label: "Get Started" }];
  const dynamicNav = dynamicNavRaw.filter(
    (item, idx, arr) => arr.findIndex((i) => i.to === item.to) === idx,
  );

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-changed"));
    setUser(null);
    navg("/");
  }

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between gap-3">
        <Link
          to={user ? (role === "teacher" ? "/classes" : "/student") : "/"}
          className="flex min-w-0 items-center gap-2 font-extrabold text-primary"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white p-0.5">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F90e67de179a242f89a562f2630372521%2F391d17bbac48437d8d7c714743a9009e?format=webp&width=800"
              alt="ClassyClassroom"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="truncate">ClassyClassroom</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {dynamicNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "hover:text-foreground/80 transition-colors",
                pathname === n.to ? "text-foreground" : "text-foreground/60",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 flex-wrap">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-foreground/70">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                Log out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/student-auth"
                className="px-2 py-1 rounded-md border border-border hover:bg-accent hover:text-accent-foreground text-sm sm:text-sm"
              >
                Student
              </Link>
              <Link
                to="/auth"
                className="px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm sm:text-sm"
              >
                Teacher
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
