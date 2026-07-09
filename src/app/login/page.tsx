import Link from "next/link";
import { login, signup } from "./actions";

const MESSAGES: Record<string, string> = {
  "no-wedding":
    "You're signed in, but your account isn't linked to a wedding yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; next?: string }>;
}) {
  const { e, m, next } = await searchParams;
  const notice = m === "check-email" ? "Check your email to confirm your account." : null;
  const error = e ? MESSAGES[e] ?? e : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Wedding Planner</h1>
        <p className="text-sm text-muted">Sign in to your shared plan.</p>
      </div>

      {notice && (
        <p className="rounded-md bg-good/10 px-3 py-2 text-sm text-good">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {safeNext && <p className="rounded-md bg-accent-weak px-3 py-2 text-sm text-accent">Sign in to accept your invitation.</p>}
      <form className="flex flex-col gap-3">
        {safeNext && <input type="hidden" name="next" value={safeNext} />}
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-line px-3 py-2 text-sm"
        />

        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="rounded-md border border-line px-3 py-2 text-sm"
        />

        <div className="mt-2 flex gap-2">
          <button
            formAction={login}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent"
          >
            Log in
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Sign up
          </button>
        </div>
      </form>

      <p className="text-xs text-faint">
        Invite-only. <Link href="/i/demo" className="underline">Have an RSVP link?</Link>
      </p>
    </main>
  );
}
