"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { sendInvites } from "./actions";

type Host = { id: string; name: string; email: string | null; token: string };

export function SendClient({ coupleName, hosts }: { coupleName: string; hosts: Host[] }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "good" | "bad" | "muted"; text: string } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => setOrigin(location.origin), []);
  const linkFor = (h: Host) => `${origin}/i/${h.token}`;

  const withEmail = useMemo(() => hosts.filter((h) => h.email), [hosts]);
  const missing = hosts.length - withEmail.length;

  const flash = (tone: "good" | "bad" | "muted", text: string) => { setNote({ tone, text }); setTimeout(() => setNote(null), 6000); };

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500); }
    catch { flash("bad", "Couldn’t copy to clipboard."); }
  };

  const copyAll = () => copy(hosts.map((h) => `${h.name}: ${linkFor(h)}`).join("\n"), "__all");

  const exportCsv = () => {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const csv = ["name,email,invite_link", ...hosts.map((h) => [esc(h.name), esc(h.email ?? ""), esc(linkFor(h))].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "wedding-invites.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const send = () =>
    start(async () => {
      const recipients = withEmail.map((h) => ({ name: h.name, email: h.email as string, url: linkFor(h) }));
      if (!recipients.length) { flash("bad", "No guests have an email address yet."); return; }
      const res = await sendInvites(coupleName, recipients);
      if (res.ok) {
        const base = `Sent ${res.sent} invitation${res.sent === 1 ? "" : "s"}${res.failed ? ` · ${res.failed} failed` : ""}.`;
        flash(res.failed ? "bad" : "good", res.reason ? `${base} ${res.reason}` : base);
      } else flash(res.notConfigured ? "muted" : "bad", res.error);
    });

  return (
    <div>
      {note && (
        <p className={`mb-4 rounded-md px-3 py-2 text-sm ${note.tone === "good" ? "bg-good/10 text-good" : note.tone === "bad" ? "bg-bad/10 text-bad" : "bg-surface-2 text-muted"}`}>{note.text}</p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Tally label="Invitations" value={hosts.length} sub="one per household" />
        <Tally label="With email" value={withEmail.length} sub="ready to send" tone="good" />
        <Tally label="Missing email" value={missing} sub={missing ? "add emails to send" : "all set"} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={copyAll} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-surface-2">
          {copied === "__all" ? "Copied ✓" : "Copy all links"}
        </button>
        <button onClick={exportCsv} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-surface-2">Export CSV</button>
        <button onClick={send} disabled={busy || !withEmail.length} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Sending…" : `Email ${withEmail.length || ""} invite${withEmail.length === 1 ? "" : "s"}`.trim()}
        </button>
      </div>

      {hosts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-faint">No guests yet — add some on the guest list first.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-semibold">Guest</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Personal link</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                  <td className="px-3 py-2 font-medium">{h.name}</td>
                  <td className="px-3 py-2">{h.email ? <span className="text-muted">{h.email}</span> : <span className="text-faint">— no email —</span>}</td>
                  <td className="px-3 py-2"><span className="text-xs text-faint">{origin}/i/{h.token.slice(0, 8)}…</span></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => copy(linkFor(h), h.id)} className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition hover:text-accent">
                        {copied === h.id ? "Copied ✓" : "Copy"}
                      </button>
                      {h.email && (
                        <a href={`mailto:${h.email}?subject=${encodeURIComponent(`You're invited — ${coupleName}`)}&body=${encodeURIComponent(`Dear ${h.name},\n\nWe'd love for you to join us. View your invitation and RSVP here:\n${linkFor(h)}\n\nWith love,\n${coupleName}`)}`}
                          className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition hover:text-accent">Email</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tally({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "good" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "good" ? "text-good" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}
