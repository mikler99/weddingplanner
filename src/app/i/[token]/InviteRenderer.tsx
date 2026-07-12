"use client";

import React, { createContext, useContext, useState } from "react";
import type { InviteConfig, Section } from "@/lib/invite-config";
import { themeVars } from "@/lib/invite-config";
import { pageBySlug, isHomePage, type SiteConfig } from "@/lib/site-config";
import {
  type SectionNode, type ColumnNode, type WidgetNode, type NodeStyle, type Sides,
  normalizePage, isPassthrough, widgetToSection, findWidget, WIDGET_META,
} from "@/lib/site-nodes";
import { RsvpForm, SiteRsvpLookup, type InviteGuest } from "./RsvpForm";
import { InviteMotion } from "./InviteMotion";
import { CameraBlock, ScavengerBlock, GuestbookBlock, SongsBlock } from "@/app/w/WeddingApp";
import { Lightbox } from "@/app/w/Lightbox";

type Mode = "live" | "preview";

export function InviteRenderer({ config, mode, token, guest }: { config: InviteConfig; mode: Mode; token?: string; guest?: InviteGuest }) {
  const hero = config.sections.find((s) => s.type === "hero") as Extract<Section, { type: "hero" }> | undefined;
  const countdown = config.sections.find((s) => s.type === "countdown") as Extract<Section, { type: "countdown" }> | undefined;
  const style: React.CSSProperties = { ...themeVars(config.theme) };
  if (hero) (style as Record<string, string>)["--img-hero"] = `url('${hero.bgImage}')`;

  return (
    <>
      <div className="invite" style={style}>
        <div className="bg-wood" />
        <div className="bg-veil" />
        {config.sections.filter((s) => s.visible).map((s) => (
          <SectionView key={s.id} s={s} mode={mode} token={token} guest={guest} />
        ))}
      </div>
      {mode === "live" && countdown && <InviteMotion targetIso={countdown.targetIso} />}
    </>
  );
}

// Renders ONE page of a multi-page site + a themed top nav (when >1 page).
export function SiteRenderer({ site, pageSlug, mode, token, guest, base = "", slug }: {
  site: SiteConfig; pageSlug?: string; mode: Mode; token?: string; guest?: InviteGuest; base?: string; slug?: string;
}) {
  const page = pageBySlug(site, pageSlug);
  const blocks = normalizePage(page);
  const hero = findWidget(blocks, "hero");
  const countdown = findWidget(blocks, "countdown");
  const style: React.CSSProperties = { ...themeVars(site.theme) };
  const heroImg = (hero?.data as { bgImage?: string } | undefined)?.bgImage;
  if (heroImg) (style as Record<string, string>)["--img-hero"] = `url('${heroImg}')`;

  const navPages = site.pages.filter((p) => p.showInNav);
  const customLinks = site.nav?.links ?? [];
  const brand = site.nav?.brand?.trim();
  const hrefForPage = (p: typeof site.pages[number]) => (isHomePage(site, p) ? base || "/" : `${base}/${p.slug}`);
  const showNav = !!brand || navPages.length > 1 || customLinks.length > 0;

  return (
    <>
      <div className="invite" style={style}>
        <div className="bg-wood" />
        <div className="bg-veil" />
        {showNav && (
          <SiteNav
            brand={brand}
            live={mode === "live"}
            items={[
              ...navPages.map((p) => ({ key: p.id, label: p.title, href: hrefForPage(p), current: p.id === page.id })),
              ...customLinks.filter((l) => l.label).map((l) => ({ key: l.id, label: l.label, href: l.href || "#", current: false })),
            ]}
          />
        )}
        <BlocksRenderer blocks={blocks} mode={mode} token={token} guest={guest} slug={slug} />
      </div>
      {mode === "live" && countdown && <InviteMotion targetIso={(countdown.data as { targetIso?: string }).targetIso ?? ""} />}
      {mode === "live" && <Lightbox />}
    </>
  );
}

/* ============================ Element engine =============================== */
/* Renders the block tree. Wedding widgets delegate to SectionView (unchanged);
   generic widgets render from their data + per-node style settings. */

