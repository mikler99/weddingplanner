"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { InviteRenderer } from "@/app/i/[token]/InviteRenderer";
import { SECTION_META, FONT_OPTIONS, newSection, fontsHref, type InviteConfig, type Section, type SectionType, type Beat, type DetailCard } from "@/lib/invite-config";
import { saveInviteConfig } from "./actions";

const ADDABLE: SectionType[] = ["hero", "story", "photoBand", "details", "countdown", "rsvp", "footer"];

export function BuilderClient({ weddingId, initial }: { weddingId: string; initial: InviteConfig }) {
  const [config, setConfig] = useState<InviteConfig>(initial);
  const [sel, setSel] = useState<string>("theme");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [adding, setAdding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seed = useRef(Date.now() % 100000);

  // Keep the chosen Google fonts loaded as the theme changes.
  useEffect(() => {
    let link = document.getElementById("invite-fonts") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.id = "invite-fonts"; link.rel = "stylesheet"; document.head.appendChild(link); }
    link.href = fontsHref(config.theme);
  }, [config.theme]);

  const commit = (next: InviteConfig) => {
    setConfig(next);
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveInviteConfig(weddingId, next);
      setStatus(res.ok ? "saved" : "idle");
    }, 700);
  };

  const updateSection = (id: string, patch: Partial<Section>) =>
    commit({ ...config, sections: config.sections.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)) });
  const move = (id: string, dir: -1 | 1) => {
    const i = config.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= config.sections.length) return;
    const arr = [...config.sections];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit({ ...config, sections: arr });
  };
  const removeSection = (id: string) => { commit({ ...config, sections: config.sections.filter((s) => s.id !== id) }); if (sel === id) setSel("theme"); };
  const duplicate = (id: string) => {
    const s = config.sections.find((x) => x.id === id);
    if (!s) return;
    const copy = { ...s, id: `${s.type}-${seed.current++}` } as Section;
    const i = config.sections.findIndex((x) => x.id === id);
    const arr = [...config.sections];
    arr.splice(i + 1, 0, copy);
    commit({ ...config, sections: arr });
    setSel(copy.id);
  };
  const addSection = (type: SectionType) => { const s = newSection(type, seed.current++); commit({ ...config, sections: [...config.sections, s] }); setSel(s.id); setAdding(false); };
  const setTheme = (patch: Partial<InviteConfig["theme"]>) => commit({ ...config, theme: { ...config.theme, ...patch } });

  const selected = config.sections.find((s) => s.id === sel);

  return (
    <div className="flex flex-col lg:h-screen lg:flex-row">
      {/* LEFT — sections */}
      <aside className="flex max-h-64 w-full flex-none flex-col overflow-y-auto border-b border-line bg-surface lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <span className="text-sm font-semibold">Invitation</span>
          <span className="text-[11px] text-faint">{status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : ""}</span>
        </div>
        <button onClick={() => setSel("theme")} className={`border-b border-line px-3 py-2 text-left text-sm ${sel === "theme" ? "bg-accent-weak font-semibold text-accent" : "hover:bg-surface-2"}`}>
          🎨 Theme &amp; fonts
        </button>
        <div className="flex-1 py-1">
          {config.sections.map((s, i) => (
            <div key={s.id} className={`group flex items-center gap-1 px-2 py-1.5 ${sel === s.id ? "bg-accent-weak" : "hover:bg-surface-2"}`}>
              <div className="flex flex-col">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▲</button>
                <button onClick={() => move(s.id, 1)} disabled={i === config.sections.length - 1} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▼</button>
              </div>
              <button onClick={() => setSel(s.id)} className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-sm ${sel === s.id ? "font-semibold text-accent" : ""} ${!s.visible ? "text-faint line-through" : ""}`}>{SECTION_META[s.type].label}</span>
              </button>
              <button onClick={() => updateSection(s.id, { visible: !s.visible } as Partial<Section>)} title={s.visible ? "Hide" : "Show"} className="text-xs opacity-0 transition group-hover:opacity-100">{s.visible ? "👁" : "🚫"}</button>
              <button onClick={() => duplicate(s.id)} title="Duplicate" className="text-xs opacity-0 transition group-hover:opacity-100">⧉</button>
              <button onClick={() => removeSection(s.id)} title="Remove" className="text-xs text-faint opacity-0 transition hover:text-bad group-hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
        <div className="relative border-t border-line p-2">
          <button onClick={() => setAdding((a) => !a)} className="w-full rounded-lg border border-dashed border-line py-2 text-sm text-muted hover:text-ink">+ Add section</button>
          {adding && (
            <div className="absolute bottom-12 left-2 right-2 z-10 rounded-lg border border-line bg-surface shadow-lg">
              {ADDABLE.map((t) => (
                <button key={t} onClick={() => addSection(t)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2">
                  {SECTION_META[t].label} <span className="text-[11px] text-faint">— {SECTION_META[t].hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* CENTER — live preview */}
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-ground lg:min-h-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <div className="flex gap-1">
            <button onClick={() => setDevice("desktop")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${device === "desktop" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>Desktop</button>
            <button onClick={() => setDevice("mobile")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${device === "mobile" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>Mobile</button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-faint">Live preview — guests see this at their personal link</span>
            <Link href="/guests/send" className="text-accent hover:underline">Send →</Link>
          </div>
        </div>
        <div className={`preview-pane flex-1 ${device === "mobile" ? "mobile" : ""}`}>
          <InviteRenderer config={config} mode="preview" />
        </div>
      </div>

      {/* RIGHT — inspector */}
      <aside className="w-full flex-none overflow-y-auto border-t border-line bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
        {sel === "theme" ? (
          <ThemePanel config={config} setTheme={setTheme} />
        ) : selected ? (
          <SectionInspector key={selected.id} section={selected} weddingId={weddingId} onChange={(patch) => updateSection(selected.id, patch)} />
        ) : (
          <p className="text-sm text-faint">Select a section to edit it.</p>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------- Inspectors ------------------------------- */

function ThemePanel({ config, setTheme }: { config: InviteConfig; setTheme: (p: Partial<InviteConfig["theme"]>) => void }) {
  const t = config.theme;
  return (
    <div>
      <H>Theme &amp; fonts</H>
      <Group label="Colours">
        <ColorRow label="Text" value={t.ink} onChange={(v) => setTheme({ ink: v })} />
        <ColorRow label="Soft text" value={t.inkSoft} onChange={(v) => setTheme({ inkSoft: v })} />
        <ColorRow label="Gold" value={t.gold} onChange={(v) => setTheme({ gold: v })} />
        <ColorRow label="Gold (light)" value={t.gold2} onChange={(v) => setTheme({ gold2: v })} />
        <ColorRow label="Background" value={t.bg} onChange={(v) => setTheme({ bg: v })} />
      </Group>
      <Group label="Fonts">
        <FontRow label="Headings" value={t.fontDisplay} options={FONT_OPTIONS.display} onChange={(v) => setTheme({ fontDisplay: v })} />
        <FontRow label="Script accent" value={t.fontScript} options={FONT_OPTIONS.script} onChange={(v) => setTheme({ fontScript: v })} />
        <FontRow label="Labels (sans)" value={t.fontSans} options={FONT_OPTIONS.sans} onChange={(v) => setTheme({ fontSans: v })} />
      </Group>
    </div>
  );
}

function SectionInspector({ section, weddingId, onChange }: { section: Section; weddingId: string; onChange: (p: Partial<Section>) => void }) {
  const s = section;
  return (
    <div>
      <H>{SECTION_META[s.type].label}</H>
      {s.type === "hero" && (
        <>
          <Text label="Small label" value={s.label} onChange={(v) => onChange({ label: v } as Partial<Section>)} />
          <div className="grid grid-cols-2 gap-2">
            <Text label="Name 1" value={s.name1} onChange={(v) => onChange({ name1: v } as Partial<Section>)} />
            <Text label="Name 2" value={s.name2} onChange={(v) => onChange({ name2: v } as Partial<Section>)} />
          </div>
          <Text label="Date" value={s.date} onChange={(v) => onChange({ date: v } as Partial<Section>)} />
          <Text label="Venue line" value={s.venue} onChange={(v) => onChange({ venue: v } as Partial<Section>)} />
          <ImageField label="Cover photo" value={s.bgImage} weddingId={weddingId} onChange={(v) => onChange({ bgImage: v } as Partial<Section>)} />
          <ImageField label="Garland (PNG)" value={s.garland} weddingId={weddingId} onChange={(v) => onChange({ garland: v } as Partial<Section>)} />
        </>
      )}
      {s.type === "story" && (
        <>
          <Text label="Small label" value={s.label} onChange={(v) => onChange({ label: v } as Partial<Section>)} />
          <Text label="Heading" value={s.heading} onChange={(v) => onChange({ heading: v } as Partial<Section>)} />
          <Repeater<Beat>
            label="Story beats" items={s.beats} empty={{ numeral: "iv", title: "", text: "" }}
            onChange={(beats) => onChange({ beats } as Partial<Section>)}
            render={(b, set) => (
              <>
                <Text label="Numeral" value={b.numeral} onChange={(v) => set({ ...b, numeral: v })} />
                <Text label="Title" value={b.title} onChange={(v) => set({ ...b, title: v })} />
                <Area label="Text" value={b.text} onChange={(v) => set({ ...b, text: v })} />
              </>
            )}
          />
        </>
      )}
      {s.type === "photoBand" && (
        <>
          <ImageField label="Photo" value={s.image} weddingId={weddingId} onChange={(v) => onChange({ image: v } as Partial<Section>)} />
          <Text label="Script caption" value={s.script} onChange={(v) => onChange({ script: v } as Partial<Section>)} />
          <Text label="Sub caption" value={s.sub} onChange={(v) => onChange({ sub: v } as Partial<Section>)} />
        </>
      )}
      {s.type === "details" && (
        <>
          <Text label="Small label" value={s.label} onChange={(v) => onChange({ label: v } as Partial<Section>)} />
          <Text label="Heading" value={s.heading} onChange={(v) => onChange({ heading: v } as Partial<Section>)} />
          <Area label="Intro" value={s.lead} onChange={(v) => onChange({ lead: v } as Partial<Section>)} />
          <Repeater<DetailCard>
            label="Cards" items={s.cards} empty={{ kind: "", title: "", lines: "", time: "", linkLabel: "", linkHref: "" }}
            onChange={(cards) => onChange({ cards } as Partial<Section>)}
            render={(c, set) => (
              <>
                <Text label="Kind" value={c.kind} onChange={(v) => set({ ...c, kind: v })} />
                <Text label="Title" value={c.title} onChange={(v) => set({ ...c, title: v })} />
                <Area label="Lines" value={c.lines} onChange={(v) => set({ ...c, lines: v })} />
                <Text label="Time" value={c.time} onChange={(v) => set({ ...c, time: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Text label="Link label" value={c.linkLabel} onChange={(v) => set({ ...c, linkLabel: v })} />
                  <Text label="Link URL" value={c.linkHref} onChange={(v) => set({ ...c, linkHref: v })} />
                </div>
              </>
            )}
          />
        </>
      )}
      {s.type === "countdown" && (
        <>
          <Text label="Small label" value={s.label} onChange={(v) => onChange({ label: v } as Partial<Section>)} />
          <Text label="Heading" value={s.heading} onChange={(v) => onChange({ heading: v } as Partial<Section>)} />
          <Text label="Target (YYYY-MM-DDTHH:MM:SS)" value={s.targetIso} onChange={(v) => onChange({ targetIso: v } as Partial<Section>)} />
          <Text label="Dress label" value={s.dressLabel} onChange={(v) => onChange({ dressLabel: v } as Partial<Section>)} />
          <Text label="Dress chip" value={s.dressChip} onChange={(v) => onChange({ dressChip: v } as Partial<Section>)} />
          <Area label="Dress note" value={s.dressText} onChange={(v) => onChange({ dressText: v } as Partial<Section>)} />
        </>
      )}
      {s.type === "rsvp" && (
        <>
          <Text label="Small label" value={s.label} onChange={(v) => onChange({ label: v } as Partial<Section>)} />
          <Text label="Heading" value={s.heading} onChange={(v) => onChange({ heading: v } as Partial<Section>)} />
          <Area label="Message" value={s.lead} onChange={(v) => onChange({ lead: v } as Partial<Section>)} />
          <ImageField label="Background photo" value={s.bgImage} weddingId={weddingId} onChange={(v) => onChange({ bgImage: v } as Partial<Section>)} />
          <p className="mt-2 text-xs text-faint">The reply form is added automatically.</p>
        </>
      )}
      {s.type === "footer" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Text label="Name 1" value={s.name1} onChange={(v) => onChange({ name1: v } as Partial<Section>)} />
            <Text label="Name 2" value={s.name2} onChange={(v) => onChange({ name2: v } as Partial<Section>)} />
          </div>
          <Text label="Date line" value={s.dateLine} onChange={(v) => onChange({ dateLine: v } as Partial<Section>)} />
          <ImageField label="Flourish (PNG)" value={s.bouquet} weddingId={weddingId} onChange={(v) => onChange({ bouquet: v } as Partial<Section>)} />
        </>
      )}
    </div>
  );
}

/* --------------------------------- Fields --------------------------------- */

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 font-display text-lg font-semibold">{children}</h2>;
const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</p>{children}</div>
);
const fieldCls = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls} />
    </label>
  );
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${fieldCls} resize-y`} />
    </label>
  );
}
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = value.startsWith("#") ? value : "#000000";
  return (
    <div className="mb-2 flex items-center gap-2">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 flex-none rounded border border-line bg-surface" />
      <span className="flex-1 text-xs text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-xs" />
    </div>
  );
}
function FontRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ImageField({ label, value, weddingId, onChange }: { label: string; value: string; weddingId: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const up = async (file: File) => {
    setBusy(true); setErr(null);
    const sb = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${weddingId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await sb.storage.from("invite-photos").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data } = sb.storage.from("invite-photos").getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  };
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-12 w-12 flex-none rounded object-cover" /> : <div className="h-12 w-12 flex-none rounded border border-dashed border-line" />}
        <button onClick={() => ref.current?.click()} disabled={busy} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50">
          {busy ? "Uploading…" : "Upload"}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); e.target.value = ""; }} />
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="or paste an image URL" className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs" />
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

function Repeater<T>({ label, items, empty, onChange, render }: { label: string; items: T[]; empty: T; onChange: (items: T[]) => void; render: (item: T, set: (v: T) => void) => React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</p>
      {items.map((it, i) => (
        <div key={i} className="mb-2 rounded-lg border border-line p-2">
          <div className="mb-1 flex justify-between">
            <span className="text-[11px] text-faint">#{i + 1}</span>
            <button onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-xs text-faint hover:text-bad">remove</button>
          </div>
          {render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))))}
        </div>
      ))}
      <button onClick={() => onChange([...items, empty])} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add</button>
    </div>
  );
}
