import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Header() {
  const { pathname } = useLocation();
  const nav = [
    { to: "/", label: "Home" },
    { to: "/classes", label: "Classes" },
  ];
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-primary">
          <span className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700"></span>
          Attendify
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {nav.map((n) => (
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
          <Link to="/auth" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
