"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPackage } from "./actions";

// Add an all-inclusive package as named line items across the categories it
// covers, tagged with a package pill. Amounts entered as $, % of a total, or an
// even split of a total (for when you know the categories but not the split).
export function PackageForm({ weddingId, scenarioId, categories }: { weddingId: string; scenarioId: string; categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const catOptions = Array.from(new Set([...categories, "Venue", "Catering", "Bar", "All-inclusive"]));
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [costType, setCostType] = useState<"per_guest" | "flat">("per_guest");
  const [amountMode, setAmountMode] = useState<"even" | "amount" | "percent">("even");
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<{ category: string; label: string; value: string }[]>([
    { category: "Venue", label: "", value: "" }, { category: "Catering", label: "", value: "" }, { category: "Bar", label: "", value: "" },
  ]);
  const setRow = (i: number, patch: Partial<{ category: string; label: string; value: string }>) => setRows((rs) => rs.map((r, j) => (i === j ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!name.trim()) { setErr("Give the package a name"); return; }
    const payload = {
      scenarioId, name: name.trim(), vendor: vendor.trim() || undefined, costType, amountMode,
      total: parseFloat(total) || 0,
      rows: rows.filter((r) => r.category).map((r) => ({ category: r.category, label: r.label.trim() || name.trim(), value: parseFloat(r.value) || 0 })),
    };
    if (payload.rows.length === 0) { setErr("Add at least one category"); return; }
    start(async () => {
      const res = await createPackage(weddingId, payload);
      if (!res.ok) setErr(res.error ?? "Couldn't add package");
      else { setOpen(false); setName(""); setTotal(""); setErr(null); router.refresh(); }
    });
  };

  if (!open) return <button onClick={() => setOpen(true)} className="text-sm font-medium text-accent hover:underline">+ All-inclusive package</button>;

  const field = "rounded-md border border-line bg-surface px-2 py-1.5 text-sm";
  const showTotal = amountMode !== "amount";
  const showValue = amountMode !== "even";

  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${pending ? "opacity-60" : ""}`}>
      <p className="mb-3 text-sm font-semibold">Add an all-inclusive package</p>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Package name (e.g. Grand Gala)" className={`w-full ${field}`} />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier (e.g. Horseshoe Resort)" className={`w-full ${field}`} />
        <div className="flex rounded-md border border-line p-0.5 text-xs">
          {(["per_guest", "flat"] as const).map((t) => (
            <button key={t} onClick={() => setCostType(t)} className={`rounded px-2.5 py-1 font-medium ${costType === t ? "bg-accent text-white" : "text-muted"}`}>{t === "per_guest" ? "per guest" : "flat"}</button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Amounts:</span>
        <div className="flex rounded-md border border-line p-0.5 text-xs">
          {([["even", "Split total evenly"], ["amount", "$ per category"], ["percent", "% of total"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setAmountMode(m)} className={`rounded px-2.5 py-1 font-medium ${amountMode === m ? "bg-accent text-white" : "text-muted"}`}>{label}</button>
          ))}
        </div>
        {showTotal && (
          <label className="ml-auto flex items-center gap-1 text-xs text-muted">Total {costType === "per_guest" ? "/pp" : ""} <span className="text-faint">$</span>
            <input value={total} inputMode="decimal" onChange={(e) => setTotal(e.target.value)} placeholder="220" className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm" />
          </label>
        )}
      </div>

      <p className="mb-1 mt-3 text-xs text-faint">The categories it covers — name each line and it&apos;ll show a “{name || "package"}” pill.</p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} className={`w-32 ${field}`}>
              {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder={`Line name (e.g. ${r.category === "Bar" ? "Open bar" : r.category === "Catering" ? "Plated dinner" : "Ceremony & space"})`} className={`min-w-[9rem] flex-1 ${field}`} />
            {showValue && (
              <div className="flex items-center gap-1">
                <span className="text-faint">{amountMode === "amount" ? "$" : ""}</span>
                <input value={r.value} inputMode="decimal" onChange={(e) => setRow(i, { value: e.target.value })} placeholder={amountMode === "percent" ? "%" : "0"} className="w-16 rounded-md border border-line bg-surface px-2 py-1.5 text-right text-sm" />
              </div>
            )}
            {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-faint hover:text-bad" aria-label="Remove category">×</button>}
          </div>
        ))}
      </div>
      <button onClick={() => setRows((rs) => [...rs, { category: catOptions[0] ?? "Other", label: "", value: "" }])} className="mt-2 text-xs font-medium text-accent hover:underline">+ category</button>

      {amountMode === "even" && rows.length > 0 && total && (
        <p className="mt-2 text-xs text-faint">≈ ${(( parseFloat(total) || 0) / rows.length).toFixed(2)} to each of the {rows.length} categories (edit any line afterward).</p>
      )}
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setErr(null); }} className="rounded-md border border-line px-3 py-1.5 text-xs">Cancel</button>
        <button onClick={submit} disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Add package</button>
      </div>
    </div>
  );
}
