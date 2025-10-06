import { Link } from "react-router-dom";

export default function Index() {
  return (
    <main className="min-h-[calc(100dvh-56px)] pb-[env(safe-area-inset-bottom)] bg-gradient-to-b from-background via-background to-background">
      <section className="container mx-auto py-16">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-center">Welcome</h1>
        <p className="mt-3 text-center text-foreground/70 max-w-2xl mx-auto">Choose how you want to continue.</p>
        <div className="mt-10 grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link to="/student" className="group rounded-2xl border border-border p-8 hover:bg-accent hover:text-accent-foreground transition">
            <div className="text-xl font-semibold">I am a Student</div>
            <p className="mt-2 text-foreground/70 group-hover:text-accent-foreground/80">Join a class by code and see your classes.</p>
          </Link>
          <Link to="/auth" className="group rounded-2xl border border-border p-8 hover:bg-accent hover:text-accent-foreground transition">
            <div className="text-xl font-semibold">I am a Teacher</div>
            <p className="mt-2 text-foreground/70 group-hover:text-accent-foreground/80">Log in to create and manage your classes.</p>
          </Link>
        </div>
        <div className="mt-10 text-center">
          <Link to="/get-started" className="underline">Learn more and get started</Link>
        </div>
      </section>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
