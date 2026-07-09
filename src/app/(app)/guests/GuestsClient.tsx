"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Guest, GuestsView, Rsvp } from "@/lib/guests-core";
import { summarize } from "@/lib/guests-core";
import * as actions from "./actions";

type ImportRow = { name: string; email?: string; address?: string; side?: string; max_seats?: number; dietary?: string };

// --- CSV parsing (no dependency; handles quoted fields + CRLF) ------------------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  const pushField = () => { cur.push(field); field = ""; };
  const pushRow = () => { if (cur.some((x) => x.trim() !== "")) rows.push(cur); cur = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") pushField();
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; pushField(); pushRow(); }
    else field += c;
  }
  if (field !== "" || cur.length) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const TRUTHY = new Set(["yes", "y", "true", "1", "x", "✓", "✔"]);

// Total seats for a party: an explicit seats/qty column wins; otherwise a
// plus-one column ("plus 1" as a number = extra seats, or a yes/✓ = one +1).
function seatsFor(r: Record<string, string>, pick: (r: Record<string, string>, k: string[]) => string): number | undefined {
  const explicit = parseInt(pick(r, ["seats", "max_seats", "party size", "party_size", "qty", "quantity", "count", "headcount", "guests", "total"]), 10);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, 20);
  const plus = pick(r, ["plus one", "plus 1", "plus-one", "plusone", "+1", "plus ones", "allow plus one"]).toLowerCase();
  if (!plus) return undefined;
  const pn = parseInt(plus, 10);
  if (Number.isFinite(pn) && pn > 0) return Math.min(1 + pn, 20);
  return TRUTHY.has(plus) ? 2 : undefined;
}

function toImportRows(records: Record<string, string>[]): ImportRow[] {
  const pick = (r: Record<string, string>, keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return ""; };
  const out: ImportRow[] = [];
  for (const r of records) {
    const name = pick(r, ["name", "guest", "guest name", "full name", "household"]);
    if (!name) continue;
    out.push({
      name: name.slice(0, 200),
      email: pick(r, ["email", "e-mail", "email address"]) || undefined,
      address: pick(r, ["address", "mailing address"]) || undefined,
      side: pick(r, ["side", "group"]) || undefined,
      max_seats: seatsFor(r, pick),
      dietary: pick(r, ["dietary", "diet", "restrictions", "notes"]) || undefined,
    });
  }
  return out;
}

const RSVP_STYLE: Record<Rsvp, string> = {
  yes: "text-good",
  no: "text-bad",
  pending: "text-muted",
};

