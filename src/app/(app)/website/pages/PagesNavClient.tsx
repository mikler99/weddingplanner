"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePagesNav, type PagesNav, type PageMeta } from "./actions";
import type { NavLink } from "@/lib/site-config";

export function PagesNavClient({ initial }: { initial: PagesNav }) {
  const router = useRouter();
  const [pages, setPages] = useState<PageMeta[]>(initial.pages);
  const [brand, setBrand] = useState(initial.nav.brand ?? "");
  const [links, setLinks] = useState<NavLink[]>(initial.nav.links ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slug = initial.slug;
  const urlFor = (p: PageMeta, i: number) => !slug ? "—" : i === 0 ? `/w/${slug}` : `/w/${slug}/${p.slug}`;

  const patch = (id: string, p: Partial<PageMeta>) => setPages((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setPages((ps) => { const j = i + d; if (j < 0 || j >= ps.length) return ps; const a = [...ps]; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const makeHome = (i: number) => setPages((ps) => { const a = [...ps]; const [p] = a.splice(i, 1); a.unshift(p); return a; });
  const del = (id: string) => { if (pages.length <= 1) return; if (!confirm("Delete this page and its content?")) return; setPages((ps) => ps.filter((p) => p.id !== id)); };

  const addLink = () => setLinks((l) => [...l, { id: `lnk-${Date.now()}`, label: "", href: "" }]);
  const patchLink = (id: string, p: Partial<NavLink>) => setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const save = async () => {
    setBusy(true); setErr(null);
    const order = pages.map((p) => p.id);
    const meta: Record<string, { title: string; slug: string; showInNav: boolean }> = {};
    pages.forEach((p) => { meta[p.id] = { title: p.title, slug: p.slug, showInNav: p.showInNav }; });
    const r = await savePagesNav(order, meta, { brand, links });
    setBusy(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); router.refresh(); }
    else setErr(r.error ?? "Could not save.");
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-medium">Pages</h2>
        <p className="mb-3 text-sm text-muted">The first page is your home page (served at your web address). Reorder, rename, set custom URLs, and choose which appear in the menu.</p>
        <div className="space-y-2">
          {pages.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▼</button>
                </div>
                <input value={p.title} onChange={(e) => patch(p.id, { title: e.target.value })} className="min-w-[120px] flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-medium hover:border-line focus:border-line" />
                {i === 0 ? <span className="rounded-full bg-accent-weak px-2 py-0.5 text-[11px] font-medium text-accent">Home</span>
                  : <button onClick={() => makeHome(i)} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:border-accent">Set as home</button>}
                <label className="flex items-center gap-1 text-[11px] text-muted"><input type="checkbox" checked={p.showInNav} onChange={(e) => patch(p.id, { showInNav: e.target.checked })} className="h-3.5 w-3.5" />In menu</label>
                {pages.length > 1 && <button onClick={() => del(p.id)} className="text-xs text-faint hover:text-bad">✕</button>}
              </div>
              {i !== 0 && (
                <div className="mt-2 flex items-center gap-1 pl-6 text-xs text-faint">
                  <span>/w/{slug ?? "…"}/</span>
                  <input value={p.slug} onChange={(e) => patch(p.id, { slug: e.target.value })} className="w-40 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink" />
                </div>
              )}
              {i === 0 && <p className="mt-1 pl-6 text-xs text-faint">{urlFor(p, i)}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Navigation menu</h2>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Brand / monogram (shown at the left of the menu)</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. M & O" className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        </label>
        <div className="mt-3">
          <span className="mb-1 block text-xs text-muted">Extra links (e.g. a registry, a hotel block)</span>
          {links.map((l) => (
            <div key={l.id} className="mb-1.5 flex gap-1.5">
              <input value={l.label} onChange={(e) => patchLink(l.id, { label: e.target.value })} placeholder="Label" className="w-32 rounded-md border border-line bg-surface px-2 py-1 text-sm" />
              <input value={l.href} onChange={(e) => patchLink(l.id, { href: e.target.value })} placeholder="https://…" className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm" />
              <button onClick={() => setLinks((ls) => ls.filter((x) => x.id !== l.id))} className="px-1.5 text-faint hover:text-bad">✕</button>
            </div>
          ))}
          <button onClick={addLink} className="mt-1 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:text-ink">+ Add link</button>
        </div>
      </section>

      {err && <p className="text-sm text-bad">{err}</p>}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface/90 px-5 py-3 backdrop-blur">
        <button onClick={save} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saved ? "Saved ✓" : busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}
