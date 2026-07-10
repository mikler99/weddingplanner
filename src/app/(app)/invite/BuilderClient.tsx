"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SiteRenderer } from "@/app/i/[token]/InviteRenderer";
import { SECTION_META, FONT_OPTIONS, THEME_PRESETS, newSection, fontsHref, type Theme, type Section, type SectionType, type Beat, type DetailCard, type ScheduleEvent, type FaqItem, type PartyMember, type GiftLink } from "@/lib/invite-config";
import { type SiteConfig, type SitePage, PAGE_TEMPLATES, type PageTemplateKey, newPage, uniqueSlug } from "@/lib/site-config";
import { saveInviteConfig } from "./actions";

const ADDABLE: SectionType[] = ["hero", "story", "photoBand", "details", "countdown", "schedule", "gallery", "party", "faq", "gifts", "richText", "camera", "guestbook", "songs", "rsvp", "footer"];

export function BuilderClient({ weddingId, initial }: { weddingId: string; initial: SiteConfig }) {
  const [site, setSite] = useState<SiteConfig>(initial);
  const [pageId, setPageId] = useState<string>(initial.pages[0]?.id ?? "home");
  const [sel, setSel] = useState<string>("theme"); // "theme" | "" | sectionId
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [addingSection, setAddingSection] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seed = useRef(Date.now() % 100000);

  useEffect(() => {
    let link = document.getElementById("invite-fonts") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.id = "invite-fonts"; link.rel = "stylesheet"; document.head.appendChild(link); }
    link.href = fontsHref(site.theme);
  }, [site.theme]);

  const commit = (next: SiteConfig) => {
    setSite(next);
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { const r = await saveInviteConfig(weddingId, next); setStatus(r.ok ? "saved" : "idle"); }, 700);
  };

  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const setPages = (pages: SitePage[]) => commit({ ...site, pages });
  const patchPage = (id: string, patch: Partial<SitePage>) => setPages(site.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // --- section ops (within the selected page) ---
  const setSections = (sections: Section[]) => patchPage(page.id, { sections });
  const updateSection = (id: string, patch: Partial<Section>) => setSections(page.sections.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
  const moveSection = (id: string, dir: -1 | 1) => {
    const i = page.sections.findIndex((s) => s.id === id); const j = i + dir;
    if (j < 0 || j >= page.sections.length) return;
    const arr = [...page.sections]; [arr[i], arr[j]] = [arr[j], arr[i]]; setSections(arr);
  };
  const removeSection = (id: string) => { setSections(page.sections.filter((s) => s.id !== id)); if (sel === id) setSel(""); };
  const duplicateSection = (id: string) => {
    const s = page.sections.find((x) => x.id === id); if (!s) return;
    const copy = { ...s, id: `${s.type}-${seed.current++}` } as Section;
    const i = page.sections.findIndex((x) => x.id === id);
    const arr = [...page.sections]; arr.splice(i + 1, 0, copy); setSections(arr); setSel(copy.id);
  };
  const addSection = (type: SectionType) => { const s = newSection(type, seed.current++); setSections([...page.sections, s]); setSel(s.id); setAddingSection(false); };

  // --- page ops ---
  const addPage = (key: PageTemplateKey) => {
    const p = newPage(key, seed.current++);
    p.slug = uniqueSlug(p.slug, site.pages.map((x) => x.slug));
    commit({ ...site, pages: [...site.pages, p] });
    setPageId(p.id); setSel(p.sections[0]?.id ?? ""); setAddingPage(false);
  };
  const movePage = (id: string, dir: -1 | 1) => {
    const i = site.pages.findIndex((p) => p.id === id); const j = i + dir;
    if (j < 0 || j >= site.pages.length) return;
    const arr = [...site.pages]; [arr[i], arr[j]] = [arr[j], arr[i]]; setPages(arr);
  };
  const removePage = (id: string) => {
    if (site.pages.length <= 1) return;
    const arr = site.pages.filter((p) => p.id !== id);
    commit({ ...site, pages: arr });
    if (pageId === id) { setPageId(arr[0].id); setSel(""); }
  };

  const setTheme = (patch: Partial<Theme>) => commit({ ...site, theme: { ...site.theme, ...patch } });
  const applyPreset = (theme: Theme) => commit({ ...site, theme });
  const saveTheme = () => {
    const name = prompt("Name this theme"); if (!name) return;
    const nt = { id: `theme-${seed.current++}`, name, theme: site.theme };
    commit({ ...site, savedThemes: [...(site.savedThemes ?? []), nt] });
  };

  const selected = page.sections.find((s) => s.id === sel);

  return (
    <div className="flex flex-col lg:h-screen lg:flex-row">
      {/* LEFT — pages + sections */}
      <aside className="flex max-h-[45vh] w-full flex-none flex-col overflow-y-auto border-b border-line bg-surface lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <span className="text-sm font-semibold">Website</span>
          <span className="text-[11px] text-faint">{status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : ""}</span>
        </div>
        <button onClick={() => setSel("theme")} className={`border-b border-line px-3 py-2 text-left text-sm ${sel === "theme" ? "bg-accent-weak font-semibold text-accent" : "hover:bg-surface-2"}`}>🎨 Theme &amp; fonts</button>

        {/* Pages */}
        <div className="border-b border-line px-3 py-1.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">Pages</p>
          {site.pages.map((p, i) => (
            <div key={p.id} className={`group flex items-center gap-1 rounded px-1 py-1 ${p.id === pageId ? "bg-accent-weak" : "hover:bg-surface-2"}`}>
              <div className="flex flex-col">
                <button onClick={() => movePage(p.id, -1)} disabled={i === 0} className="h-2.5 leading-none text-faint hover:text-ink disabled:opacity-30">▲</button>
                <button onClick={() => movePage(p.id, 1)} disabled={i === site.pages.length - 1} className="h-2.5 leading-none text-faint hover:text-ink disabled:opacity-30">▼</button>
              </div>
              <button onClick={() => { setPageId(p.id); setSel(p.sections[0]?.id ?? ""); }} className="min-w-0 flex-1 text-left"><span className={`block truncate text-sm ${p.id === pageId ? "font-semibold text-accent" : ""}`}>{p.title}</span></button>
              <button onClick={() => patchPage(p.id, { showInNav: !p.showInNav })} title={p.showInNav ? "In nav" : "Hidden from nav"} className="text-[11px] opacity-0 transition group-hover:opacity-100">{p.showInNav ? "👁" : "🚫"}</button>
              {site.pages.length > 1 && <button onClick={() => confirm(`Delete page "${p.title}"?`) && removePage(p.id)} className="text-[11px] text-faint opacity-0 transition hover:text-bad group-hover:opacity-100">✕</button>}
            </div>
          ))}
          <div className="relative">
            <button onClick={() => setAddingPage((a) => !a)} className="mt-1 w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add page</button>
            {addingPage && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
                {PAGE_TEMPLATES.map((t) => (<button key={t.key} onClick={() => addPage(t.key)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-2">{t.label} <span className="text-[11px] text-faint">— {t.hint}</span></button>))}
              </div>
            )}
          </div>
        </div>

        {/* Sections of the selected page */}
        <div className="px-3 py-1.5">
          <label className="mb-1 block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-faint">“{page.title}” sections</span>
            <input value={page.title} onChange={(e) => patchPage(page.id, { title: e.target.value })} className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs" placeholder="Page title" />
          </label>
        </div>
        <div className="flex-1 px-1 pb-1">
          {page.sections.map((s, i) => (
            <div key={s.id} className={`group flex items-center gap-1 rounded px-2 py-1.5 ${sel === s.id ? "bg-accent-weak" : "hover:bg-surface-2"}`}>
              <div className="flex flex-col">
                <button onClick={() => moveSection(s.id, -1)} disabled={i === 0} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▲</button>
                <button onClick={() => moveSection(s.id, 1)} disabled={i === page.sections.length - 1} className="h-3 leading-none text-faint hover:text-ink disabled:opacity-30">▼</button>
              </div>
              <button onClick={() => setSel(s.id)} className="min-w-0 flex-1 text-left"><span className={`block truncate text-sm ${sel === s.id ? "font-semibold text-accent" : ""} ${!s.visible ? "text-faint line-through" : ""}`}>{SECTION_META[s.type].label}</span></button>
              <button onClick={() => updateSection(s.id, { visible: !s.visible } as Partial<Section>)} className="text-xs opacity-0 transition group-hover:opacity-100">{s.visible ? "👁" : "🚫"}</button>
              <button onClick={() => duplicateSection(s.id)} className="text-xs opacity-0 transition group-hover:opacity-100">⧉</button>
              <button onClick={() => removeSection(s.id)} className="text-xs text-faint opacity-0 transition hover:text-bad group-hover:opacity-100">✕</button>
            </div>
          ))}
          <div className="relative p-1">
            <button onClick={() => setAddingSection((a) => !a)} className="w-full rounded-lg border border-dashed border-line py-2 text-sm text-muted hover:text-ink">+ Add section</button>
            {addingSection && (
              <div className="absolute bottom-12 left-1 right-1 z-10 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
                {ADDABLE.map((t) => (<button key={t} onClick={() => addSection(t)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2">{SECTION_META[t].label} <span className="text-[11px] text-faint">— {SECTION_META[t].hint}</span></button>))}
              </div>
            )}
          </div>
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
            <span className="text-faint">Editing “{page.title}”</span>
            <Link href="/guests/send" className="text-accent hover:underline">Send links →</Link>
          </div>
        </div>
        <div className={`preview-pane flex-1 ${device === "mobile" ? "mobile" : ""}`}>
          <SiteRenderer site={site} pageSlug={page.slug} mode="preview" />
        </div>
      </div>

      {/* RIGHT — inspector */}
      <aside className="w-full flex-none overflow-y-auto border-t border-line bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
        {sel === "theme" ? (
          <ThemePanel theme={site.theme} savedThemes={site.savedThemes ?? []} setTheme={setTheme} applyPreset={applyPreset} saveTheme={saveTheme} />
        ) : selected ? (
          <SectionInspector key={selected.id} section={selected} weddingId={weddingId} onChange={(patch) => updateSection(selected.id, patch)} />
        ) : (
          <p className="text-sm text-faint">Select a section on the left to edit it, or choose Theme &amp; fonts.</p>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------- Inspectors ------------------------------- */

function ThemePanel({ theme, savedThemes, setTheme, applyPreset, saveTheme }: { theme: Theme; savedThemes: { id: string; name: string; theme: Theme }[]; setTheme: (p: Partial<Theme>) => void; applyPreset: (t: Theme) => void; saveTheme: () => void }) {
  return (
    <div>
      <H>Theme &amp; fonts</H>
      <Group label="Starter themes">
        <div className="flex flex-wrap gap-1.5">
          {THEME_PRESETS.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.theme)} className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-xs hover:border-accent">
              <span className="h-3 w-3 rounded-full" style={{ background: p.theme.gold }} />{p.name}
            </button>
          ))}
          {savedThemes.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.theme)} className="flex items-center gap-1.5 rounded-full border border-accent/40 px-2 py-1 text-xs hover:border-accent">
              <span className="h-3 w-3 rounded-full" style={{ background: p.theme.gold }} />{p.name}
            </button>
          ))}
        </div>
        <button onClick={saveTheme} className="mt-2 text-xs text-accent hover:underline">＋ Save current as a theme</button>
      </Group>
      <Group label="Colours">
        <ColorRow label="Text" value={theme.ink} onChange={(v) => setTheme({ ink: v })} />
        <ColorRow label="Soft text" value={theme.inkSoft} onChange={(v) => setTheme({ inkSoft: v })} />
        <ColorRow label="Gold" value={theme.gold} onChange={(v) => setTheme({ gold: v })} />
        <ColorRow label="Gold (light)" value={theme.gold2} onChange={(v) => setTheme({ gold2: v })} />
        <ColorRow label="Background" value={theme.bg} onChange={(v) => setTheme({ bg: v })} />
      </Group>
      <Group label="Fonts">
        <FontRow label="Headings" value={theme.fontDisplay} options={FONT_OPTIONS.display} onChange={(v) => setTheme({ fontDisplay: v })} />
        <FontRow label="Script accent" value={theme.fontScript} options={FONT_OPTIONS.script} onChange={(v) => setTheme({ fontScript: v })} />
        <FontRow label="Labels (sans)" value={theme.fontSans} options={FONT_OPTIONS.sans} onChange={(v) => setTheme({ fontSans: v })} />
      </Group>
    </div>
  );
}

function SectionInspector({ section, weddingId, onChange }: { section: Section; weddingId: string; onChange: (p: Partial<Section>) => void }) {
  const s = section;
  const P = (patch: Partial<Section>) => onChange(patch);
  return (
    <div>
      <H>{SECTION_META[s.type].label}</H>
      {s.type === "hero" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <div className="grid grid-cols-2 gap-2"><Text label="Name 1" value={s.name1} onChange={(v) => P({ name1: v } as Partial<Section>)} /><Text label="Name 2" value={s.name2} onChange={(v) => P({ name2: v } as Partial<Section>)} /></div>
        <Text label="Date" value={s.date} onChange={(v) => P({ date: v } as Partial<Section>)} />
        <Text label="Venue line" value={s.venue} onChange={(v) => P({ venue: v } as Partial<Section>)} />
        <ImageField label="Cover photo" value={s.bgImage} weddingId={weddingId} onChange={(v) => P({ bgImage: v } as Partial<Section>)} />
        <ImageField label="Garland (PNG)" value={s.garland} weddingId={weddingId} onChange={(v) => P({ garland: v } as Partial<Section>)} />
      </>)}
      {s.type === "story" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Repeater<Beat> label="Story beats" items={s.beats} empty={{ numeral: "iv", title: "", text: "" }} onChange={(beats) => P({ beats } as Partial<Section>)} render={(b, set) => (<><Text label="Numeral" value={b.numeral} onChange={(v) => set({ ...b, numeral: v })} /><Text label="Title" value={b.title} onChange={(v) => set({ ...b, title: v })} /><Area label="Text" value={b.text} onChange={(v) => set({ ...b, text: v })} /></>)} />
      </>)}
      {s.type === "photoBand" && (<>
        <ImageField label="Photo" value={s.image} weddingId={weddingId} onChange={(v) => P({ image: v } as Partial<Section>)} />
        <Text label="Script caption" value={s.script} onChange={(v) => P({ script: v } as Partial<Section>)} />
        <Text label="Sub caption" value={s.sub} onChange={(v) => P({ sub: v } as Partial<Section>)} />
      </>)}
      {s.type === "details" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Intro" value={s.lead} onChange={(v) => P({ lead: v } as Partial<Section>)} />
        <Repeater<DetailCard> label="Cards" items={s.cards} empty={{ kind: "", title: "", lines: "", time: "", linkLabel: "", linkHref: "" }} onChange={(cards) => P({ cards } as Partial<Section>)} render={(c, set) => (<><Text label="Kind" value={c.kind} onChange={(v) => set({ ...c, kind: v })} /><Text label="Title" value={c.title} onChange={(v) => set({ ...c, title: v })} /><Area label="Lines" value={c.lines} onChange={(v) => set({ ...c, lines: v })} /><Text label="Time" value={c.time} onChange={(v) => set({ ...c, time: v })} /><div className="grid grid-cols-2 gap-2"><Text label="Link label" value={c.linkLabel} onChange={(v) => set({ ...c, linkLabel: v })} /><Text label="Link URL" value={c.linkHref} onChange={(v) => set({ ...c, linkHref: v })} /></div></>)} />
      </>)}
      {s.type === "countdown" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Text label="Target (YYYY-MM-DDTHH:MM:SS)" value={s.targetIso} onChange={(v) => P({ targetIso: v } as Partial<Section>)} />
        <Text label="Dress label" value={s.dressLabel} onChange={(v) => P({ dressLabel: v } as Partial<Section>)} />
        <Text label="Dress chip" value={s.dressChip} onChange={(v) => P({ dressChip: v } as Partial<Section>)} />
        <Area label="Dress note" value={s.dressText} onChange={(v) => P({ dressText: v } as Partial<Section>)} />
      </>)}
      {s.type === "schedule" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Repeater<ScheduleEvent> label="Events" items={s.events} empty={{ time: "", title: "", desc: "", location: "" }} onChange={(events) => P({ events } as Partial<Section>)} render={(e, set) => (<><Text label="Time" value={e.time} onChange={(v) => set({ ...e, time: v })} /><Text label="Title" value={e.title} onChange={(v) => set({ ...e, title: v })} /><Text label="Location" value={e.location} onChange={(v) => set({ ...e, location: v })} /><Area label="Note" value={e.desc} onChange={(v) => set({ ...e, desc: v })} /></>)} />
      </>)}
      {s.type === "faq" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Repeater<FaqItem> label="Questions" items={s.items} empty={{ q: "", a: "" }} onChange={(items) => P({ items } as Partial<Section>)} render={(it, set) => (<><Text label="Question" value={it.q} onChange={(v) => set({ ...it, q: v })} /><Area label="Answer" value={it.a} onChange={(v) => set({ ...it, a: v })} /></>)} />
      </>)}
      {s.type === "gallery" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <ImagesField label="Photos" images={s.images} weddingId={weddingId} onChange={(images) => P({ images } as Partial<Section>)} />
      </>)}
      {s.type === "party" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Repeater<PartyMember> label="People" items={s.members} empty={{ name: "", role: "", photo: "" }} onChange={(members) => P({ members } as Partial<Section>)} render={(m, set) => (<><Text label="Name" value={m.name} onChange={(v) => set({ ...m, name: v })} /><Text label="Role" value={m.role} onChange={(v) => set({ ...m, role: v })} /><ImageField label="Photo" value={m.photo} weddingId={weddingId} onChange={(v) => set({ ...m, photo: v })} /></>)} />
      </>)}
      {s.type === "gifts" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Message" value={s.message} onChange={(v) => P({ message: v } as Partial<Section>)} />
        <Repeater<GiftLink> label="Contribution links (optional)" items={s.links} empty={{ label: "", url: "" }} onChange={(links) => P({ links } as Partial<Section>)} render={(l, set) => (<><Text label="Label" value={l.label} onChange={(v) => set({ ...l, label: v })} /><Text label="URL" value={l.url} onChange={(v) => set({ ...l, url: v })} /></>)} />
      </>)}
      {s.type === "rsvp" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Message" value={s.lead} onChange={(v) => P({ lead: v } as Partial<Section>)} />
        <ImageField label="Background photo" value={s.bgImage} weddingId={weddingId} onChange={(v) => P({ bgImage: v } as Partial<Section>)} />
        <p className="mt-2 text-xs text-faint">The reply form is added automatically for signed-in guests.</p>
      </>)}
      {s.type === "richText" && (<>
        <Text label="Small label (optional)" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Body" value={s.body} onChange={(v) => P({ body: v } as Partial<Section>)} />
      </>)}
      {s.type === "camera" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Message" value={s.lead} onChange={(v) => P({ lead: v } as Partial<Section>)} />
        <Repeater<{ text: string }> label="Photo challenges (optional)" items={s.prompts.map((text) => ({ text }))} empty={{ text: "" }} onChange={(items) => P({ prompts: items.map((i) => i.text) } as Partial<Section>)} render={(it, set) => (<Text label="Prompt" value={it.text} onChange={(v) => set({ text: v })} />)} />
        <p className="mt-2 text-xs text-faint">On the live site, guests snap photos into a shared gallery. A random challenge is shown each time.</p>
      </>)}
      {(s.type === "guestbook" || s.type === "songs") && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Message" value={s.lead} onChange={(v) => P({ lead: v } as Partial<Section>)} />
        <p className="mt-2 text-xs text-faint">Guests’ {s.type === "guestbook" ? "well-wishes" : "song requests"} appear here live on the wedding day.</p>
      </>)}
      {s.type === "footer" && (<>
        <div className="grid grid-cols-2 gap-2"><Text label="Name 1" value={s.name1} onChange={(v) => P({ name1: v } as Partial<Section>)} /><Text label="Name 2" value={s.name2} onChange={(v) => P({ name2: v } as Partial<Section>)} /></div>
        <Text label="Date line" value={s.dateLine} onChange={(v) => P({ dateLine: v } as Partial<Section>)} />
        <ImageField label="Flourish (PNG)" value={s.bouquet} weddingId={weddingId} onChange={(v) => P({ bouquet: v } as Partial<Section>)} />
      </>)}
    </div>
  );
}