// When an EditorApi is supplied (builder canvas), the render tree grows select
// outlines, hover toolbars and drop zones; on the public site it's null and the
// components render plain. This keeps ONE renderer for edit + live (true WYSIWYG).
export type NodeKind = "section" | "column" | "widget";
export type EditorApi = {
  selId: string | null;
  select: (id: string) => void;
  widgetCmd: (id: string, cmd: "up" | "down" | "dup" | "del") => void;
  sectionCmd: (id: string, cmd: "up" | "down" | "dup" | "del") => void;
  dropNew: (widget: string, colId: string, index: number) => void;
  dropMove: (widgetId: string, colId: string, index: number) => void;
  dropSection: (payload: { kind: "new" | "move"; ref: string }, index: number) => void;
  resizeCols: (leftId: string, rightId: string, left: number, right: number) => void;
  drag: { kind: "new" | "move"; ref: string } | null;
  setDrag: (d: { kind: "new" | "move"; ref: string } | null) => void;
};
export const EditorContext = createContext<EditorApi | null>(null);

export function BlocksRenderer({ blocks, mode, token, guest, slug }: { blocks: SectionNode[]; mode: Mode; token?: string; guest?: InviteGuest; slug?: string }) {
  const ed = useContext(EditorContext);
  if (!ed) return <>{blocks.filter((b) => b.visible !== false).map((sec) => <SectionNodeView key={sec.id} sec={sec} mode={mode} token={token} guest={guest} slug={slug} />)}</>;
  return (
    <>
      <SectionDropBar ed={ed} index={0} />
      {blocks.map((sec, i) => (
        <React.Fragment key={sec.id}>
          <SectionNodeView sec={sec} mode={mode} token={token} guest={guest} slug={slug} />
          <SectionDropBar ed={ed} index={i + 1} />
        </React.Fragment>
      ))}
    </>
  );
}