export function GuestsClient({ weddingId, guests, guestEstimate, sides }: { weddingId: string } & GuestsView) {
  const router = useRouter();
  const [rows, setRows] = useState<Guest[]>(guests);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: ImportRow[]; fileName: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const copyLink = async (g: Guest) => {
    if (!g.invite_token) return;
    const url = `${location.origin}/i/${g.invite_token}`;
    try { await navigator.clipboard.writeText(url); } catch { setErr("Couldn't copy — link: " + url); return; }
    setCopied(g.id);
    setTimeout(() => setCopied((c) => (c === g.id ? null : c)), 1500);
  };

  useEffect(() => setRows(guests), [guests]);
  const sum = useMemo(() => summarize(rows), [rows]);

  // Lay out hosts each followed by the plus-ones they brought.
  const { ordered, hostName } = useMemo(() => {
    const kids = new Map<string, Guest[]>();
    const tops: Guest[] = [];
    const nameById = new Map<string, string>();
    for (const g of rows) nameById.set(g.id, g.name);
    for (const g of rows) {
      if (g.parent_id) (kids.get(g.parent_id) ?? kids.set(g.parent_id, []).get(g.parent_id)!).push(g);
      else tops.push(g);
    }
    const ordered: { g: Guest; child: boolean }[] = [];
    for (const t of tops) {
      ordered.push({ g: t, child: false });
      for (const k of kids.get(t.id) ?? []) ordered.push({ g: k, child: true });
    }
    return { ordered, hostName: (id: string | null) => (id ? nameById.get(id) ?? "" : "") };
  }, [rows]);

  const patch = (id: string, p: Partial<Guest>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    actions.updateGuest(id, p).then((res) => { if (!res.ok) setErr(res.error); });
  };

  const setRsvp = (g: Guest, rsvp: Rsvp) => {
    // A "yes" defaults attending to the full party until edited; clearing back to
    // pending/no drops the count so it stops feeding the confirmed tally.
    const attending_count = rsvp === "yes" ? g.attending_count ?? g.max_seats : null;
    patch(g.id, { rsvp, attending_count });
  };

  const add = () =>
    start(async () => {
      const res = await actions.addGuest(weddingId);
      if (res.ok && res.id) setRows((rs) => [...rs, { id: res.id!, name: "New guest", invite_token: res.token ?? "", email: null, parent_id: null, address: null, side: null, max_seats: 1, invited: false, rsvp: "pending", attending_count: null, dietary: null, sort: rs.length }]);
      else if (!res.ok) setErr(res.error);
    });

  const remove = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    actions.deleteGuest(id).then((res) => { if (!res.ok) setErr(res.error); });
  };

  const onFile = async (file: File) => {
    setErr(null);
    const mapped = toImportRows(parseCsv(await file.text()));
    if (!mapped.length) { setErr("No guests found — the file needs a Name column with at least one row."); return; }
    setPreview({ rows: mapped, fileName: file.name });
  };

  const confirmImport = () =>
    start(async () => {
      if (!preview) return;
      const res = await actions.importGuests(weddingId, preview.rows);
      if (!res.ok) { setErr(res.error); return; }
      setPreview(null);
      router.refresh();
    });

  const adoptHeadcount = () => start(async () => { const res = await actions.useHeadcount(weddingId, sum.attending); if (!res.ok) setErr(res.error); else router.refresh(); });

  return (
    <div>
      {err && <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      {/* Summary + budget nudge */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tally label="Invited" value={sum.seats} sub={`${sum.invitedParties} of ${sum.parties} parties`} />
        <Tally label="Attending" value={sum.attending} sub="confirmed heads" tone="good" />
        <Tally label="Awaiting reply" value={sum.pending} sub={`${sum.declined} declined`} />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Budget uses</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{guestEstimate}</p>
          {sum.attending > 0 && sum.attending !== guestEstimate ? (
            <button onClick={adoptHeadcount} disabled={pending} className="mt-0.5 text-xs font-medium text-accent hover:underline disabled:opacity-50">
              Use {sum.attending} confirmed →
            </button>
          ) : (
            <p className="mt-0.5 text-xs text-faint">guest count</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={add} disabled={pending} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          + Add guest
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={pending} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">
          Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <span className="text-xs text-faint">Columns: name, email, side, seats (or plus-one), address, dietary — only name is required.</span>
      </div>

      {/* Import preview */}
      {preview && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent-weak/40 p-4">
          <p className="text-sm font-semibold">Import {preview.rows.length} guest{preview.rows.length === 1 ? "" : "s"} from {preview.fileName}?</p>
          <p className="mt-1 text-xs text-muted">First few: {preview.rows.slice(0, 4).map((r) => r.name).join(", ")}{preview.rows.length > 4 ? "…" : ""}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={confirmImport} disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Add them</button>
            <button onClick={() => setPreview(null)} disabled={pending} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-faint">No guests yet. Add someone or import a CSV.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-semibold">Guest</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Side</th>
                <th className="px-3 py-2 font-semibold">Seats</th>
                <th className="px-3 py-2 font-semibold">Invited</th>
                <th className="px-3 py-2 font-semibold">RSVP</th>
                <th className="px-3 py-2 font-semibold">Coming</th>
                <th className="px-3 py-2 font-semibold">Dietary / notes</th>
                <th className="px-3 py-2 font-semibold">Invite</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ordered.map(({ g, child }) =>
                child ? (
                  <tr key={g.id} className="border-b border-line bg-surface-2/30 last:border-0">
                    <td colSpan={10} className="px-3 py-1.5">
                      <span className="pl-6 text-[13px] text-muted">
                        ↳ {g.name} <span className="ml-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">plus-one of {hostName(g.parent_id)}</span>
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                    <td className="px-3 py-1.5 align-top">
                      <TextCell value={g.name} onSet={(v) => patch(g.id, { name: v })} className="w-40 font-medium" placeholder="Name" />
                      <TextCell value={g.address ?? ""} onSet={(v) => patch(g.id, { address: v || null })} className="mt-0.5 w-40 text-xs text-muted" placeholder="Address" />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <TextCell value={g.email ?? ""} onSet={(v) => patch(g.id, { email: v || null })} className="w-44 text-xs" placeholder="email@…" />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <select value={g.side ?? ""} onChange={(e) => patch(g.id, { side: e.target.value || null })} className="rounded-md border border-line bg-surface px-2 py-1 text-sm">
                        <option value="">—</option>
                        {sides.map((s) => <option key={s} value={s}>{s}</option>)}
                        {g.side && !sides.includes(g.side) && <option value={g.side}>{g.side}</option>}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <NumCell value={g.max_seats} min={1} onSet={(n) => patch(g.id, { max_seats: n })} />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <input type="checkbox" checked={g.invited} onChange={(e) => patch(g.id, { invited: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <select value={g.rsvp} onChange={(e) => setRsvp(g, e.target.value as Rsvp)} className={`rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium ${RSVP_STYLE[g.rsvp]}`}>
                        <option value="pending">Pending</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      {g.rsvp === "yes" ? <NumCell value={g.attending_count ?? g.max_seats} min={0} onSet={(n) => patch(g.id, { attending_count: n })} /> : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <TextCell value={g.dietary ?? ""} onSet={(v) => patch(g.id, { dietary: v || null })} className="w-40 text-xs" placeholder="—" />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <button onClick={() => copyLink(g)} disabled={!g.invite_token} className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition hover:text-accent disabled:opacity-40">
                        {copied === g.id ? "Copied ✓" : "Copy link"}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right align-top">
                      <button onClick={() => remove(g.id)} aria-label="Delete guest" className="text-faint transition hover:text-bad">×</button>
                    </td>
                  </tr>
                )
              )}
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

function TextCell({ value, onSet, className = "", placeholder }: { value: string; onSet: (v: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; if (draft !== value) onSet(draft); }}
      onChange={(e) => setDraft(e.target.value)}
      className={`block rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-accent focus:bg-surface ${className}`}
    />
  );
}

function NumCell({ value, min, onSet }: { value: number; min: number; onSet: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <input
      inputMode="numeric"
      value={draft}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; setDraft(String(value)); }}
      onChange={(e) => { const s = e.target.value.replace(/[^0-9]/g, ""); setDraft(s); const n = parseInt(s, 10); if (!Number.isNaN(n) && n >= min) onSet(n); }}
      className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm"
    />
  );
}
