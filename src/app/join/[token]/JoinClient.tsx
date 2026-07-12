"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { claimInvite } from "./actions";

// New invitee: set a password and get straight into the hub — no email
// confirmation. The email is fixed to the one that was invited.
export function JoinClient({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await claimInvite(token, password); // redirects on success
      if (r && !r.ok) setErr(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-6">
      <label className="mb-1 block text-xs text-muted">Your email</label>
      <input type="email" value={email} readOnly className="mb-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted" />
      <label className="mb-1 block text-xs text-muted">Create a password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" autoFocus />
      {err && <p className="mt-2 text-sm text-bad">{err}</p>}
      <button type="submit" disabled={busy || password.length < 8} className="mt-4 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
        {busy ? "Joining…" : "Join & get started"}
      </button>
      <p className="mt-3 text-center text-xs text-faint">Already have an account? <Link href={`/login?next=/join/${token}`} className="text-accent hover:underline">Sign in instead</Link></p>
    </form>
  );
}
