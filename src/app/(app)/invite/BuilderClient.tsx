"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SiteRenderer, EditorContext, type EditorApi } from "@/app/i/[token]/InviteRenderer";
import { SECTION_META, FONT_OPTIONS, THEME_PRESETS, fontsHref, type Theme, type Section, type Beat, type DetailCard, type ScheduleEvent, type FaqItem, type PartyMember, type GiftLink } from "@/lib/invite-config";
import { type SiteConfig, type SitePage, PAGE_TEMPLATES, type PageTemplateKey, newPage, uniqueSlug } from "@/lib/site-config";
import {
  type SectionNode, type ColumnNode, type WidgetNode, type NodeStyle, type Sides, type WidgetKind,
  WIDGET_META, GENERIC_WIDGETS, newWidget, newColumn, newSectionNode, normalizePage, widgetToSection, nid,
} from "@/lib/site-nodes";
import { saveInviteConfig } from "./actions";

const WEDDING_PALETTE: WidgetKind[] = ["hero", "story", "photoBand", "details", "schedule", "gallery", "party", "countdown", "faq", "gifts", "camera", "scavenger", "guestbook", "songs", "rsvp", "footer"];

// Give every page a block tree up front (legacy pages get wrapped once), so all
// editing operates on `blocks` and the preview renders the in-progress tree.
function withBlocks(site: SiteConfig): SiteConfig {
  return { ...site, pages: site.pages.map((p) => ({ ...p, blocks: normalizePage(p) })) };
}
const cloneWidget = (w: WidgetNode, seed: number): WidgetNode => ({ ...w, id: nid("w", seed), data: JSON.parse(JSON.stringify(w.data)), style: w.style ? { ...w.style } : undefined });
const cloneSection = (s: SectionNode, seed: number): SectionNode => ({ ...s, id: nid("sec", seed), columns: s.columns.map((c) => ({ ...c, id: nid("col", seed), children: c.children.map((w) => cloneWidget(w, seed)) })) });

type Sel = { kind: "section" | "column" | "widget"; id: string } | { kind: "theme" } | null;

