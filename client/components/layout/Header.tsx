import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function Header() {
  const { pathname } = useLocation();
  const nav = [] as { to: string; label: string }[];
  const [user, setUser] = useState<any>(null);
  const navg = useNavigate();

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      setUser(u ? JSON.parse(u) : null);
    } catch {}
  }, [pathname]);

  const role = user?.role || null;
  const homeLink = role === "teacher" ? "/classes" : role === "student" ? "/student" : "/";
  const dynamicNav = [
    { to: homeLink, label: "Home" },
    ...(role === "teacher" ? [{ to: "/classes", label: "Classes" }] : []),
    ...(role === "student" ? [{ to: "/student", label: "My classes" }] : []),
    { to: "/get-started", label: "Get Started" },
  ];

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navg("/");
  }

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-primary">
          <span className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700"></span>
          Attendify
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {dynamicNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "hover:text-foreground/80 transition-colors",
                pathname === n.to ? "text-foreground" : "text-foreground/60"
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-foreground/70">{user.name}</span>
              <button onClick={logout} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                Log out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/student-auth" className="px-3 py-1.5 rounded-md border border-border hover:bg-accent hover:text-accent-foreground">
                Student login
              </Link>
              <Link to="/auth" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                Teacher login
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
