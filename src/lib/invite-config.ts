// Data model for the visual invite builder. Pure (client + server safe).
// The public invite and the builder preview both render from an InviteConfig;
// weddings.invite_config stores it (null → DEFAULT_INVITE).

export type Theme = {
  ink: string;
  inkSoft: string;
  inkDim: string;
  gold: string;
  gold2: string;
  panel: string;
  bg: string;
  fontDisplay: string;
  fontScript: string;
  fontSans: string;
};

export type Beat = { numeral: string; title: string; text: string };
export type DetailCard = { kind: string; title: string; lines: string; time: string; linkLabel: string; linkHref: string };

export type SectionType = "hero" | "story" | "photoBand" | "details" | "countdown" | "rsvp" | "footer";

export type Section =
  | { id: string; type: "hero"; visible: boolean; garland: string; label: string; name1: string; name2: string; date: string; venue: string; bgImage: string }
  | { id: string; type: "story"; visible: boolean; label: string; heading: string; beats: Beat[] }
  | { id: string; type: "photoBand"; visible: boolean; image: string; script: string; sub: string }
  | { id: string; type: "details"; visible: boolean; label: string; heading: string; lead: string; cards: DetailCard[] }
  | { id: string; type: "countdown"; visible: boolean; label: string; heading: string; targetIso: string; dressLabel: string; dressChip: string; dressText: string }
  | { id: string; type: "rsvp"; visible: boolean; label: string; heading: string; lead: string; deadline: string; bgImage: string }
  | { id: string; type: "footer"; visible: boolean; name1: string; name2: string; dateLine: string; bouquet: string };

export type InviteConfig = { theme: Theme; sections: Section[] };

export const SECTION_META: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: "Hero", hint: "Names, date, and cover photo" },
  story: { label: "Our story", hint: "How you met, in a few beats" },
  photoBand: { label: "Photo band", hint: "A full-width photo with a caption" },
  details: { label: "Details", hint: "Ceremony & reception cards" },
  countdown: { label: "Countdown", hint: "Live countdown + dress code" },
  rsvp: { label: "RSVP", hint: "The reply form (guests fill this in)" },
  footer: { label: "Footer", hint: "Closing flourish" },
};

// Curated font choices (loaded from Google Fonts by name).
export const FONT_OPTIONS = {
  display: ["Cormorant Garamond", "Playfair Display", "EB Garamond", "Cormorant", "Libre Baskerville"],
  script: ["Pinyon Script", "Great Vibes", "Tangerine", "Parisienne", "Dancing Script"],
  sans: ["Jost", "Montserrat", "Raleway", "Work Sans"],
};

export const DEFAULT_THEME: Theme = {
  ink: "#efe4cf",
  inkSoft: "#c4b79c",
  inkDim: "#9d9079",
  gold: "#c9a86a",
  gold2: "#dcc38d",
  panel: "rgba(16,11,6,.58)",
  bg: "#0e0a06",
  fontDisplay: "Cormorant Garamond",
  fontScript: "Pinyon Script",
  fontSans: "Jost",
};