export function BuilderClient({ weddingId, initial }: { weddingId: string; initial: SiteConfig }) {
  const [site, setSite] = useState<SiteConfig>(() => withBlocks(initial));
  const [pageId, setPageId] = useState<string>(initial.pages[0]?.id ?? "home");
  const [sel, setSel] = useState<Sel>({ kind: "theme" });
  const [tab, setTab] = useState<"content" | "style" | "advanced">("content");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [addingPage, setAddingPage] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [drag, setDrag] = useState<{ kind: "new" | "move"; ref: string } | null>(null);
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
  const blocks = (page.blocks as SectionNode[] | undefined) ?? [];
  const setPages = (pages: SitePage[]) => commit({ ...site, pages });
  const patchPage = (id: string, patch: Partial<SitePage>) => setPages(site.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const setBlocks = (bl: SectionNode[]) => patchPage(page.id, { blocks: bl });

  // --- block-tree ops (on the active page) ---
  const mapSection = (sid: string, fn: (s: SectionNode) => SectionNode) => setBlocks(blocks.map((s) => (s.id === sid ? fn(s) : s)));
  const findWidget = (id: string): { s: SectionNode; c: ColumnNode; w: WidgetNode } | null => {
    for (const s of blocks) for (const c of s.columns) { const w = c.children.find((x) => x.id === id); if (w) return { s, c, w }; }
    return null;
  };
  const findColumn = (id: string): { s: SectionNode; c: ColumnNode } | null => {
    for (const s of blocks) { const c = s.columns.find((x) => x.id === id); if (c) return { s, c }; }
    return null;
  };

  const patchWidget = (id: string, patch: Partial<WidgetNode>) =>
    setBlocks(blocks.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, children: c.children.map((w) => (w.id === id ? { ...w, ...patch } : w)) })) })));
  const patchWidgetData = (id: string, dpatch: Record<string, unknown>) => {
    const f = findWidget(id); if (!f) return;
    patchWidget(id, { data: { ...f.w.data, ...dpatch } });
  };
  const patchColumn = (id: string, patch: Partial<ColumnNode>) =>
    setBlocks(blocks.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })));
  const patchSection = (id: string, patch: Partial<SectionNode>) => mapSection(id, (s) => ({ ...s, ...patch }));
  const patchStyle = (kind: "section" | "column" | "widget", id: string, sp: Partial<NodeStyle>) => {
    const merge = (cur?: NodeStyle) => ({ ...cur, ...sp });
    if (kind === "widget") patchWidget(id, { style: merge(findWidget(id)?.w.style) });
    else if (kind === "column") patchColumn(id, { style: merge(findColumn(id)?.c.style) });
    else patchSection(id, { style: merge(blocks.find((s) => s.id === id)?.style) });
  };

  const insertWidget = (colId: string, index: number, w: WidgetNode) => {
    setBlocks(blocks.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === colId ? { ...c, children: [...c.children.slice(0, index), w, ...c.children.slice(index)] } : c)) })));
  };
  const dropNew = (widget: string, colId: string, index: number) => {
    const w = newWidget(widget as WidgetKind, seed.current++);
    insertWidget(colId, index, w);
    setSel({ kind: "widget", id: w.id }); setTab("content");
  };
  const dropMove = (widgetId: string, colId: string, index: number) => {
    const f = findWidget(widgetId); if (!f) return;
    // remove, then insert (compensate index if moving down within the same column)
    let bl = blocks.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, children: c.children.filter((x) => x.id !== widgetId) })) }));
    const sameCol = f.c.id === colId;
    const oldIndex = f.c.children.findIndex((x) => x.id === widgetId);
    const idx = sameCol && oldIndex < index ? index - 1 : index;
    bl = bl.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === colId ? { ...c, children: [...c.children.slice(0, idx), f.w, ...c.children.slice(idx)] } : c)) }));
    setBlocks(bl);
  };

  const dropSection = (payload: { kind: "new" | "move"; ref: string }, index: number) => {
    let w: WidgetNode; let bl = blocks;
    if (payload.kind === "new") w = newWidget(payload.ref as WidgetKind, seed.current++);
    else { const f = findWidget(payload.ref); if (!f) return; w = f.w; bl = blocks.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, children: c.children.filter((x) => x.id !== payload.ref) })) })); }
    const col = newColumn(seed.current++, 12, [w]);
    const sec = newSectionNode(seed.current++, [col], "boxed");
    setBlocks([...bl.slice(0, index), sec, ...bl.slice(index)]);
    setSel({ kind: "widget", id: w.id }); setTab("content");
  };
  const resizeCols = (leftId: string, rightId: string, l: number, r: number) =>
    setBlocks(blocks.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === leftId ? { ...c, span: l } : c.id === rightId ? { ...c, span: r } : c)) })));

  const widgetCmd = (id: string, cmd: "up" | "down" | "dup" | "del") => {
    const f = findWidget(id); if (!f) return;
    const arr = f.c.children; const i = arr.findIndex((x) => x.id === id);
    if (cmd === "del") { patchColumn(f.c.id, { children: arr.filter((x) => x.id !== id) }); setSel(null); return; }
    if (cmd === "dup") { const copy = cloneWidget(f.w, seed.current++); patchColumn(f.c.id, { children: [...arr.slice(0, i + 1), copy, ...arr.slice(i + 1)] }); setSel({ kind: "widget", id: copy.id }); return; }
    const j = cmd === "up" ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return;
    const na = [...arr]; [na[i], na[j]] = [na[j], na[i]]; patchColumn(f.c.id, { children: na });
  };
  const sectionCmd = (id: string, cmd: "up" | "down" | "dup" | "del") => {
    const i = blocks.findIndex((s) => s.id === id); if (i < 0) return;
    if (cmd === "del") { setBlocks(blocks.filter((s) => s.id !== id)); setSel(null); return; }
    if (cmd === "dup") { const copy = cloneSection(blocks[i], seed.current++); setBlocks([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]); setSel({ kind: "section", id: copy.id }); return; }
    const j = cmd === "up" ? i - 1 : i + 1; if (j < 0 || j >= blocks.length) return;
    const na = [...blocks]; [na[i], na[j]] = [na[j], na[i]]; setBlocks(na);
  };

  const addSection = (cols: number) => {
    const s = cols <= 1 ? newSectionNode(seed.current++, undefined, "boxed")
      : newSectionNode(seed.current++, Array.from({ length: cols }, () => newColumn(seed.current++, Math.round(12 / cols))), "boxed");
    setBlocks([...blocks, s]); setSel({ kind: "section", id: s.id }); setTab("content"); setAddingSection(false);
  };

  // Add a widget from the palette to a sensible target (near the selection).
  const addWidget = (kind: WidgetKind) => {
    let target: { colId: string; index: number } | null = null;
    if (sel && "id" in sel) {
      if (sel.kind === "widget") { const f = findWidget(sel.id); if (f) target = { colId: f.c.id, index: f.c.children.findIndex((x) => x.id === sel.id) + 1 }; }
      else if (sel.kind === "column") { const f = findColumn(sel.id); if (f) target = { colId: f.c.id, index: f.c.children.length }; }
      else { const s = blocks.find((x) => x.id === sel.id); if (s?.columns[0]) target = { colId: s.columns[0].id, index: s.columns[0].children.length }; }
    }
    if (!target) {
      const last = blocks[blocks.length - 1];
      if (last?.columns[0]) target = { colId: last.columns[0].id, index: last.columns[0].children.length };
    }
    if (!target) { // no sections yet — make one, then add
      const col = newColumn(seed.current++); const s = newSectionNode(seed.current++, [col], "boxed");
      const w = newWidget(kind, seed.current++); col.children.push(w);
      setBlocks([...blocks, s]); setSel({ kind: "widget", id: w.id }); setTab("content"); return;
    }
    dropNew(kind, target.colId, target.index);
  };

  // --- page ops ---
  const addPage = (key: PageTemplateKey) => {
    const p = newPage(key, seed.current++);
    p.slug = uniqueSlug(p.slug, site.pages.map((x) => x.slug));
    (p as SitePage & { blocks?: SectionNode[] }).blocks = normalizePage(p);
    commit({ ...site, pages: [...site.pages, p] });
    setPageId(p.id); setSel(null); setAddingPage(false);
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
    if (pageId === id) { setPageId(arr[0].id); setSel(null); }
  };

  const setTheme = (patch: Partial<Theme>) => commit({ ...site, theme: { ...site.theme, ...patch } });
  const applyPreset = (theme: Theme) => commit({ ...site, theme });
  const saveTheme = () => {
    const name = prompt("Name this theme"); if (!name) return;
    commit({ ...site, savedThemes: [...(site.savedThemes ?? []), { id: `theme-${seed.current++}`, name, theme: site.theme }] });
  };

  const editor: EditorApi = useMemo(() => ({
    selId: sel && "id" in sel ? sel.id : null,
    select: (id) => { const f = findWidget(id); if (f) { setSel({ kind: "widget", id }); setTab("content"); return; } if (findColumn(id)) { setSel({ kind: "column", id }); setTab("content"); return; } setSel({ kind: "section", id }); setTab("content"); },
    widgetCmd, sectionCmd, dropNew, dropMove, dropSection, resizeCols, drag, setDrag,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sel, drag, blocks]);

  return (
    <div className="flex flex-col lg:h-screen lg:flex-row">
      {/* LEFT — pages + element palette */}
      <aside className="flex max-h-[45vh] w-full flex-none flex-col overflow-y-auto border-b border-line bg-surface lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <span className="text-sm font-semibold">Website</span>
          <span className="text-[11px] text-faint">{status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : ""}</span>
        </div>
        <button onClick={() => setSel({ kind: "theme" })} className={`border-b border-line px-3 py-2 text-left text-sm ${sel?.kind === "theme" ? "bg-accent-weak font-semibold text-accent" : "hover:bg-surface-2"}`}>🎨 Theme &amp; fonts</button>

        {/* Pages */}
        <div className="border-b border-line px-3 py-1.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">Pages</p>
          {site.pages.map((p, i) => (
            <div key={p.id} className={`group flex items-center gap-1 rounded px-1 py-1 ${p.id === pageId ? "bg-accent-weak" : "hover:bg-surface-2"}`}>
              <div className="flex flex-col">
                <button onClick={() => movePage(p.id, -1)} disabled={i === 0} className="h-2.5 leading-none text-faint hover:text-ink disabled:opacity-30">▲</button>
                <button onClick={() => movePage(p.id, 1)} disabled={i === site.pages.length - 1} className="h-2.5 leading-none text-faint hover:text-ink disabled:opacity-30">▼</button>
              </div>
              <button onClick={() => { setPageId(p.id); setSel(null); }} className="min-w-0 flex-1 text-left"><span className={`block truncate text-sm ${p.id === pageId ? "font-semibold text-accent" : ""}`}>{p.title}</span></button>
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

        {/* Page title + add-section */}
        <div className="px-3 py-1.5">
          <label className="mb-2 block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-faint">Editing page</span>
            <input value={page.title} onChange={(e) => patchPage(page.id, { title: e.target.value })} className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs" placeholder="Page title" />
          </label>
          <div className="relative">
            <button onClick={() => setAddingSection((a) => !a)} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add section</button>
            {addingSection && (
              <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-line bg-surface p-2 shadow-lg">
                <p className="mb-1 text-[10px] text-faint">Columns</p>
                <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <button key={n} onClick={() => addSection(n)} className="flex-1 rounded border border-line py-1.5 text-xs hover:border-accent">{n}</button>)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Element palette */}
        <div className="flex-1 px-3 pb-2">
          <p className="mb-1.5 mt-1 text-[10px] font-bold uppercase tracking-wide text-faint">Elements</p>
          <div className="grid grid-cols-2 gap-1.5">
            {GENERIC_WIDGETS.map((k) => <PaletteItem key={k} kind={k} onAdd={() => addWidget(k)} setDrag={setDrag} />)}
          </div>
          <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wide text-faint">Wedding blocks</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WEDDING_PALETTE.map((k) => <PaletteItem key={k} kind={k} onAdd={() => addWidget(k)} setDrag={setDrag} />)}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-faint">Click to add near your selection, or drag onto the canvas.</p>
        </div>
      </aside>

      {/* CENTER — WYSIWYG canvas */}
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
        <div className={`preview-pane editing flex-1 ${device === "mobile" ? "mobile" : ""}`} onClick={() => setSel(null)}>
          <EditorContext.Provider value={editor}>
            <SiteRenderer site={site} pageSlug={page.slug} mode="preview" />
          </EditorContext.Provider>
        </div>
      </div>

      {/* RIGHT — inspector */}
      <aside className="w-full flex-none overflow-y-auto border-t border-line bg-surface lg:w-80 lg:border-l lg:border-t-0">
        {sel?.kind === "theme" ? (
          <div className="p-4"><ThemePanel theme={site.theme} savedThemes={site.savedThemes ?? []} setTheme={setTheme} applyPreset={applyPreset} saveTheme={saveTheme} /></div>
        ) : sel && "id" in sel ? (
          <Inspector
            key={sel.id}
            sel={sel}
            blocks={blocks}
            weddingId={weddingId}
            tab={tab} setTab={setTab}
            findWidget={findWidget} findColumn={findColumn}
            patchWidgetData={patchWidgetData} patchStyle={patchStyle}
            patchSection={patchSection} patchColumn={patchColumn}
            widgetCmd={widgetCmd} sectionCmd={sectionCmd}
          />
        ) : (
          <div className="p-4 text-sm text-faint">Click an element in the canvas to edit it, add elements from the left, or open Theme &amp; fonts.</div>
        )}
      </aside>
    </div>
  );
}

function PaletteItem({ kind, onAdd, setDrag }: { kind: WidgetKind; onAdd: () => void; setDrag: (d: { kind: "new" | "move"; ref: string } | null) => void }) {
  const m = WIDGET_META[kind];
  return (
    <button
      onClick={onAdd}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", kind); setDrag({ kind: "new", ref: kind }); }}
      onDragEnd={() => setDrag(null)}
      className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 text-left text-xs hover:border-accent hover:bg-surface-2"
    >
      <span className="w-4 flex-none text-center text-[13px] text-muted">{m.icon}</span>
      <span className="truncate">{m.label}</span>
    </button>
  );
}

/* -------------------------------- Inspector ------------------------------- */

function Inspector(props: {
  sel: { kind: "section" | "column" | "widget"; id: string };
  blocks: SectionNode[]; weddingId: string;
  tab: "content" | "style" | "advanced"; setTab: (t: "content" | "style" | "advanced") => void;
  findWidget: (id: string) => { s: SectionNode; c: ColumnNode; w: WidgetNode } | null;
  findColumn: (id: string) => { s: SectionNode; c: ColumnNode } | null;
  patchWidgetData: (id: string, d: Record<string, unknown>) => void;
  patchStyle: (kind: "section" | "column" | "widget", id: string, sp: Partial<NodeStyle>) => void;
  patchSection: (id: string, patch: Partial<SectionNode>) => void;
  patchColumn: (id: string, patch: Partial<ColumnNode>) => void;
  widgetCmd: (id: string, cmd: "up" | "down" | "dup" | "del") => void;
  sectionCmd: (id: string, cmd: "up" | "down" | "dup" | "del") => void;
}) {
  const { sel, blocks, weddingId, tab, setTab } = props;
  const w = sel.kind === "widget" ? props.findWidget(sel.id)?.w : undefined;
  const col = sel.kind === "column" ? props.findColumn(sel.id)?.c : undefined;
  const section = sel.kind === "section" ? blocks.find((s) => s.id === sel.id) : undefined;
  const node = w ?? col ?? section;
  if (!node) return <div className="p-4 text-sm text-faint">Element not found.</div>;
  const style = node.style;
  const title = sel.kind === "widget" && w ? WIDGET_META[w.widget].label : sel.kind === "column" ? "Column" : "Section";
  const setStyle = (sp: Partial<NodeStyle>) => props.patchStyle(sel.kind, sel.id, sp);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <span className="truncate text-sm font-semibold">{title}</span>
        <div className="flex gap-1 text-xs text-faint">
          {sel.kind === "widget" && <>
            <button title="Duplicate" onClick={() => props.widgetCmd(sel.id, "dup")} className="hover:text-ink">⧉</button>
            <button title="Delete" onClick={() => props.widgetCmd(sel.id, "del")} className="hover:text-bad">✕</button>
          </>}
          {sel.kind === "section" && <>
            <button title="Duplicate" onClick={() => props.sectionCmd(sel.id, "dup")} className="hover:text-ink">⧉</button>
            <button title="Delete" onClick={() => props.sectionCmd(sel.id, "del")} className="hover:text-bad">✕</button>
          </>}
        </div>
      </div>
      <div className="flex border-b border-line text-xs">
        {(["content", "style", "advanced"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 capitalize ${tab === t ? "border-b-2 border-accent font-semibold text-accent" : "text-muted hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      <div className="p-4">
        {tab === "content" && (
          <>
            {sel.kind === "widget" && w && (WIDGET_META[w.widget].generic
              ? <GenericContent w={w} weddingId={weddingId} onChange={(d) => props.patchWidgetData(sel.id, d)} />
              : <SectionInspector section={widgetToSection(w)} weddingId={weddingId} onChange={(patch) => props.patchWidgetData(sel.id, patch as Record<string, unknown>)} />)}
            {sel.kind === "section" && section && (
              <div>
                <Seg label="Width" value={section.layout} options={[["boxed", "Boxed"], ["full", "Full width"]]} onChange={(v) => props.patchSection(sel.id, { layout: v as "boxed" | "full" })} />
                <p className="mt-3 text-xs text-faint">This section has {section.columns.length} column{section.columns.length > 1 ? "s" : ""}. Select a column to size it, or drag elements between columns on the canvas.</p>
              </div>
            )}
            {sel.kind === "column" && col && (
              <Num label={`Width (of 12)`} value={col.span} min={1} max={12} onChange={(v) => props.patchColumn(sel.id, { span: Math.max(1, Math.min(12, v)) })} />
            )}
          </>
        )}
        {tab === "style" && <StylePanel isSection={sel.kind === "section"} style={style} weddingId={weddingId} onChange={setStyle} />}
        {tab === "advanced" && <AdvancedPanel isSection={sel.kind === "section"} style={style} onChange={setStyle} />}
      </div>
    </div>
  );
}

function GenericContent({ w, weddingId, onChange }: { w: WidgetNode; weddingId: string; onChange: (d: Record<string, unknown>) => void }) {
  const d = w.data as Record<string, unknown>;
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const n = (k: string, fb: number) => (typeof d[k] === "number" ? (d[k] as number) : fb);
  switch (w.widget) {
    case "heading": return (<><Text label="Heading text" value={s("text")} onChange={(v) => onChange({ text: v })} /><Num label="Level (1–6)" value={n("level", 2)} min={1} max={6} onChange={(v) => onChange({ level: Math.max(1, Math.min(6, v)) })} /></>);
    case "text": return <Area label="Text" value={s("body")} onChange={(v) => onChange({ body: v })} />;
    case "image": return (<><ImageField label="Image" value={s("src")} weddingId={weddingId} onChange={(v) => onChange({ src: v })} /><Text label="Alt text" value={s("alt")} onChange={(v) => onChange({ alt: v })} /><Text label="Link (optional)" value={s("href")} onChange={(v) => onChange({ href: v })} /><Toggle label="Rounded corners" checked={d.rounded !== false} onChange={(v) => onChange({ rounded: v })} /></>);
    case "button": return (<><Text label="Label" value={s("label")} onChange={(v) => onChange({ label: v })} /><Text label="Link URL" value={s("href")} onChange={(v) => onChange({ href: v })} /><Seg label="Style" value={s("variant") || "solid"} options={[["solid", "Solid"], ["outline", "Outline"]]} onChange={(v) => onChange({ variant: v })} /></>);
    case "spacer": return <Num label="Height (px)" value={n("height", 40)} min={0} max={400} onChange={(v) => onChange({ height: v })} />;
    case "divider": return <Toggle label="Ornament (vs plain line)" checked={d.variantOrnament !== false} onChange={(v) => onChange({ variantOrnament: v })} />;
    case "icon": return (<><Text label="Symbol / emoji" value={s("glyph")} onChange={(v) => onChange({ glyph: v })} /><Num label="Size (px)" value={n("size", 40)} min={12} max={160} onChange={(v) => onChange({ size: v })} /></>);
    case "video": return <Text label="Video URL (YouTube, Vimeo, MP4)" value={s("url")} onChange={(v) => onChange({ url: v })} />;
    case "map": return (<><Text label="Address or place" value={s("query")} onChange={(v) => onChange({ query: v })} /><Num label="Height (px)" value={n("height", 320)} min={140} max={700} onChange={(v) => onChange({ height: v })} /></>);
    case "embed": return <Area label="HTML / embed code" value={s("html")} onChange={(v) => onChange({ html: v })} />;
    case "quote": return (<><Area label="Quote" value={s("text")} onChange={(v) => onChange({ text: v })} /><Text label="Attribution (optional)" value={s("cite")} onChange={(v) => onChange({ cite: v })} /></>);
    case "list": {
      const items = (Array.isArray(d.items) ? (d.items as unknown[]).map(String) : []).map((text) => ({ text }));
      return (<><Toggle label="Numbered list" checked={d.ordered === true} onChange={(v) => onChange({ ordered: v })} /><Repeater<{ text: string }> label="Items" items={items} empty={{ text: "" }} onChange={(its) => onChange({ items: its.map((i) => i.text) })} render={(it, set) => (<Text label="Item" value={it.text} onChange={(v) => set({ text: v })} />)} /></>);
    }
    case "socials": {
      const links = Array.isArray(d.links) ? (d.links as { network?: string; url?: string }[]) : [];
      return <Repeater<{ network?: string; url?: string }> label="Links" items={links} empty={{ network: "instagram", url: "" }} onChange={(ls) => onChange({ links: ls })} render={(l, set) => (<><Select label="Network" value={l.network ?? "instagram"} options={[["instagram", "Instagram"], ["facebook", "Facebook"], ["x", "X / Twitter"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["pinterest", "Pinterest"], ["spotify", "Spotify"], ["website", "Website"], ["email", "Email"]]} onChange={(v) => set({ ...l, network: v })} /><Text label="URL" value={l.url ?? ""} onChange={(v) => set({ ...l, url: v })} /></>)} />;
    }
    default: return null;
  }
}

function StylePanel({ isSection, style, weddingId, onChange }: { isSection: boolean; style?: NodeStyle; weddingId: string; onChange: (p: Partial<NodeStyle>) => void }) {
  const st = style ?? {};
  return (
    <div>
      <Group label="Alignment">
        <Seg label="Text align" value={st.align ?? "left"} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => onChange({ align: v as NodeStyle["align"] })} />
      </Group>
      <Group label="Spacing">
        <SideBox label="Padding" value={st.padding} onChange={(v) => onChange({ padding: v })} />
        <SideBox label="Margin" value={st.margin} onChange={(v) => onChange({ margin: v })} />
        {isSection && <Num label="Content max width (px, 0 = default)" value={st.maxWidth ?? 0} min={0} max={1600} onChange={(v) => onChange({ maxWidth: v || undefined })} />}
      </Group>
      <Group label="Background">
        <ColorRow label="Colour" value={st.bgColor ?? ""} onChange={(v) => onChange({ bgColor: v })} />
        {isSection && <><ImageField label="Image" value={st.bgImage ?? ""} weddingId={weddingId} onChange={(v) => onChange({ bgImage: v })} /><ColorRow label="Overlay (rgba)" value={st.overlay ?? ""} onChange={(v) => onChange({ overlay: v })} /></>}
      </Group>
      <Group label="Typography">
        <Select label="Font" value={st.fontFamily ?? ""} options={[["", "Theme default"], ["display", "Headings"], ["script", "Script"], ["sans", "Sans"]]} onChange={(v) => onChange({ fontFamily: v as NodeStyle["fontFamily"] })} />
        <ColorRow label="Text colour" value={st.color ?? ""} onChange={(v) => onChange({ color: v })} />
        <div className="grid grid-cols-2 gap-2"><Num label="Size (px)" value={st.fontSize ?? 0} min={0} max={140} onChange={(v) => onChange({ fontSize: v || undefined })} /><Num label="Size · mobile" value={st.fontSizeMobile ?? 0} min={0} max={140} onChange={(v) => onChange({ fontSizeMobile: v || undefined })} /></div>
        <div className="grid grid-cols-2 gap-2"><Num label="Weight" value={st.fontWeight ?? 0} min={0} max={900} step={100} onChange={(v) => onChange({ fontWeight: v || undefined })} /><Num label="Letter-spacing" value={st.letterSpacing ?? 0} min={0} max={20} onChange={(v) => onChange({ letterSpacing: v || undefined })} /></div>
      </Group>
      <Group label="Border">
        <div className="grid grid-cols-2 gap-2"><Num label="Width" value={st.borderWidth ?? 0} min={0} max={20} onChange={(v) => onChange({ borderWidth: v || undefined })} /><Num label="Radius" value={st.radius ?? 0} min={0} max={80} onChange={(v) => onChange({ radius: v || undefined })} /></div>
        <ColorRow label="Border colour" value={st.borderColor ?? ""} onChange={(v) => onChange({ borderColor: v })} />
        <Toggle label="Drop shadow" checked={!!st.shadow} onChange={(v) => onChange({ shadow: v })} />
      </Group>
    </div>
  );
}

function AdvancedPanel({ isSection, style, onChange }: { isSection: boolean; style?: NodeStyle; onChange: (p: Partial<NodeStyle>) => void }) {
  const st = style ?? {};
  return (
    <div>
      <Group label="Animation (on the live site)">
        <Select label="Reveal" value={st.animation ?? "none"} options={[["none", "None"], ["fade", "Fade in"], ["rise", "Rise up"], ["zoom", "Zoom in"]]} onChange={(v) => onChange({ animation: v as NodeStyle["animation"] })} />
      </Group>
      <Group label="Responsive visibility">
        <Toggle label="Hide on mobile" checked={!!st.hideMobile} onChange={(v) => onChange({ hideMobile: v })} />
        <Toggle label="Hide on desktop" checked={!!st.hideDesktop} onChange={(v) => onChange({ hideDesktop: v })} />
      </Group>
      {isSection && <p className="text-xs text-faint">Tip: set a mobile padding under Style → Spacing by using smaller values, and a mobile font size under Typography.</p>}
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
        <Num label="Shots per guest (0 = unlimited)" value={s.shots ?? 24} min={0} max={200} onChange={(v) => P({ shots: v } as Partial<Section>)} />
        <p className="mt-2 text-xs text-faint">Guests shoot freely into a shared gallery, limited to this many photos each (the disposable-camera feel). For photo challenges, add a separate <strong>Scavenger hunt</strong> block.</p>
      </>)}
      {s.type === "scavenger" && (<>
        <Text label="Small label" value={s.label} onChange={(v) => P({ label: v } as Partial<Section>)} />
        <Text label="Heading" value={s.heading} onChange={(v) => P({ heading: v } as Partial<Section>)} />
        <Area label="Message" value={s.lead} onChange={(v) => P({ lead: v } as Partial<Section>)} />
        <Repeater<{ text: string }> label="Challenges" items={s.prompts.map((text) => ({ text }))} empty={{ text: "" }} onChange={(items) => P({ prompts: items.map((i) => i.text) } as Partial<Section>)} render={(it, set) => (<Text label="Prompt" value={it.text} onChange={(v) => set({ text: v })} />)} />
        <p className="mt-2 text-xs text-faint">Each challenge is a photo prompt guests can capture. Photos appear under the challenge and in your gallery.</p>
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

function Num({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (<label className="mb-2 block"><span className="mb-1 block text-xs text-muted">{label}</span><input type="number" value={value} min={min} max={max} step={step ?? 1} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={fieldCls} /></label>);
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (<label className="mb-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-line" />{label}</label>);
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (<label className="mb-2 block"><span className="mb-1 block text-xs text-muted">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>);
}
function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="mb-2">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${value === v ? "border-accent bg-accent-weak text-accent" : "border-line hover:bg-surface-2"}`}>{l}</button>)}
      </div>
    </div>
  );
}
function SideBox({ label, value, onChange }: { label: string; value?: Sides; onChange: (v: Sides) => void }) {
  const v = value ?? {};
  const set = (k: keyof Sides, n: string) => onChange({ ...v, [k]: n === "" ? undefined : Number(n) });
  const cell = (k: keyof Sides, ph: string) => (<input type="number" value={v[k] ?? ""} placeholder={ph} onChange={(e) => set(k, e.target.value)} className="w-full rounded-md border border-line bg-surface px-1.5 py-1 text-center text-xs" />);
  return (
    <div className="mb-2">
      <span className="mb-1 block text-xs text-muted">{label} (px)</span>
      <div className="grid grid-cols-4 gap-1">{cell("t", "T")}{cell("r", "R")}{cell("b", "B")}{cell("l", "L")}</div>
      <div className="mt-0.5 grid grid-cols-4 gap-1 text-center text-[9px] text-faint"><span>top</span><span>right</span><span>bottom</span><span>left</span></div>
    </div>
  );
}
