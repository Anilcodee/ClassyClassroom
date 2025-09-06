import { useParams } from "react-router-dom";
import { useState } from "react";

export default function Attend() {
  const { sessionId } = useParams();
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [marked, setMarked] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (marked) return; setLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rollNo }),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || res.statusText);
      setMsg("Attendance marked ✅");
      setMarked(true);
    } catch (e: any) {
      setMsg(e.message || "Failed to mark");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">Mark your attendance</h1>
      <p className="text-foreground/70">Enter your name and roll number.</p>
      <form onSubmit={submit} className="mt-6 max-w-md space-y-3">
        <input className="w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} required disabled={marked} />
        <input className="w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="Roll No." value={rollNo} onChange={(e)=>setRollNo(e.target.value)} required disabled={marked} />
        {msg && <p className={"text-sm " + (msg.includes("✅") ? "text-green-600" : "text-destructive")}>{msg}</p>}
        <button disabled={loading || marked} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50" type="submit">{marked ? 'Marked' : loading? 'Submitting…' : 'Submit'}</button>
      </form>
      {/* Mobile-only bottom spacer to avoid cutoff behind OS UI */}
      <div className="h-24 lg:hidden pb-[env(safe-area-inset-bottom)]" />

    </main>
  );
}
