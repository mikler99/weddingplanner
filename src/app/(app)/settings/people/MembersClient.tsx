"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNABLE_MODULES } from "@/lib/modules";
import { inviteMember, changeRole, removeMember, revokeInvite, setMemberModules } from "./actions";

type Member = { userId: string; email: string; role: "owner" | "editor" | "viewer"; allowedModules: string[] | null; isSelf: boolean };
type Invite = { id: string; email: string; role: "editor" | "viewer"; token: string; created_at: string };
const ROLE_DESC: Record<string, string> = { owner: "full access + manage people", editor: "can edit everything", viewer: "view only" };

export function MembersClient({ weddingId, isOwner, members, invites }: { weddingId: string; isOwner: boolean; members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [modules, setModules] = useState<string[] | null>(null); // null = all
  const [note, setNote] = useState<{ tone: "good" | "bad" | "muted"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const flash = (tone: "good" | "bad" | "muted", text: string) => { setNote({ tone, text }); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => { const r = await fn(); if (!r.ok) flash("bad", r.error ?? "Something went wrong"); else { if (okMsg) flash("good", okMsg); router.refresh(); } });

  const invite = () =>
    start(async () => {
      const r = await inviteMember(weddingId, email, role, modules);
      if (!r.ok) { flash("bad", r.error); return; }
      setEmail(""); setModules(null);
      flash(r.emailed ? "good" : "muted", r.emailed ? `Invitation emailed to ${email}.` : `Invite created — copy the link to share it.`);
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
            <ModulePicker value={modules} onChange={setModules} />
            <button onClick={invite} disabled={busy || !email} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Invite</button>
          </div>
          <p className="mt-2 text-xs text-faint">They set a password from the invite link and go straight in — no confirmation email.</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-faint">Members</p>
        {members.map((m) => (
          <div key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.email} {m.isSelf && <span className="text-xs text-faint">(you)</span>}</p>
              <p className="text-xs text-faint">{ROLE_DESC[m.role]}{m.role !== "owner" && m.allowedModules ? ` · ${m.allowedModules.length} module${m.allowedModules.length === 1 ? "" : "s"}` : ""}</p>
            </div>
            {isOwner ? (
              <>
                {m.role !== "owner" && <AccessControl weddingId={weddingId} member={m} onSaved={() => router.refresh()} />}
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

// Presentational module multi-select (used when inviting). null = full access.
function ModulePicker({ value, onChange }: { value: string[] | null; onChange: (v: string[] | null) => void }) {
  const [open, setOpen] = useState(false);
  const allKeys = ASSIGNABLE_MODULES.map((m) => m.key);
  const checked = (k: string) => !value || value.includes(k);
  const label = !value ? "Access: Full" : `Access: ${value.length}`;
  const toggle = (k: string) => {
    const cur = value ?? [...allKeys];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    onChange(next.length >= allKeys.length ? null : next);
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-muted hover:text-ink">{label} ▾</button>
      {open && (
        <>
          <button className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-line bg-surface p-2 shadow-lg">
            <p className="px-1 pb-1 text-[11px] text-muted">Can see these pages:</p>
            {ASSIGNABLE_MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={checked(m.key)} onChange={() => toggle(m.key)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                <span>{m.icon} {m.label}</span>
              </label>
            ))}
            <p className="px-1 pt-1 text-[10px] text-faint">Hub is always visible.</p>
          </div>
        </>
      )}
    </div>
  );
}

// Owner control: limit a member to specific modules (pages). All checked = full access.
function AccessControl({ weddingId, member, onSaved }: { weddingId: string; member: Member; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[] | null>(member.allowedModules);
  const [busy, start] = useTransition();
  const allKeys = ASSIGNABLE_MODULES.map((m) => m.key);
  const checked = (k: string) => !sel || sel.includes(k);
  const label = !sel ? "Full access" : `${sel.length} module${sel.length === 1 ? "" : "s"}`;

  const toggle = (k: string) => {
    const cur = sel ?? [...allKeys];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    const val = next.length >= allKeys.length ? null : next; // all → "full access" (null)
    setSel(val);
    start(async () => { await setMemberModules(weddingId, member.userId, val); onSaved(); });
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-ink">{label} ▾</button>
      {open && (
        <>
          <button className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-line bg-surface p-2 shadow-lg">
            <p className="px-1 pb-1 text-[11px] text-muted">Can see these pages:</p>
            {ASSIGNABLE_MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={checked(m.key)} onChange={() => toggle(m.key)} disabled={busy} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                <span>{m.icon} {m.label}</span>
              </label>
            ))}
            <p className="px-1 pt-1 text-[10px] text-faint">Hub is always visible.</p>
          </div>
        </>
      )}
    </div>
  );
}
