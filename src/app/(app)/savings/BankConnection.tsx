"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { money0 } from "@/lib/format";
import { createLinkToken, exchangePublicToken, syncBalance, getRecurringSuggestions, acceptSuggestion, unlinkBank, type Suggestion } from "./plaid-actions";

export type BankStatus = { linked: boolean; institution?: string | null; lastBalance?: number; lastSyncedAt?: string | null };

const FREQ_LABEL: Record<string, string> = { monthly: "/mo", weekly: "/wk", biweekly: "/2wk", annual: "/yr" };

export function BankConnection({ status }: { status: BankStatus }) {
  const router = useRouter();
  const [note, setNote] = useState<{ tone: "good" | "bad" | "muted"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  const flash = (tone: "good" | "bad" | "muted", text: string) => setNote({ tone, text });

  const refresh = async () => {
    setBusy("balance"); setNote(null);
    const r = await syncBalance();
    setBusy(null);
    if (r.ok) { flash("good", `Balance updated to ${money0(r.balance ?? 0)}.`); router.refresh(); }
    else flash("bad", r.error);
  };

  const importRecurring = async () => {
    setBusy("recurring"); setNote(null);
    const r = await getRecurringSuggestions();
    setBusy(null);
    if (!r.ok) { flash("bad", r.error ?? "Couldn’t read transactions."); return; }
    if (r.pending) { flash("muted", "Your bank is still preparing your transaction history — check back in a few minutes."); return; }
    setSuggestions(r.suggestions ?? []);
    if (!r.suggestions?.length) flash("muted", "No recurring transactions detected yet.");
  };

  const accept = async (s: Suggestion, i: number) => {
    const r = await acceptSuggestion(s);
    if (r.ok) { setSuggestions((cur) => (cur ?? []).filter((_, k) => k !== i)); router.refresh(); }
    else flash("bad", r.error);
  };
  const ignore = (i: number) => setSuggestions((cur) => (cur ?? []).filter((_, k) => k !== i));

  const unlink = async () => {
    if (!confirm("Unlink your bank? Your entered numbers stay; only the live connection is removed.")) return;
    setBusy("unlink");
    const r = await unlinkBank();
    setBusy(null);
    if (r.ok) { setSuggestions(null); router.refresh(); } else flash("bad", r.error);
  };

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl">🏦</span>
        <div className="min-w-0 flex-1">
          {status.linked ? (
            <>
              <p className="text-sm font-medium">{status.institution || "Bank"} <span className="font-normal text-good">· connected</span></p>
              <p className="text-xs text-muted">Balance {money0(status.lastBalance ?? 0)} in the bank{status.lastSyncedAt ? ` · synced ${new Date(status.lastSyncedAt).toLocaleDateString()}` : ""}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Connect your bank</p>
              <p className="text-xs text-muted">Auto-fill your savings balance and import recurring income & bills. Read-only; your login stays with your bank.</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.linked ? (
            <>
              <button onClick={refresh} disabled={!!busy} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50">{busy === "balance" ? "Syncing…" : "Refresh balance"}</button>
              <button onClick={importRecurring} disabled={!!busy} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === "recurring" ? "Reading…" : "Import recurring"}</button>
              <button onClick={unlink} disabled={!!busy} className="text-xs text-faint hover:text-bad">Unlink</button>
            </>
          ) : (
            <LinkButton onLinked={(inst) => { flash("good", `Connected to ${inst}. Balance imported.`); router.refresh(); }} onError={(e) => flash("bad", e)} />
          )}
        </div>
      </div>

      {note && <p className={`mt-3 rounded-md px-3 py-2 text-sm ${note.tone === "good" ? "bg-good/10 text-good" : note.tone === "bad" ? "bg-bad/10 text-bad" : "bg-surface-2 text-muted"}`}>{note.text}</p>}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Detected recurring — add the ones you want</p>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.kind === "income" ? "bg-good/10 text-good" : "bg-surface-2 text-muted"}`}>{s.kind}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                {s.category && <span className="text-xs text-faint">{s.category}</span>}
                <span className="tabular-nums">{money0(s.amount)}<span className="text-faint">{FREQ_LABEL[s.frequency] ?? ""}</span></span>
                <button onClick={() => accept(s, i)} className="rounded-md border border-accent px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent-weak">Add</button>
                <button onClick={() => ignore(i)} className="text-xs text-faint hover:text-ink">Ignore</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LinkButton({ onLinked, onError }: { onLinked: (institution: string) => void; onError: (e: string) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { createLinkToken().then((r) => { if (r.ok && r.linkToken) setToken(r.linkToken); else if (!r.ok) onError(r.error ?? "Couldn’t start bank linking."); }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const { open, ready } = usePlaidLink({
    token: token ?? "",
    onSuccess: async (publicToken) => {
      setBusy(true);
      const r = await exchangePublicToken(publicToken);
      setBusy(false);
      if (r.ok) onLinked(r.institution ?? "your bank"); else onError(r.error);
    },
    onExit: (err) => { if (err) onError(err.display_message || err.error_message || "Linking cancelled."); },
  });

  return (
    <button onClick={() => open()} disabled={!ready || !token || busy} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
      {busy ? "Connecting…" : !token ? "Preparing…" : "🔗 Link your bank"}
    </button>
  );
}
