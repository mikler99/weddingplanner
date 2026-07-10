// Multi-page wedding-site model. Wraps the existing single-page invite config
// (theme + flat sections) into pages. Stored in weddings.invite_config (jsonb).
// normalizeSite() upgrades the old {theme, sections} shape at read-time, so the
// couple's existing design keeps working as the "Home" page with no migration.

import { type Section, type Theme, DEFAULT_THEME, DEFAULT_INVITE, newSection } from "@/lib/invite-config";

// `sections` is the legacy flat list; `blocks` is the element-tree (section →
// column → widget) the new builder writes. When `blocks` is present it wins;
// site-nodes.normalizePage() wraps `sections` into blocks for old pages. The
// type stays structural (not importing site-nodes) to avoid an import cycle.
export type SitePage = { id: string; slug: string; title: string; showInNav: boolean; sections: Section[]; blocks?: unknown[] };
export type NamedTheme = { id: string; name: string; theme: Theme };
export type SiteConfig = { theme: Theme; savedThemes?: NamedTheme[]; pages: SitePage[] };

type RawConfig = { theme?: Partial<Theme>; sections?: Section[]; pages?: SitePage[]; savedThemes?: NamedTheme[] } | null | undefined;

export function normalizeSite(raw: unknown): SiteConfig {
  const c = raw as RawConfig;
  const theme: Theme = { ...DEFAULT_THEME, ...(c?.theme ?? {}) };
  const savedThemes = c?.savedThemes;

  // Already multi-page.
  if (c && Array.isArray(c.pages) && c.pages.length) {
    return { theme, savedThemes, pages: c.pages };
  }
  // Old single-page shape (or null) → one Home page holding all sections.
  const sections = c && Array.isArray(c.sections) && c.sections.length ? c.sections : DEFAULT_INVITE.sections;
  return { theme, savedThemes, pages: [{ id: "home", slug: "home", title: "Home", showInNav: true, sections }] };
}

export function pageBySlug(site: SiteConfig, slug?: string): SitePage {
  return site.pages.find((p) => p.slug === (slug || "home")) ?? site.pages[0];
}

export const DEFAULT_SITE: SiteConfig = normalizeSite(DEFAULT_INVITE);

// ---- Page templates (for the builder's "Add page") --------------------------
export type PageTemplateKey = "home" | "story" | "schedule" | "gifts" | "faq" | "gallery" | "party" | "rsvp" | "weddingday" | "custom";
export const PAGE_TEMPLATES: { key: PageTemplateKey; label: string; hint: string }[] = [
  { key: "story", label: "Our Story", hint: "How you met + a photo" },
  { key: "schedule", label: "Schedule", hint: "Timeline of the day" },
  { key: "gifts", label: "Gifts", hint: "A note on gifts / contributions" },
  { key: "faq", label: "FAQ", hint: "Questions & answers" },
  { key: "gallery", label: "Gallery", hint: "A photo grid" },
  { key: "party", label: "Wedding Party", hint: "The lineup" },
  { key: "rsvp", label: "RSVP", hint: "The reply form" },
  { key: "weddingday", label: "Wedding Day", hint: "Live camera, guestbook & song requests" },
  { key: "custom", label: "Blank page", hint: "Start from a text block" },
  { key: "home", label: "Home", hint: "Hero + countdown" },
];

export function newPage(key: PageTemplateKey, seed: number): SitePage {
  const id = `page-${seed}`;
  const s = (type: Parameters<typeof newSection>[0]) => newSection(type, seed);
  switch (key) {
    case "home": return { id, slug: "home", title: "Home", showInNav: true, sections: [s("hero"), s("countdown")] };
    case "story": return { id, slug: "story", title: "Our Story", showInNav: true, sections: [s("story"), s("photoBand")] };
    case "schedule": return { id, slug: "schedule", title: "Schedule", showInNav: true, sections: [s("schedule"), s("details")] };
    case "gifts": return { id, slug: "gifts", title: "Gifts", showInNav: true, sections: [s("gifts")] };
    case "faq": return { id, slug: "faq", title: "FAQ", showInNav: true, sections: [s("faq")] };
    case "gallery": return { id, slug: "gallery", title: "Gallery", showInNav: true, sections: [s("gallery")] };
    case "party": return { id, slug: "party", title: "Wedding Party", showInNav: true, sections: [s("party")] };
    case "rsvp": return { id, slug: "rsvp", title: "RSVP", showInNav: true, sections: [s("rsvp")] };
    case "weddingday": return { id, slug: "wedding-day", title: "Wedding Day", showInNav: true, sections: [s("camera"), s("scavenger"), s("guestbook"), s("songs")] };
    case "custom": return { id, slug: `page-${seed}`, title: "New page", showInNav: true, sections: [s("richText")] };
  }
}

// Ensure a page slug is unique within a site (append -2, -3, …).
export function uniqueSlug(base: string, existing: string[]): string {
  let slug = base || "page";
  let n = 2;
  while (existing.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}
