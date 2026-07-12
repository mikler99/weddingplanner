"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setSlug, setPublished, updateSeo, type SiteSettings } from "./actions";

export function SettingsClient({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [slugInput, setSlugInput] = useState(initial.slug ?? "");
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const saveSlug = async () => {
    setBusy(true); setSlugMsg(null);
    const r = await setSlug(slugInput);
    setBusy(false);
    if (r.ok) { setS((x) => ({ ...x, slug: r.slug ?? slugInput })); setSlugInput(r.slug ?? slugInput); setSlugMsg({ ok: true, text: "Saved." }); router.refresh(); }
    else setSlugMsg({ ok: false, text: r.error ?? "Could not save." });
  };

  const togglePublish = async () => {
    const next = !s.published;
    setS((x) => ({ ...x, published: next }));
    await setPublished(next);
    router.refresh();
  };

  const saveSeo = async () => {
    setBusy(true);
    await updateSeo({ title: s.seoTitle, description: s.seoDescription, image: s.seoImage });
    setBusy(false); setSeoSaved(true); setTimeout(() => setSeoSaved(false), 2500);
  };

  const uploadImage = async (file: File) => {
    setBusy(true);
    const sb = createClient();
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await sb.storage.from("invite-photos").upload(path, file, { upsert: false });
    if (!error) setS((x) => ({ ...x, seoImage: sb.storage.from("invite-photos").getPublicUrl(path).data.publicUrl }));
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {/* Web address */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-medium">Web address</h2>
        <p className="mt-0.5 text-sm text-muted">Where your site lives. Share this link (or the QR codes) with guests.</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-faint">{origin}/w/</span>
          <input value={slugInput} onChange={(e) => setSlugInput(e.target.value)} className="min-w-[160px] flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm" placeholder="your-names" />
          <button onClick={saveSlug} disabled={busy || !slugInput.trim()} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
        </div>
        {slugMsg && <p className={`mt-1.5 text-xs ${slugMsg.ok ? "text-good" : "text-bad"}`}>{slugMsg.text}</p>}
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Published</h2>
            <p className="mt-0.5 text-sm text-muted">{s.published ? "Your site is live for anyone with the link." : "Visitors see a “coming soon” page. You can still preview it while signed in."}</p>
          </div>
          <button onClick={togglePublish} role="switch" aria-checked={s.published} className={`relative h-6 w-11 flex-none rounded-full transition ${s.published ? "bg-accent" : "bg-surface-2"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${s.published ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </section>

      {/* SEO / social share */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-medium">Social share &amp; SEO</h2>
        <p className="mt-0.5 text-sm text-muted">How your site looks when the link is shared or found in search.</p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-muted">Title</span>
          <input value={s.seoTitle} onChange={(e) => setS((x) => ({ ...x, seoTitle: e.target.value }))} placeholder={s.name || "Our Wedding"} className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-muted">Description</span>
          <textarea value={s.seoDescription} onChange={(e) => setS((x) => ({ ...x, seoDescription: e.target.value }))} rows={2} placeholder="Join us as we celebrate…" className="w-full resize-y rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        </label>
        <div className="mt-3">
          <span className="mb-1 block text-xs text-muted">Share image</span>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.seoImage ? <img src={s.seoImage} alt="" className="h-14 w-24 flex-none rounded object-cover" /> : <div className="h-14 w-24 flex-none rounded border border-dashed border-line" />}
            <label className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2">
              Upload<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
            </label>
          </div>
          <input value={s.seoImage} onChange={(e) => setS((x) => ({ ...x, seoImage: e.target.value }))} placeholder="or paste an image URL" className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs" />
        </div>
        <button onClick={saveSeo} disabled={busy} className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{seoSaved ? "Saved ✓" : "Save"}</button>
      </section>
    </div>
  );
}
