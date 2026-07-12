"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { qrSvg } from "@/lib/qr";
import { createTable, updateTable, deleteTable, type CameraTable } from "./actions";

export function CamerasClient({ initial, slug, camPath }: { initial: CameraTable[]; slug: string | null; camPath: string }) {
  const router = useRouter();
  const [tables, setTables] = useState<CameraTable[]>(initial);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  const [openQr, setOpenQr] = useState<string | null>(null);

  const urlFor = (token: string) => (typeof window === "undefined" || !slug) ? "" : `${window.location.origin}/w/${slug}${camPath}?t=${token}`;

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const r = await createTable(name, limit);
    setBusy(false);
    if (r.ok) { setName(""); router.refresh(); }
  };
  const patch = async (id: string, p: { name?: string; shotLimit?: number }) => {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, ...(p.name !== undefined ? { name: p.name } : {}), ...(p.shotLimit !== undefined ? { shotLimit: p.shotLimit } : {}) } : t)));
    await updateTable(id, p);
  };
  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete “${label}”? Photos already taken stay in your gallery.`)) return;
    setTables((ts) => ts.filter((t) => t.id !== id));
    await deleteTable(id);
    router.refresh();
  };

  const printAll = () => {
    if (!slug) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const cards = tables.map((t) => `
      <div class="card">
        <div class="mono">${escapeHtml(name0(t.name))}</div>
        <div class="qr">${qrSvg(urlFor(t.token), { margin: 1, dark: "#1a120a", light: "#ffffff" })}</div>
        <div class="cap">Scan to open the camera</div>
        <div class="sub">${t.shotLimit} shots for this table · every photo joins the shared gallery</div>
      </div>`).join("");
    w.document.write(`<!doctype html><html><head><title>Camera cards</title><style>
      *{box-sizing:border-box;font-family:Georgia,serif}
      body{margin:0;padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .card{border:1px solid #d8c9a8;border-radius:10px;padding:20px;text-align:center;page-break-inside:avoid}
      .mono{font-size:22px;font-weight:600;color:#2a1f12;margin-bottom:10px}
      .qr{width:190px;height:190px;margin:0 auto}
      .cap{margin-top:12px;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#9a7b3c}
      .sub{margin-top:6px;font-size:12px;color:#6b5f4a}
      @media print{@page{margin:12mm}}
    </style></head><body>${cards}<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      {/* Add table */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-3">
        <label className="min-w-[160px] flex-1">
          <span className="mb-1 block text-xs text-muted">Table name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Table 1, Head table" className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-xs text-muted">Shots</span>
          <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        </label>
        <button onClick={add} disabled={busy || !name.trim()} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50">+ Add table</button>
      </div>

      {tables.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button onClick={printAll} disabled={!slug} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50">🖨️ Print all QR cards</button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {tables.map((t) => {
          const remaining = Math.max(0, t.shotLimit - t.used);
          const pct = t.shotLimit ? Math.min(100, Math.round((t.used / t.shotLimit) * 100)) : 0;
          const url = urlFor(t.token);
          return (
            <div key={t.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input value={t.name} onChange={(e) => patch(t.id, { name: e.target.value })} className="min-w-[140px] flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-medium hover:border-line focus:border-line" />
                <label className="flex items-center gap-1 text-xs text-muted">Shots
                  <input type="number" min={1} max={500} value={t.shotLimit} onChange={(e) => patch(t.id, { shotLimit: Number(e.target.value) })} className="w-16 rounded-md border border-line bg-surface px-1.5 py-1 text-sm" />
                </label>
                <button onClick={() => setOpenQr(openQr === t.id ? null : t.id)} className="rounded-md border border-line px-2 py-1 text-xs hover:border-accent">{openQr === t.id ? "Hide QR" : "QR"}</button>
                <button onClick={() => remove(t.id, t.name)} className="rounded-md px-1.5 py-1 text-xs text-faint hover:text-bad">✕</button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted">{t.used}/{t.shotLimit} used · {remaining} left</span>
              </div>
              {openQr === t.id && url && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-line bg-ground p-4">
                  <div className="h-44 w-44" dangerouslySetInnerHTML={{ __html: qrSvg(url, { margin: 1, dark: "#1a120a", light: "#ffffff" }) }} />
                  <a href={url} target="_blank" rel="noreferrer" className="max-w-full truncate text-xs text-accent hover:underline">{url}</a>
                </div>
              )}
            </div>
          );
        })}
        {tables.length === 0 && <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-muted">No tables yet. Add one above to generate its QR code.</p>}
      </div>
    </div>
  );
}

function name0(s: string) { return s || "Table"; }
function escapeHtml(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }
