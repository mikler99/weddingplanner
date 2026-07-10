// Element engine for the website builder. A page is a tree of blocks:
//   Section  → holds Columns (a horizontal row)
//   Column   → holds Widgets (a vertical stack), sized by a 1–12 span
//   Widget   → a leaf: a generic element (heading/text/image/button/…) OR a
//              polished wedding block (hero/rsvp/camera/…) that renders through
//              the existing SectionView.
// Legacy pages store a flat Section[]; normalizePage() wraps each into a
// full-width passthrough Section→Column→Widget so nothing has to be migrated
// and the old design renders pixel-identically.

import { type Section, type SectionType, newSection } from "@/lib/invite-config";
import { type SitePage } from "@/lib/site-config";

export type Sides = { t?: number; r?: number; b?: number; l?: number };

// Per-node styling. A few properties carry an explicit *Mobile override so the
// inspector can offer responsive control without a general Responsive<T> map.
export type NodeStyle = {
  align?: "left" | "center" | "right";
  padding?: Sides;
  paddingMobile?: Sides;
  margin?: Sides;
  maxWidth?: number;            // content max width (px) for a section row
  bgColor?: string;
  bgImage?: string;
  overlay?: string;            // e.g. "rgba(9,6,3,.55)" laid over bgImage
  color?: string;             // text colour for generic widgets
  fontFamily?: "display" | "script" | "sans" | "";
  fontSize?: number;          // px (desktop)
  fontSizeMobile?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;     // px
  radius?: number;
  borderColor?: string;
  borderWidth?: number;
  shadow?: boolean;
  animation?: "none" | "fade" | "rise" | "zoom";
  hideDesktop?: boolean;
  hideMobile?: boolean;
};

// Generic elements. Note "gallery" is deliberately NOT here — it already exists
// as a polished wedding SectionType, so it lives under the wedding blocks.
export type GenericWidget =
  | "heading" | "text" | "image" | "button" | "spacer" | "divider"
  | "icon" | "video" | "embed" | "map";
export type WeddingWidget = SectionType; // hero/story/rsvp/camera/gallery/… reuse Section shapes
export type WidgetKind = GenericWidget | WeddingWidget;

export type WidgetNode = { id: string; type: "widget"; widget: WidgetKind; data: Record<string, unknown>; style?: NodeStyle; visible?: boolean };
export type ColumnNode = { id: string; type: "column"; span: number; style?: NodeStyle; children: WidgetNode[] };
export type SectionNode = { id: string; type: "section"; layout: "boxed" | "full"; style?: NodeStyle; visible?: boolean; columns: ColumnNode[] };
export type Block = SectionNode;

export const GENERIC_WIDGETS: GenericWidget[] = ["heading", "text", "image", "button", "video", "icon", "divider", "spacer", "embed", "map"];

export const WIDGET_META: Record<WidgetKind, { label: string; icon: string; generic: boolean }> = {
  // generic elements
  heading: { label: "Heading", icon: "H", generic: true },
  text: { label: "Text", icon: "¶", generic: true },
  image: { label: "Image", icon: "🖼", generic: true },
  button: { label: "Button", icon: "▭", generic: true },
  video: { label: "Video", icon: "▶", generic: true },
  icon: { label: "Icon", icon: "❦", generic: true },
  divider: { label: "Divider", icon: "—", generic: true },
  spacer: { label: "Spacer", icon: "⇕", generic: true },
  embed: { label: "Embed / HTML", icon: "</>", generic: true },
  map: { label: "Map", icon: "📍", generic: true },
  // wedding blocks
  hero: { label: "Hero", icon: "❈", generic: false },
  story: { label: "Our story", icon: "❧", generic: false },
  photoBand: { label: "Photo band", icon: "▬", generic: false },
  details: { label: "Details", icon: "❒", generic: false },
  countdown: { label: "Countdown", icon: "⏱", generic: false },
  rsvp: { label: "RSVP", icon: "✎", generic: false },
  footer: { label: "Footer", icon: "⚘", generic: false },
  schedule: { label: "Schedule", icon: "❯", generic: false },
  faq: { label: "FAQ", icon: "?", generic: false },
  gallery: { label: "Gallery", icon: "▦", generic: false },
  party: { label: "Wedding party", icon: "♥", generic: false },
  gifts: { label: "Gifts", icon: "❦", generic: false },
  richText: { label: "Text block", icon: "¶", generic: false },
  camera: { label: "Disposable camera", icon: "📷", generic: false },
  guestbook: { label: "Guestbook", icon: "✍", generic: false },
  songs: { label: "Song requests", icon: "♫", generic: false },
};

let _seq = 0;
export function nid(prefix: string, seed: number): string {
  return `${prefix}-${seed}-${_seq++}`;
}