/* --------------------------------- Fields --------------------------------- */

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 font-display text-lg font-semibold">{children}</h2>;
const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (<div className="mb-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</p>{children}</div>);
const fieldCls = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (<label className="mb-3 block"><span className="mb-1 block text-xs text-muted">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls} /></label>);
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (<label className="mb-3 block"><span className="mb-1 block text-xs text-muted">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${fieldCls} resize-y`} /></label>);
}
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = value.startsWith("#") ? value : "#000000";
  return (<div className="mb-2 flex items-center gap-2"><input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 flex-none rounded border border-line bg-surface" /><span className="flex-1 text-xs text-muted">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-xs" /></div>);
}
function FontRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (<label className="mb-2 block"><span className="mb-1 block text-xs text-muted">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>);
}

async function uploadTo(weddingId: string, file: File): Promise<{ url?: string; error?: string }> {
  const sb = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${weddingId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await sb.storage.from("invite-photos").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) return { error: error.message };
  return { url: sb.storage.from("invite-photos").getPublicUrl(path).data.publicUrl };
}

function ImageField({ label, value, weddingId, onChange }: { label: string; value: string; weddingId: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const up = async (file: File) => { setBusy(true); setErr(null); const r = await uploadTo(weddingId, file); if (r.error) setErr(r.error); else if (r.url) onChange(r.url); setBusy(false); };
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-12 w-12 flex-none rounded object-cover" /> : <div className="h-12 w-12 flex-none rounded border border-dashed border-line" />}
        <button onClick={() => ref.current?.click()} disabled={busy} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50">{busy ? "Uploading…" : "Upload"}</button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); e.target.value = ""; }} />
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="or paste an image URL" className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs" />
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

function ImagesField({ label, images, weddingId, onChange }: { label: string; images: string[]; weddingId: string; onChange: (imgs: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const add = async (files: FileList) => {
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) { const r = await uploadTo(weddingId, f); if (r.url) urls.push(r.url); }
    onChange([...images, ...urls]); setBusy(false);
  };
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {images.map((img, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="h-full w-full object-cover" />
            <button onClick={() => onChange(images.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 rounded bg-black/50 px-1 text-xs text-white opacity-0 group-hover:opacity-100">✕</button>
          </div>
        ))}
      </div>
      <button onClick={() => ref.current?.click()} disabled={busy} className="mt-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50">{busy ? "Uploading…" : "+ Add photos"}</button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function Repeater<T>({ label, items, empty, onChange, render }: { label: string; items: T[]; empty: T; onChange: (items: T[]) => void; render: (item: T, set: (v: T) => void) => React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</p>
      {items.map((it, i) => (
        <div key={i} className="mb-2 rounded-lg border border-line p-2">
          <div className="mb-1 flex justify-between"><span className="text-[11px] text-faint">#{i + 1}</span><button onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-xs text-faint hover:text-bad">remove</button></div>
          {render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))))}
        </div>
      ))}
      <button onClick={() => onChange([...items, empty])} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add</button>
    </div>
  );
}