function SectionNodeView({ sec, mode, token, guest, slug }: { sec: SectionNode; mode: Mode; token?: string; guest?: InviteGuest; slug?: string }) {
  const ed = useContext(EditorContext);
  const pass = isPassthrough(sec);
  // A lone, unstyled wedding widget renders exactly as before (no wrapper);
  // in the editor we still wrap it so the section is selectable.
  if (pass) {
    const body = <WidgetView w={pass} mode={mode} token={token} guest={guest} slug={slug} />;
    return ed ? <EdBox id={sec.id} kind="section" ed={ed} label="Section" faded={sec.visible === false}>{body}</EdBox> : body;
  }

  const st = sec.style;
  const secStyle: React.CSSProperties = { ...secVars(st), position: st?.overlay ? "relative" : undefined };
  if (st?.bgColor) secStyle.background = st.bgColor;
  if (st?.bgImage) { secStyle.backgroundImage = `url('${st.bgImage}')`; secStyle.backgroundSize = "cover"; secStyle.backgroundPosition = "center"; }
  const body = (
    <section className={`node-sec ${sec.layout === "full" ? "full" : "boxed"} ${hideClass(st)} ${animClass(st, mode)}`} style={secStyle}>
      {st?.overlay && <div className="node-overlay" style={{ background: st.overlay }} />}
      <div className="node-row" style={{ maxWidth: st?.maxWidth ? `${st.maxWidth}px` : undefined }}>
        {sec.columns.map((col, i) => (
          <React.Fragment key={col.id}>
            {ed && i > 0 && <ColResize ed={ed} left={sec.columns[i - 1]} right={col} />}
            <ColumnView col={col} mode={mode} token={token} guest={guest} slug={slug} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
  return ed ? <EdBox id={sec.id} kind="section" ed={ed} label="Section" faded={sec.visible === false}>{body}</EdBox> : body;
}

function ColumnView({ col, mode, token, guest, slug }: { col: ColumnNode; mode: Mode; token?: string; guest?: InviteGuest; slug?: string }) {
  const ed = useContext(EditorContext);
  const style: React.CSSProperties = { flexGrow: col.span, ...widgetCss(col.style) };
  const kids = ed ? col.children : col.children.filter((w) => w.visible !== false);
  return (
    <div className={`node-col ${hideClass(col.style)}`} style={style}>
      {ed && <DropBar ed={ed} colId={col.id} index={0} />}
      {kids.map((w, i) => (
        <React.Fragment key={w.id}>
          <WidgetView w={w} mode={mode} token={token} guest={guest} slug={slug} />
          {ed && <DropBar ed={ed} colId={col.id} index={i + 1} />}
        </React.Fragment>
      ))}
      {ed && kids.length === 0 && <EmptyDrop ed={ed} colId={col.id} />}
    </div>
  );
}

function WidgetView({ w, mode, token, guest, slug }: { w: WidgetNode; mode: Mode; token?: string; guest?: InviteGuest; slug?: string }) {
  const ed = useContext(EditorContext);
  let body: React.ReactNode;
  if (!WIDGET_META[w.widget]?.generic) {
    body = <SectionView s={widgetToSection(w)} mode={mode} token={token} guest={guest} slug={slug} />;
  } else {
    const cls = `node-w node-${w.widget} ${hideClass(w.style)} ${animClass(w.style, mode)}`;
    body = <div className={cls.trim()} style={{ ...widgetCss(w.style), ...widgetVars(w.style) }}>{renderGeneric(w)}</div>;
  }
  if (!ed) return <>{body}</>;
  return <EdBox id={w.id} kind="widget" ed={ed} label={WIDGET_META[w.widget]?.label ?? "Element"} faded={w.visible === false} draggable>{body}</EdBox>;
}

/* ---- editor chrome (only rendered when an EditorApi is present) ---- */

function EdBox({ id, kind, ed, label, children, faded, draggable }: { id: string; kind: NodeKind; ed: EditorApi; label: string; children: React.ReactNode; faded?: boolean; draggable?: boolean }) {
  const selected = ed.selId === id;
  return (
    <div
      className={`ed-node ed-${kind} ${selected ? "sel" : ""} ${faded ? "faded" : ""}`}
      data-node-id={id}
      onClick={(e) => { e.stopPropagation(); ed.select(id); }}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; ed.setDrag({ kind: "move", ref: id }); } : undefined}
      onDragEnd={draggable ? () => ed.setDrag(null) : undefined}
    >
      <span className="ed-tag">{label}</span>
      {selected && (
        <span className="ed-tools" onClick={(e) => e.stopPropagation()}>
          <button title="Move up" onClick={() => (kind === "widget" ? ed.widgetCmd(id, "up") : ed.sectionCmd(id, "up"))}>↑</button>
          <button title="Move down" onClick={() => (kind === "widget" ? ed.widgetCmd(id, "down") : ed.sectionCmd(id, "down"))}>↓</button>
          <button title="Duplicate" onClick={() => (kind === "widget" ? ed.widgetCmd(id, "dup") : ed.sectionCmd(id, "dup"))}>⧉</button>
          <button title="Delete" onClick={() => (kind === "widget" ? ed.widgetCmd(id, "del") : ed.sectionCmd(id, "del"))}>✕</button>
        </span>
      )}
      {children}
    </div>
  );
}

function DropBar({ ed, colId, index }: { ed: EditorApi; colId: string; index: number }) {
  const [over, setOver] = React.useState(false);
  const active = !!ed.drag;
  return (
    <div
      className={`ed-drop ${active ? "armed" : ""} ${over ? "over" : ""}`}
      onDragOver={(e) => { if (ed.drag) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const d = ed.drag; ed.setDrag(null);
        if (!d) return;
        if (d.kind === "new") ed.dropNew(d.ref, colId, index);
        else ed.dropMove(d.ref, colId, index);
      }}
    />
  );
}

// Drop between/around sections → creates a new section from the dragged element.
function SectionDropBar({ ed, index }: { ed: EditorApi; index: number }) {
  const [over, setOver] = React.useState(false);
  return (
    <div
      className={`ed-sdrop ${ed.drag ? "armed" : ""} ${over ? "over" : ""}`}
      onDragOver={(e) => { if (ed.drag) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const d = ed.drag; ed.setDrag(null); if (d) ed.dropSection(d, index); }}
    />
  );
}

function EmptyDrop({ ed, colId }: { ed: EditorApi; colId: string }) {
  const [over, setOver] = React.useState(false);
  return (
    <div
      className={`ed-empty-col ${over ? "over" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onDragOver={(e) => { if (ed.drag) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const d = ed.drag; ed.setDrag(null); if (!d) return;
        if (d.kind === "new") ed.dropNew(d.ref, colId, 0); else ed.dropMove(d.ref, colId, 0);
      }}
    >Drop an element here</div>
  );
}

// Drag the divider between two columns to re-balance their 1–12 spans.
function ColResize({ ed, left, right }: { ed: EditorApi; left: ColumnNode; right: ColumnNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const row = ref.current?.parentElement as HTMLElement | null;
    if (!row) return;
    const width = row.getBoundingClientRect().width || 1;
    const startX = e.clientX;
    const l0 = left.span, r0 = right.span, total = l0 + r0;
    const move = (ev: PointerEvent) => {
      const units = Math.round(((ev.clientX - startX) / width) * 12);
      let l = l0 + units, r = r0 - units;
      if (l < 1) { r -= 1 - l; l = 1; }
      if (r < 1) { l -= 1 - r; r = 1; }
      if (l + r !== total) return;
      ed.resizeCols(left.id, right.id, l, r);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return <div ref={ref} className="ed-colresize" onPointerDown={onDown} onClick={(e) => e.stopPropagation()} title="Drag to resize columns" />;
}

function renderGeneric(w: WidgetNode): React.ReactNode {
  const d = w.data as Record<string, unknown>;
  const str = (k: string, fb = "") => (typeof d[k] === "string" ? (d[k] as string) : fb);
  const num = (k: string, fb: number) => (typeof d[k] === "number" ? (d[k] as number) : fb);
  switch (w.widget) {
    case "heading": {
      const lvl = Math.min(6, Math.max(1, num("level", 2)));
      const Tag = (`h${lvl}` as unknown) as keyof React.JSX.IntrinsicElements;
      return <Tag className="nh">{str("text", "Heading")}</Tag>;
    }
    case "text":
      return <>{str("body").split(/\n{2,}/).map((p, i) => <p key={i} className="nt">{p.split("\n").map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>)}</>;
    case "image": {
      const href = str("href");
      const img = <img className="nimg" src={str("src")} alt={str("alt")} style={{ borderRadius: d.rounded ? 3 : undefined }} loading="lazy" data-full={href ? undefined : str("src")} />;
      return href ? <a href={href} target="_blank" rel="noreferrer">{img}</a> : img;
    }
    case "button":
      return <a className={`nbtn ${str("variant", "solid") === "outline" ? "outline" : "solid"}`} href={str("href", "#")}>{str("label", "Button")}</a>;
    case "spacer":
      return <div style={{ height: num("height", 40) }} aria-hidden />;
    case "divider":
      return d.variantOrnament === false ? <hr className="nhr" /> : <div className="nornament"><span className="l" /><span className="d" /><span className="l r" /></div>;
    case "icon":
      return <div className="nicon" style={{ fontSize: num("size", 40) }}>{str("glyph", "❦")}</div>;
    case "video": {
      const embed = videoEmbed(str("url"));
      if (!embed) return <div className="nembed-empty">Add a video URL</div>;
      return <div className="nvideo">{embed.type === "iframe" ? <iframe src={embed.src} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video src={embed.src} controls />}</div>;
    }
    case "map": {
      const q = str("query");
      if (!q) return <div className="nembed-empty">Add an address or place</div>;
      return <div className="nmap" style={{ height: num("height", 320) }}><iframe src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`} loading="lazy" /></div>;
    }
    case "embed":
      return str("html") ? <div className="nraw" dangerouslySetInnerHTML={{ __html: str("html") }} /> : <div className="nembed-empty">Paste embed / HTML</div>;
    case "quote":
      return <blockquote className="nquote"><p>{str("text")}</p>{str("cite") && <cite>{str("cite")}</cite>}</blockquote>;
    case "list": {
      const items = Array.isArray(d.items) ? (d.items as unknown[]).map(String) : [];
      const ListTag = (d.ordered ? "ol" : "ul") as "ol" | "ul";
      return <ListTag className="nlist">{items.map((it, i) => <li key={i}>{it}</li>)}</ListTag>;
    }
    case "socials": {
      const links = Array.isArray(d.links) ? (d.links as { network?: string; url?: string }[]) : [];
      return <div className="nsocials">{links.filter((l) => l.url).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="nsocial">{socialGlyph(l.network)}</a>)}</div>;
    }
    default:
      return null;
  }
}