// The couple's original design, verbatim — so an untouched invite is identical.
export const DEFAULT_INVITE: InviteConfig = {
  theme: DEFAULT_THEME,
  sections: [
    { id: "hero", type: "hero", visible: true, garland: "/invite/5.png", label: "Together with their families", name1: "Michael", name2: "Olivia", date: "September 25, 2027", venue: "Quayle’s Brewery · Oro-Medonte, Ontario", bgImage: "/invite/3.jpg" },
    {
      id: "story", type: "story", visible: true, label: "Our Story", heading: "How it all began",
      beats: [
        { numeral: "i", title: "A chance encounter", text: "One shared laugh in a crowded room, and a conversation neither of us wanted to end." },
        { numeral: "ii", title: "Slow Sundays & long drives", text: "Cold coffee, unhurried mornings, and the quiet certainty of finding home in one another." },
        { numeral: "iii", title: "Yes, a thousand times", text: "Out in the rolling hills we love, one golden afternoon — a question, and a joyful yes." },
      ],
    },
    { id: "photoBand", type: "photoBand", visible: true, image: "/invite/6.jpg", script: "where forever begins", sub: "Coldwater, Ontario · The proposal" },
    {
      id: "details", type: "details", visible: true, label: "You’re Invited", heading: "The Celebration", lead: "Two moments, one unforgettable evening in the Ontario countryside.",
      cards: [
        { kind: "The Ceremony", title: "Hillside Ceremony", lines: "Quayle’s Brewery\n4567 Line 12 N, Coldwater, ON L0K 1E0", time: "Half past three in the afternoon", linkLabel: "Directions", linkHref: "https://maps.google.ca/?q=Quayle's+Brewery,+4567+12+Line+N,+Coldwater,+ON" },
        { kind: "The Reception", title: "The Hop Yard Nursery", lines: "Dinner, dancing & celebration across 87 acres of rolling hills — beneath open skies and string lights.", time: "Until the last song", linkLabel: "The Venue", linkHref: "https://quaylesbrewery.ca/venues/" },
      ],
    },
    { id: "countdown", type: "countdown", visible: true, label: "Counting down", heading: "Until we say “I do”", targetIso: "2027-09-25T15:30:00", dressLabel: "Dress Code", dressChip: "Garden Party & Cocktail", dressText: "Soft florals, flowing linens, and warm earthy tones. We’ll be dressed to celebrate under the lights." },
    { id: "rsvp", type: "rsvp", visible: true, label: "Kindly reply", heading: "RSVP", lead: "We would be honoured to have you. Please respond by August 1st, 2027.", deadline: "August 1st, 2027", bgImage: "/invite/7.jpg" },
    { id: "footer", type: "footer", visible: true, name1: "Michael", name2: "Olivia", dateLine: "September 25, 2027 · Oro-Medonte, Ontario", bouquet: "/invite/8.png" },
  ],
};

// Deterministic id (no Math.random in some runtimes); good enough for section keys.
let _n = 0;
export function newSection(type: SectionType, seed: number): Section {
  const id = `${type}-${seed}-${_n++}`;
  switch (type) {
    case "hero": return { id, type, visible: true, garland: "/invite/5.png", label: "Together with their families", name1: "Name", name2: "Name", date: "Month 00, 0000", venue: "Venue · City", bgImage: "/invite/3.jpg" };
    case "story": return { id, type, visible: true, label: "Our Story", heading: "How it all began", beats: [{ numeral: "i", title: "A beginning", text: "Tell your story here." }] };
    case "photoBand": return { id, type, visible: true, image: "/invite/6.jpg", script: "a caption", sub: "Place · moment" };
    case "details": return { id, type, visible: true, label: "You’re Invited", heading: "The Celebration", lead: "A short introduction.", cards: [{ kind: "The Ceremony", title: "Venue", lines: "Address", time: "Time", linkLabel: "Directions", linkHref: "" }] };
    case "countdown": return { id, type, visible: true, label: "Counting down", heading: "Until we celebrate", targetIso: "2027-09-25T15:30:00", dressLabel: "Dress Code", dressChip: "Cocktail", dressText: "A note on attire." };
    case "rsvp": return { id, type, visible: true, label: "Kindly reply", heading: "RSVP", lead: "Please respond by the date below.", deadline: "", bgImage: "/invite/7.jpg" };
    case "footer": return { id, type, visible: true, name1: "Name", name2: "Name", dateLine: "Month 00, 0000 · City", bouquet: "/invite/8.png" };
  }
}

// Build the Google Fonts href for the chosen families.
export function fontsHref(theme: Theme): string {
  const fam = (name: string, spec: string) => `family=${name.replace(/ /g, "+")}${spec}`;
  const parts = [
    fam(theme.fontDisplay, ":ital,wght@0,400;0,500;0,600;1,400"),
    fam(theme.fontScript, ""),
    fam(theme.fontSans, ":wght@300;400;500"),
  ];
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

// Theme + image values as CSS custom properties for the .invite wrapper.
export function themeVars(theme: Theme): React.CSSProperties {
  return {
    ["--ink" as string]: theme.ink,
    ["--ink-soft" as string]: theme.inkSoft,
    ["--ink-dim" as string]: theme.inkDim,
    ["--gold" as string]: theme.gold,
    ["--gold-2" as string]: theme.gold2,
    ["--panel" as string]: theme.panel,
    ["--font-display" as string]: `'${theme.fontDisplay}'`,
    ["--font-script" as string]: `'${theme.fontScript}'`,
    ["--font-sans" as string]: `'${theme.fontSans}'`,
    background: theme.bg,
  };
}
