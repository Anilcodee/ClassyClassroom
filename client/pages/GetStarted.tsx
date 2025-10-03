import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(!!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export default function GetStarted() {
  const isDesktop = useIsDesktop();
  return (
    <main className="min-h-[calc(100dvh-56px)] pb-[env(safe-area-inset-bottom)] bg-gradient-to-b from-background via-background to-background">
      <section className="container mx-auto px-4 w-full max-w-[1080px] grid lg:grid-cols-2 gap-8 sm:gap-12 py-10 sm:py-12 items-stretch">
        <div className="max-w-[975px] h-full flex flex-col">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground/70 mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
            Fast, secure classroom platform for teachers and students
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            The smarter way to run your class — attendance, messages, and more.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-foreground/70">
            Create classes, take attendance with QR, share announcements, and
            keep students engaged. Designed to be fast and mobile friendly.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-95 shadow-md w-full sm:w-auto text-center"
            >
              Get started as Teacher
            </Link>
            <Link
              to="/student-auth"
              className="px-5 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground w-full sm:w-auto text-center"
            >
              Try as Student
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Create and manage classes with cover images",
              "Start timed QR attendance sessions",
              "Download PDFs and view attendance history",
              "Post announcements and comments",
            ].map((t) => (
              <div
                key={t}
                className="flex items-start justify-start gap-3 p-3 rounded-lg border border-border bg-white/50"
              >
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="text-sm text-foreground/80">{t}</div>
              </div>
            ))}
          </div>

          {isDesktop && (
            <div className="mt-6 flex-1 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl border border-border bg-card p-4 sm:p-6 flex items-center justify-center">
                <NameSwitcher />
              </div>
            </div>
          )}
        </div>

        <div className="h-full flex flex-col items-stretch gap-6">
          <div className="relative flex-1 rounded-2xl border border-border bg-card shadow-xl overflow-hidden p-4 sm:p-6">
            <div className="absolute -top-12 -right-12 sm:-top-16 sm:-right-16 h-40 w-40 sm:h-48 sm:w-48 rounded-full bg-gradient-to-br from-brand-400/40 to-brand-700/40 blur-3xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg p-3 sm:p-4 bg-background/80 border border-border flex flex-col items-center">
                <TeacherAnimation />
                <div className="mt-3 text-sm font-semibold">For Teachers</div>
                <div className="text-xs text-foreground/60 mt-1">
                  Create classes, take attendance
                </div>
              </div>
              <div className="rounded-lg p-3 sm:p-4 bg-background/80 border border-border flex flex-col items-center">
                <StudentAnimation />
                <div className="mt-3 text-sm font-semibold">For Students</div>
                <div className="text-xs text-foreground/60 mt-1">
                  Join classes, view attendance
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-3 justify-center">
              <Link
                to="/auth"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
              >
                Teacher
              </Link>
              <Link
                to="/student-auth"
                className="px-4 py-2 rounded-md border border-border"
              >
                Student
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4 sm:p-6 bg-card text-foreground/80 shadow-sm">
            <h3 className="text-sm font-semibold mb-2">Why ClassyClassroom?</h3>
            <p className="text-sm">
              Fast, private, and built for classrooms. No clutter — just the
              tools teachers and students need.
            </p>
          </div>
        </div>
      </section>

      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}

function TeacherAnimation() {

  return (
    <div className="relative w-full rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-4 sm:p-6 overflow-hidden">
      <div className="absolute -top-12 -right-12 sm:-top-20 sm:-right-20 h-40 w-40 sm:h-72 sm:w-72 rounded-full bg-gradient-to-br from-brand-400/40 to-brand-700/40 blur-3xl" />
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[240px] mx-auto h-44 sm:h-56"
      >
        <circle cx="100" cy="100" r="90" className="fill-[hsl(var(--muted))]" />
        <g className="origin-[120px_70px] animate-wave">
          <circle
            cx="120"
            cy="60"
            r="12"
            className="fill-[hsl(var(--brand-500))]"
          />
        </g>
        <rect
          x="60"
          y="110"
          width="80"
          height="50"
          rx="8"
          className="fill-[hsl(var(--accent))]"
        />
        <rect
          x="70"
          y="120"
          width="60"
          height="8"
          rx="4"
          className="fill-[hsl(var(--brand-600))]"
        />
        <rect
          x="70"
          y="135"
          width="40"
          height="8"
          rx="4"
          className="fill-[hsl(var(--brand-500))]"
        />
      </svg>
      <p className="text-center text-sm text-foreground/70">
        Animated teacher waving hello 👋
      </p>
      <style>{`
        @keyframes wave { 0%{transform:rotate(0deg)} 50%{transform:rotate(20deg)} 100%{transform:rotate(0deg)} }
        .animate-wave{ animation: wave 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function StudentAnimation() {

  return (
    <div className="relative w-full rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-4 sm:p-6 overflow-hidden">
      <div className="absolute -bottom-8 -left-8 sm:-bottom-16 sm:-left-16 h-40 w-40 sm:h-72 sm:w-72 rounded-full bg-gradient-to-tr from-blue-400/40 to-cyan-700/40 blur-3xl" />
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[240px] mx-auto h-44 sm:h-56"
      >
        <circle cx="100" cy="100" r="90" className="fill-[hsl(var(--muted))]" />
        {/* Head */}
        <circle cx="90" cy="70" r="12" className="fill-blue-500" />
        {/* Waving hand */}
        <g className="origin-[130px_70px] animate-wave">
          <circle cx="130" cy="70" r="8" className="fill-cyan-500" />
        </g>
        {/* Body/backpack */}
        <rect
          x="70"
          y="110"
          width="60"
          height="45"
          rx="10"
          className="fill-blue-200"
        />
        <rect
          x="65"
          y="115"
          width="15"
          height="30"
          rx="6"
          className="fill-blue-400"
        />
      </svg>
      <p className="text-center text-sm text-foreground/70">
        Animated student waving hello 👋
      </p>
    </div>
  );
}

function NameSwitcher() {
  const isDesktop = useIsDesktop();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isDesktop) setActive(false);
  }, [isDesktop]);

  const toggle = () => {
    if (!isDesktop) return;
    setActive((v) => !v);
  };

  if (!isDesktop) return null;

  return (
    <div className="relative w-full max-w-[360px]">
      <div className="overflow-hidden rounded-md shadow-md">
        <div
          className="cursor-pointer select-none"
          onMouseEnter={toggle}
          onClick={toggle}
          role="button"
          aria-pressed={active}
        >
          <div
            className={`w-[200%] flex transform transition-transform duration-500 ease-in-out ${
              active ? "-translate-x-1/2" : "translate-x-0"
            }`}
          >
            <div className="w-1/2 flex items-center justify-center h-14 sm:h-16 text-lg sm:text-2xl font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              Teacher
            </div>
            <div className="w-1/2 flex items-center justify-center h-14 sm:h-16 text-lg sm:text-2xl font-semibold bg-gradient-to-r from-sky-400 to-indigo-600 text-white">
              Student
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
