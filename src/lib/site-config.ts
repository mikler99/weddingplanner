// Multi-page wedding-site model. Wraps the existing single-page invite config
// (theme + flat sections) into pages. Stored in weddings.invite_config (jsonb).
// normalizeSite() upgrades the old {theme, sections} shape at read-time, so the
// couple's existing design keeps working as the "Home" page with no migration.

import { type Section, type Theme, DEFAULT_THEME, DEFAULT_INVITE } from "@/lib/invite-config";

export type SitePage = { id: string; slug: string; title: string; showInNav: boolean; sections: Section[] };
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
