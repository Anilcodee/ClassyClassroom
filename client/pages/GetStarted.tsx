import { Link } from "react-router-dom";

export default function GetStarted() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-background via-background to-background">
      <section className="container mx-auto grid lg:grid-cols-2 gap-10 py-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground/70 mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
            Fast, secure, classroom attendance
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Attendance in 4 minutes. QR powered.
          </h1>
          <p className="mt-4 text-lg text-foreground/70 max-w-xl">
            Create classes, share a join link or QR, and watch students tick in
            live. Download daily PDFs and keep everything saved in your database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/student" className="px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
              Sign in as Student
            </Link>
            <Link to="/auth" className="px-5 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground">
              Sign in as Teacher
            </Link>
          </div>
          <ul className="mt-8 grid sm:grid-cols-2 gap-4 text-sm text-foreground/80">
            <li className="flex items-center gap-2"><span>✅</span> Login & Sign‑up for teachers</li>
            <li className="flex items-center gap-2"><span>✅</span> Add students manually, via link, or spreadsheet</li>
            <li className="flex items-center gap-2"><span>✅</span> 4‑minute active sessions with auto‑close</li>
            <li className="flex items-center gap-2"><span>✅</span> Live status with green ticks + PDF exports</li>
          </ul>
        </div>
        <div className="relative">
          <TeacherAnimation />
        </div>
      </section>
    </main>
  );
}

function TeacherAnimation() {
  return (
    <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-8 overflow-hidden">
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gradient-to-br from-brand-400/40 to-brand-700/40 blur-3xl" />
      <svg viewBox="0 0 200 200" className="mx-auto h-52">
        <circle cx="100" cy="100" r="90" className="fill-[hsl(var(--muted))]" />
        <g className="origin-[120px_70px] animate-wave">
          <circle cx="120" cy="60" r="12" className="fill-[hsl(var(--brand-500))]" />
        </g>
        <rect x="60" y="110" width="80" height="50" rx="8" className="fill-[hsl(var(--accent))]" />
        <rect x="70" y="120" width="60" height="8" rx="4" className="fill-[hsl(var(--brand-600))]" />
        <rect x="70" y="135" width="40" height="8" rx="4" className="fill-[hsl(var(--brand-500))]" />
      </svg>
      <p className="text-center text-sm text-foreground/70">Animated teacher waving hello 👋</p>
      <style>{`
        @keyframes wave { 0%{transform:rotate(0deg)} 50%{transform:rotate(20deg)} 100%{transform:rotate(0deg)} }
        .animate-wave{ animation: wave 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