export function defaultWidgetData(kind: WidgetKind, seed: number): Record<string, unknown> {
  switch (kind) {
    case "heading": return { text: "Your heading", level: 2 };
    case "text": return { body: "Write something lovely here — a note to your guests, a favourite quote, anything at all." };
    case "image": return { src: "/invite/6.jpg", alt: "", href: "", rounded: true };
    case "button": return { label: "Learn more", href: "#", variant: "solid" };
    case "video": return { url: "" };
    case "icon": return { glyph: "❦", size: 40 };
    case "divider": return { variantOrnament: true };
    case "spacer": return { height: 48 };
    case "embed": return { html: "" };
    case "map": return { query: "", height: 320 };
    default: {
      // Wedding widget: borrow the Section defaults, drop the wrapper fields.
      const s = newSection(kind as SectionType, seed);
      const { id: _i, type: _t, visible: _v, ...rest } = s as Record<string, unknown> & { id: string; type: string; visible: boolean };
      void _i; void _t; void _v;
      return rest;
    }
  }
}

export function newWidget(kind: WidgetKind, seed: number): WidgetNode {
  return { id: nid("w", seed), type: "widget", widget: kind, data: defaultWidgetData(kind, seed), visible: true };
}
export function newColumn(seed: number, span = 12, children: WidgetNode[] = []): ColumnNode {
  return { id: nid("col", seed), type: "column", span, children };
}
export function newSectionNode(seed: number, columns?: ColumnNode[], layout: "boxed" | "full" = "boxed"): SectionNode {
  return { id: nid("sec", seed), type: "section", layout, visible: true, columns: columns ?? [newColumn(seed)] };
}
// A section pre-split into N equal columns.
export function newSectionWithColumns(seed: number, count: number): SectionNode {
  const span = Math.max(1, Math.round(12 / count));
  const cols = Array.from({ length: count }, () => newColumn(seed, span, [newWidget("text", seed)]));
  return newSectionNode(seed, cols, "boxed");
}

// A wedding block sits alone in a full-width, chrome-less section so it renders
// exactly as it did before the engine existed (passthrough — see isPassthrough).
export function weddingBlockSection(kind: WeddingWidget, seed: number): SectionNode {
  const w = newWidget(kind, seed);
  return { id: nid("sec", seed), type: "section", layout: "full", visible: true, columns: [newColumn(seed, 12, [w])] };
}

// True when a section is just a single wedding widget with no custom styling —
// render the widget directly (no generic section chrome), preserving the
// original look byte-for-byte.
export function isPassthrough(sec: SectionNode): WidgetNode | null {
  if (sec.layout !== "full") return null;
  if (hasStyle(sec.style)) return null;
  if (sec.columns.length !== 1) return null;
  const col = sec.columns[0];
  if (col.span !== 12 || hasStyle(col.style)) return null;
  if (col.children.length !== 1) return null;
  const w = col.children[0];
  if (WIDGET_META[w.widget]?.generic) return null;
  if (hasStyle(w.style)) return null;
  return w;
}

export function hasStyle(s?: NodeStyle): boolean {
  if (!s) return false;
  return Object.values(s).some((v) => v !== undefined && v !== null && v !== "" && !(typeof v === "object" && Object.keys(v as object).length === 0));
}

// Rebuild the Section object a wedding widget expects, from a widget node.
export function widgetToSection(w: WidgetNode): Section {
  return { id: w.id, type: w.widget as SectionType, visible: true, ...(w.data as object) } as Section;
}

function sectionToNode(s: Section): SectionNode {
  const { id, type, visible, ...data } = s as Record<string, unknown> & { id: string; type: SectionType; visible: boolean };
  const w: WidgetNode = { id: `${id}-w`, type: "widget", widget: type, data, visible: true };
  const col: ColumnNode = { id: `${id}-c`, type: "column", span: 12, children: [w] };
  return { id, type: "section", layout: "full", visible, columns: [col] };
}

// The one place that turns a stored page into a block tree. Prefers the new
// `blocks` field; falls back to wrapping the legacy flat `sections`.
export function normalizePage(page: SitePage): SectionNode[] {
  const blocks = page.blocks as SectionNode[] | undefined;
  if (Array.isArray(blocks) && blocks.length) return blocks;
  return (page.sections ?? []).map(sectionToNode);
}

// Find the first widget of a kind anywhere in a block tree (for hero bg /
// countdown motion wiring).
export function findWidget(blocks: SectionNode[], kind: WidgetKind): WidgetNode | undefined {
  for (const sec of blocks) for (const col of sec.columns) for (const w of col.children) if (w.widget === kind) return w;
  return undefined;
}
