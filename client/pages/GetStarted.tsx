import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";

export default function GetStarted() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-background via-background to-background">
      <section className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 sm:gap-14 py-10 sm:py-14 lg:py-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground/70 mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
            Fast, secure classroom platform for teachers and students
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            All‑in‑one classroom: attendance, messages, and more.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-foreground/70 max-w-xl">
            Teachers can create classes, run timed QR attendance, and post announcements.
            Students join with a code, comment on posts, and track their own attendance.
            PDFs, history, class covers, and role‑based access included.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/student-auth" className="px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 w-full xs:w-auto text-center">
              Sign in as Student
            </Link>
            <Link to="/auth" className="px-5 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground w-full xs:w-auto text-center">
              Sign in as Teacher
            </Link>
          </div>
        </div>
        <div className="space-y-10">
          <div className="w-full max-w-3xl mx-auto">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 text-sm text-foreground/80">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Create and manage classes with cover images</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Start timed QR attendance sessions</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Download PDFs and view attendance history</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Post announcements; edit/delete your posts</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Join classes via secure code</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">See your classes and attendance days</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Comment on announcements (except your own)</span></li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /><span className="flex-1">Clean, mobile‑friendly experience</span></li>
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 items-start text-center">
            <div className="flex flex-col items-center">
              <TeacherAnimation />
              <div className="mt-2 text-sm font-semibold text-foreground/80">For Teachers</div>
            </div>
            <div className="flex flex-col items-center">
              <StudentAnimation />
              <div className="mt-2 text-sm font-semibold text-foreground/80">For Students</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function TeacherAnimation() {
  return (
    <div className="relative mx-auto max-w-2xl lg:max-w-3xl rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-8 sm:p-10 overflow-hidden">
      <div className="absolute -top-20 -right-20 h-72 w-72 lg:h-80 lg:w-80 rounded-full bg-gradient-to-br from-brand-400/40 to-brand-700/40 blur-3xl" />
      <svg viewBox="0 0 200 200" className="mx-auto h-56">
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

function StudentAnimation() {
  return (
    <div className="relative mx-auto max-w-2xl lg:max-w-3xl rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-8 sm:p-10 overflow-hidden">
      <div className="absolute -bottom-16 -left-16 h-72 w-72 lg:h-80 lg:w-80 rounded-full bg-gradient-to-tr from-blue-400/40 to-cyan-700/40 blur-3xl" />
      <svg viewBox="0 0 200 200" className="mx-auto h-56">
        <circle cx="100" cy="100" r="90" className="fill-[hsl(var(--muted))]" />
        {/* Head */}
        <circle cx="90" cy="70" r="12" className="fill-blue-500" />
        {/* Waving hand */}
        <g className="origin-[130px_70px] animate-wave">
          <circle cx="130" cy="70" r="8" className="fill-cyan-500" />
        </g>
        {/* Body/backpack */}
        <rect x="70" y="110" width="60" height="45" rx="10" className="fill-blue-200" />
        <rect x="65" y="115" width="15" height="30" rx="6" className="fill-blue-400" />
      </svg>
      <p className="text-center text-sm text-foreground/70">Animated student waving hello 👋</p>
      <style>{`
        @keyframes wave { 0%{transform:rotate(0deg)} 50%{transform:rotate(20deg)} 100%{transform:rotate(0deg)} }
        .animate-wave{ animation: wave 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