const SOCIAL_GLYPH: Record<string, string> = { instagram: "◎", facebook: "f", x: "𝕏", twitter: "𝕏", tiktok: "♪", youtube: "▶", pinterest: "P", spotify: "♫", website: "🔗", email: "✉" };
function socialGlyph(network?: string): string {
  return (network && SOCIAL_GLYPH[network.toLowerCase()]) || "🔗";
}

function videoEmbed(url: string): { type: "iframe" | "video"; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { type: "iframe", src: `https://player.vimeo.com/video/${vim[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "video", src: url };
  return { type: "iframe", src: url };
}

/* ---- style → CSS helpers ---- */
function sidesStr(s?: Sides): string | undefined {
  if (!s) return undefined;
  const n = (x?: number) => `${x ?? 0}px`;
  return `${n(s.t)} ${n(s.r)} ${n(s.b)} ${n(s.l)}`;
}
function fontVar(f?: NodeStyle["fontFamily"]): string | undefined {
  if (!f) return undefined;
  return f === "display" ? "var(--font-display),serif" : f === "script" ? "var(--font-script),cursive" : "var(--font-sans),sans-serif";
}
// Device-varying properties are emitted as CSS custom properties so a media
// query (in invite-styles) can swap the mobile value — inline styles alone
// can't be overridden by a stylesheet. Section padding and widget font-size use
// distinct var names so they don't collide as they cascade down the tree.
function secVars(st?: NodeStyle): React.CSSProperties {
  if (!st) return {};
  const v: Record<string, string> = {};
  const pad = sidesStr(st.padding); if (pad) v["--sec-pad"] = pad;
  const padM = sidesStr(st.paddingMobile); if (padM) v["--sec-padm"] = padM;
  return v as React.CSSProperties;
}
function widgetVars(st?: NodeStyle): React.CSSProperties {
  if (!st) return {};
  const v: Record<string, string> = {};
  if (st.fontSize) v["--w-fs"] = `${st.fontSize}px`;
  if (st.fontSizeMobile) v["--w-fsm"] = `${st.fontSizeMobile}px`;
  return v as React.CSSProperties;
}
function widgetCss(st?: NodeStyle): React.CSSProperties {
  if (!st) return {};
  const css: React.CSSProperties = {};
  if (st.align) css.textAlign = st.align;
  if (st.padding) css.padding = sidesStr(st.padding);
  if (st.margin) css.margin = sidesStr(st.margin);
  if (st.color) css.color = st.color;
  if (st.fontFamily) css.fontFamily = fontVar(st.fontFamily);
  if (st.fontWeight) css.fontWeight = st.fontWeight;
  if (st.lineHeight) css.lineHeight = st.lineHeight;
  if (st.letterSpacing) css.letterSpacing = `${st.letterSpacing}px`;
  if (st.bgColor) css.background = st.bgColor;
  if (st.radius) css.borderRadius = `${st.radius}px`;
  if (st.borderWidth) css.border = `${st.borderWidth}px solid ${st.borderColor || "currentColor"}`;
  if (st.shadow) css.boxShadow = "0 18px 40px -22px rgba(0,0,0,.7)";
  return css;
}
function hideClass(st?: NodeStyle): string {
  return `${st?.hideMobile ? "node-hide-m" : ""} ${st?.hideDesktop ? "node-hide-d" : ""}`.trim();
}
function animClass(st?: NodeStyle, mode?: Mode): string {
  if (mode !== "live" || !st?.animation || st.animation === "none") return "";
  return st.animation === "rise" ? "rise" : `n-${st.animation}`;
}

type NavItem = { key: string; label: string; href: string; current: boolean };
function SiteNav({ brand, items, live }: { brand?: string; items: NavItem[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`site-nav ${open ? "open" : ""}`}>
      {brand && <a className="site-nav-brand" href={live ? "/" : undefined}>{brand}</a>}
      {items.length > 0 && <button type="button" className="site-nav-toggle" aria-label="Menu" onClick={() => setOpen((v) => !v)}>☰</button>}
      <div className="site-nav-links">
        {items.map((it) => (
          <a key={it.key} href={live ? it.href : undefined} className={it.current ? "current" : ""} onClick={() => setOpen(false)}>{it.label}</a>
        ))}
      </div>
    </nav>
  );
}

// rise helper: reveal-on-scroll only in the live invite; always-visible in the builder
const rk = (mode: Mode, base: string, delay?: string) => (mode === "live" ? `${base} rise${delay ? " " + delay : ""}` : base);

function SectionView({ s, mode, token, guest, slug }: { s: Section; mode: Mode; token?: string; guest?: InviteGuest; slug?: string }) {
  switch (s.type) {
    case "hero":
      return (
        <section className="hero">
          <div className="inner">
            <img className={rk(mode, "garland")} src={s.garland} alt="" />
            <div className={rk(mode, "label", "d1")}>{s.label}</div>
            <h1 className={rk(mode, "hero-names", "d1")}>{s.name1}<span className="amp">&amp;</span>{s.name2}</h1>
            <div className={rk(mode, "rule", "d2")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "hero-date", "d2")}>{s.date}</div>
            <div className={rk(mode, "hero-venue", "d2")}>{s.venue}</div>
          </div>
          <div className="scroll-cue">Explore<span>↓</span></div>
        </section>
      );
    case "story":
      return (
        <section className="sep-top">
          <div className="lights-strip" />
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "beats", "d2")}>
              {s.beats.map((b, i) => (
                <div key={i} className="beat"><span className="n">{b.numeral}</span><div><h4>{b.title}</h4><p>{b.text}</p></div></div>
              ))}
            </div>
          </div>
        </section>
      );
    case "photoBand":
      return (
        <section className="photo-band" style={{ backgroundImage: `url('${s.image}')` }}>
          <div className="pb-inner">
            <div className={rk(mode, "pb-script")}>{s.script}</div>
            <div className={rk(mode, "pb-sub", "d1")}>{s.sub}</div>
          </div>
        </section>
      );
    case "details":
      return (
        <section className="sep-top">
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "lead", "d1")}>{s.lead}</div>
            <div className="dcards">
              {s.cards.map((c, i) => (
                <div key={i} className={rk(mode, "dcard", i === 0 ? "d1" : "d2")}>
                  <div className="k">{c.kind}</div>
                  <h3>{c.title}</h3>
                  <p>{c.lines.split("\n").map((ln, k) => (<span key={k}>{k > 0 && <br />}{ln}</span>))}</p>
                  {c.time && <div className="time">{c.time}</div>}
                  {c.linkLabel && c.linkHref && <div><a href={c.linkHref} target="_blank" rel="noopener">{c.linkLabel}</a></div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "countdown":
      return (
        <section className="sep-top">
          <div className="lights-strip" />
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "cd", "d1")}>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-d" : undefined}>{mode === "live" ? "--" : "120"}</div><div className="cd-l">Days</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-h" : undefined}>{mode === "live" ? "--" : "08"}</div><div className="cd-l">Hours</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-m" : undefined}>{mode === "live" ? "--" : "30"}</div><div className="cd-l">Minutes</div></div>
              <div className="cd-box"><div className="cd-n" id={mode === "live" ? "cd-s" : undefined}>{mode === "live" ? "--" : "00"}</div><div className="cd-l">Seconds</div></div>
            </div>
            <div className={rk(mode, "rule", "d2")} style={{ marginTop: 46 }}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "label", "d2")}>{s.dressLabel}</div>
            <div className={rk(mode, "", "d2")} style={{ marginTop: 12 }}><span className="chip">{s.dressChip}</span></div>
            <div className={rk(mode, "lead", "d2")} style={{ marginTop: 16, fontSize: "1.14rem" }}>{s.dressText}</div>
          </div>
        </section>
      );
    case "rsvp":
      return (
        <section className="sep-top" style={{ background: `linear-gradient(rgba(9,6,3,.66),rgba(9,6,3,.82)), url('${s.bgImage}') center/cover` }}>
          <div className="wrap">
            <div className={rk(mode, "label")}>{s.label}</div>
            <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
            <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
            <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>
            {mode !== "live" ? <RsvpPreview /> : token && guest ? <RsvpForm token={token} guest={guest} /> : slug ? <SiteRsvpLookup slug={slug} /> : <RsvpPreview />}
          </div>
        </section>
      );
    case "footer":
      return (
        <footer className="foot">
          <img className={rk(mode, "bouquet")} src={s.bouquet} alt="" />
          <div className={rk(mode, "fn", "d1")}>{s.name1} <span className="amp">&amp;</span> {s.name2}</div>
          <div className={rk(mode, "fd", "d1")}>{s.dateLine}</div>
        </footer>
      );
    case "schedule":
      return (
        <section className="sep-top"><div className="wrap">
          <div className={rk(mode, "label")}>{s.label}</div>
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "timeline", "d2")}>
            {s.events.map((e, i) => (
              <div key={i} className="tl-item"><div className="tl-time">{e.time}</div><div className="tl-body"><h4>{e.title}</h4>{e.location && <p className="tl-loc">{e.location}</p>}{e.desc && <p>{e.desc}</p>}</div></div>
            ))}
          </div>
        </div></section>
      );
    case "faq":
      return (
        <section className="sep-top"><div className="wrap">
          <div className={rk(mode, "label")}>{s.label}</div>
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "faq", "d2")}>
            {s.items.map((it, i) => (<details key={i} className="faq-item"><summary>{it.q}</summary><p>{it.a}</p></details>))}
          </div>
        </div></section>
      );
    case "gallery":
      return (
        <section className="sep-top"><div className="wrap">
          <div className={rk(mode, "label")}>{s.label}</div>
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "gallery-grid", "d2")} data-gallery={s.id}>
            {s.images.map((img, i) => (<div key={i} className="gal-item" role="button" tabIndex={0} data-full={img} style={{ backgroundImage: `url('${img}')` }} />))}
          </div>
        </div></section>
      );
    case "party":
      return (
        <section className="sep-top"><div className="wrap">
          <div className={rk(mode, "label")}>{s.label}</div>
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "party-grid", "d2")}>
            {s.members.map((m, i) => (
              <div key={i} className="party-member">{m.photo && <div className="pm-photo" style={{ backgroundImage: `url('${m.photo}')` }} />}<h4>{m.name}</h4><p>{m.role}</p></div>
            ))}
          </div>
        </div></section>
      );
    case "gifts":
      return (
        <section className="sep-top"><div className="wrap">
          <div className={rk(mode, "label")}>{s.label}</div>
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "lead", "d1")}>{s.message}</div>
          {s.links.length > 0 && (
            <div className={rk(mode, "", "d2")} style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {s.links.map((l, i) => (<a key={i} href={l.url} target="_blank" rel="noopener" className="chip" style={{ textDecoration: "none" }}>{l.label}</a>))}
            </div>
          )}
        </div></section>
      );
    case "richText":
      return (
        <section className="sep-top"><div className="wrap">
          {s.label && <div className={rk(mode, "label")}>{s.label}</div>}
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          <div className={rk(mode, "lead", "d1")}>{s.body.split("\n").map((p, i) => (<span key={i}>{i > 0 && <br />}{p}</span>))}</div>
        </div></section>
      );
    case "camera":
      return (
        <section className="sep-top"><div className="wrap">
          {s.label && <div className={rk(mode, "label")}>{s.label}</div>}
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          {s.lead && <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>}
          {mode === "live" && slug ? <div className={rk(mode, "", "d2")}><CameraBlock slug={slug} shots={s.shots ?? 24} /></div> : <AppPreview kind="camera" />}
        </div></section>
      );
    case "scavenger":
      return (
        <section className="sep-top"><div className="wrap">
          {s.label && <div className={rk(mode, "label")}>{s.label}</div>}
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          {s.lead && <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>}
          {mode === "live" && slug ? <div className={rk(mode, "", "d2")}><ScavengerBlock slug={slug} prompts={s.prompts} /></div> : <AppPreview kind="scavenger" prompts={s.prompts} />}
        </div></section>
      );
    case "guestbook":
      return (
        <section className="sep-top"><div className="wrap">
          {s.label && <div className={rk(mode, "label")}>{s.label}</div>}
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          {s.lead && <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>}
          {mode === "live" && slug ? <div className={rk(mode, "", "d2")}><GuestbookBlock slug={slug} /></div> : <AppPreview kind="guestbook" />}
        </div></section>
      );
    case "songs":
      return (
        <section className="sep-top"><div className="wrap">
          {s.label && <div className={rk(mode, "label")}>{s.label}</div>}
          <h2 className={rk(mode, "h-sec", "d1")}>{s.heading}</h2>
          <div className={rk(mode, "rule", "d1")}><span className="l" /><span className="d" /><span className="l r" /></div>
          {s.lead && <div className={rk(mode, "lead", "d1")} style={{ fontSize: "1.14rem" }}>{s.lead}</div>}
          {mode === "live" && slug ? <div className={rk(mode, "", "d2")}><SongsBlock slug={slug} /></div> : <AppPreview kind="songs" />}
        </div></section>
      );
  }
}

// Static stand-in for the interactive wedding-day blocks, shown in the builder
// preview (where there's no slug / live data).
function AppPreview({ kind, prompts }: { kind: "camera" | "scavenger" | "guestbook" | "songs"; prompts?: string[] }) {
  if (kind === "camera") return (
    <div className="wd-camera">
      <div className="wd-cam-controls"><div className="wd-film"><span className="wd-film-count">24</span><span className="wd-film-label">shots left</span></div><div className="wd-input wd-ph" /><button type="button" className="wd-shutter">📷 Take a photo</button></div>
      <p className="wd-empty">Guests’ photos appear here on the day.</p>
    </div>
  );
  if (kind === "scavenger") return (
    <div className="wd-hunt">
      <p className="wd-hunt-progress">0 of {prompts?.length ?? 0} captured</p>
      <div className="wd-hunt-list">
        {(prompts ?? ["A candid of the couple", "Someone on the dance floor"]).slice(0, 4).map((p, i) => (
          <div key={i} className="wd-hunt-item"><div className="wd-hunt-head"><span className="wd-hunt-check">{i + 1}</span><span className="wd-hunt-text">{p}</span><button type="button" className="wd-hunt-btn">📷</button></div></div>
        ))}
      </div>
    </div>
  );
  if (kind === "guestbook") return (
    <div className="wd-guestbook"><div className="wd-gb-form"><div className="wd-input wd-ph" /><div className="wd-input wd-ph" style={{ height: 64 }} /><button type="button" className="wd-shutter">Sign the guestbook</button></div></div>
  );
  return (
    <div className="wd-songs"><div className="wd-song-form"><div className="wd-input wd-ph" /><div className="wd-input wd-ph" /><button type="button" className="wd-shutter">🎵 Request this song</button></div></div>
  );
}

// Non-functional replica of the RSVP form for the builder preview.
function RsvpPreview() {
  return (
    <form className="rform" onSubmit={(e) => e.preventDefault()}>
      <div className="field"><label>Your Name</label><input type="text" placeholder="First & last name" readOnly /></div>
      <div className="field"><label>Will you be attending?</label>
        <div className="rr">
          <label><input type="radio" name="p" readOnly /><span>Joyfully accepts</span></label>
          <label><input type="radio" name="p" readOnly /><span>Regretfully declines</span></label>
        </div>
      </div>
      <div className="field"><label>Dietary notes</label><textarea placeholder="Allergies, preferences, anything we should know" readOnly /></div>
      <button type="button">Send our reply</button>
    </form>
  );
}
