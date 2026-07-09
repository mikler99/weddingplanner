"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, changeRole, removeMember, revokeInvite } from "./actions";

type Member = { userId: string; email: string; role: "owner" | "editor" | "viewer"; isSelf: boolean };
type Invite = { id: string; email: string; role: "editor" | "viewer"; token: string; created_at: string };
const ROLE_DESC: Record<string, string> = { owner: "full access + manage people", editor: "can edit everything", viewer: "view only" };

export function MembersClient({ weddingId, isOwner, members, invites }: { weddingId: string; isOwner: boolean; members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [note, setNote] = useState<{ tone: "good" | "bad" | "muted"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const flash = (tone: "good" | "bad" | "muted", text: string) => { setNote({ tone, text }); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => { const r = await fn(); if (!r.ok) flash("bad", r.error ?? "Something went wrong"); else { if (okMsg) flash("good", okMsg); router.refresh(); } });

  const invite = () =>
    start(async () => {
      const r = await inviteMember(weddingId, email, role);
      if (!r.ok) { flash("bad", r.error); return; }
      setEmail("");
      flash(r.emailed ? "good" : "muted", r.emailed ? `Invitation emailed to ${email}.` : `Invite created — copy the link to share (email isn't set up).`);
      router.refresh();
    });

  const copy = (token: string, id: string) => { navigator.clipboard.writeText(`${location.origin}/join/${token}`).then(() => { setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500); }); };

  return (
    <div>
      {note && <p className={`mb-4 rounded-md px-3 py-2 text-sm ${note.tone === "good" ? "bg-good/10 text-good" : note.tone === "bad" ? "bg-bad/10 text-bad" : "bg-surface-2 text-muted"}`}>{note.text}</p>}

      {isOwner && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Invite someone</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="min-w-[200px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
              <option value="viewer">Viewer (view only)</option>
              <option value="editor">Editor (can edit)</option>
            </select>
            <button onClick={invite} disabled={busy || !email} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Invite</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-faint">Members</p>
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.email} {m.isSelf && <span className="text-xs text-faint">(you)</span>}</p>
              <p className="text-xs text-faint">{ROLE_DESC[m.role]}</p>
            </div>
            {isOwner ? (
              <>
                <select value={m.role} onChange={(e) => run(() => changeRole(weddingId, m.userId, e.target.value as Member["role"]))} disabled={busy} className="rounded-md border border-line bg-surface px-2 py-1 text-xs">
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                {!m.isSelf && <button onClick={() => confirm(`Remove ${m.email}?`) && run(() => removeMember(weddingId, m.userId))} disabled={busy} className="text-xs text-faint hover:text-bad">Remove</button>}
              </>
            ) : (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs capitalize text-muted">{m.role}</span>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-surface">
          <p className="border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-faint">Pending invites</p>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="text-xs text-faint capitalize">{i.role} · invited</p>
              </div>
              {isOwner && (
                <>
                  {i.token && <button onClick={() => copy(i.token, i.id)} className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:text-accent">{copied === i.id ? "Copied ✓" : "Copy link"}</button>}
                  <button onClick={() => run(() => revokeInvite(i.id))} disabled={busy} className="text-xs text-faint hover:text-bad">Revoke</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
