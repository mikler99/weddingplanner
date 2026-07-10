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
export type ScheduleEvent = { time: string; title: string; desc: string; location: string };
export type FaqItem = { q: string; a: string };
export type PartyMember = { name: string; role: string; photo: string };
export type GiftLink = { label: string; url: string };

export type SectionType =
  | "hero" | "story" | "photoBand" | "details" | "countdown" | "rsvp" | "footer"
  | "schedule" | "faq" | "gallery" | "party" | "gifts" | "richText"
  | "camera" | "guestbook" | "songs";

export type Section =
  | { id: string; type: "hero"; visible: boolean; garland: string; label: string; name1: string; name2: string; date: string; venue: string; bgImage: string }
  | { id: string; type: "story"; visible: boolean; label: string; heading: string; beats: Beat[] }
  | { id: string; type: "photoBand"; visible: boolean; image: string; script: string; sub: string }
  | { id: string; type: "details"; visible: boolean; label: string; heading: string; lead: string; cards: DetailCard[] }
  | { id: string; type: "countdown"; visible: boolean; label: string; heading: string; targetIso: string; dressLabel: string; dressChip: string; dressText: string }
  | { id: string; type: "rsvp"; visible: boolean; label: string; heading: string; lead: string; deadline: string; bgImage: string }
  | { id: string; type: "footer"; visible: boolean; name1: string; name2: string; dateLine: string; bouquet: string }
  | { id: string; type: "schedule"; visible: boolean; label: string; heading: string; events: ScheduleEvent[] }
  | { id: string; type: "faq"; visible: boolean; label: string; heading: string; items: FaqItem[] }
  | { id: string; type: "gallery"; visible: boolean; label: string; heading: string; images: string[] }
  | { id: string; type: "party"; visible: boolean; label: string; heading: string; members: PartyMember[] }
  | { id: string; type: "gifts"; visible: boolean; label: string; heading: string; message: string; links: GiftLink[] }
  | { id: string; type: "richText"; visible: boolean; label: string; heading: string; body: string }
  | { id: string; type: "camera"; visible: boolean; label: string; heading: string; lead: string; prompts: string[] }
  | { id: string; type: "guestbook"; visible: boolean; label: string; heading: string; lead: string }
  | { id: string; type: "songs"; visible: boolean; label: string; heading: string; lead: string };

export type InviteConfig = { theme: Theme; sections: Section[] };

export const SECTION_META: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: "Hero", hint: "Names, date, and cover photo" },
  story: { label: "Our story", hint: "How you met, in a few beats" },
  photoBand: { label: "Photo band", hint: "A full-width photo with a caption" },
  details: { label: "Details", hint: "Ceremony & reception cards" },
  countdown: { label: "Countdown", hint: "Live countdown + dress code" },
  rsvp: { label: "RSVP", hint: "The reply form (guests fill this in)" },
  footer: { label: "Footer", hint: "Closing flourish" },
  schedule: { label: "Schedule", hint: "Timeline of events" },
  faq: { label: "FAQ", hint: "Questions & answers" },
  gallery: { label: "Gallery", hint: "A grid of photos" },
  party: { label: "Wedding party", hint: "The lineup" },
  gifts: { label: "Gifts", hint: "A note on gifts / contributions" },
  richText: { label: "Text block", hint: "A heading + paragraph" },
  camera: { label: "Disposable camera", hint: "Guests snap & share photos live" },
  guestbook: { label: "Guestbook", hint: "Well-wishes from your guests" },
  songs: { label: "Song requests", hint: "Guests suggest songs for the DJ" },
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

// Savable starter themes (the couple can apply one, tweak it, or save their own).
export const THEME_PRESETS: { id: string; name: string; theme: Theme }[] = [
  { id: "golden", name: "Golden Hour", theme: DEFAULT_THEME },
  { id: "rose", name: "Rosé", theme: { ...DEFAULT_THEME, gold: "#c98a8a", gold2: "#e2b6b6", inkSoft: "#d8c6c2" } },
  { id: "garden", name: "Garden", theme: { ...DEFAULT_THEME, gold: "#93ac82", gold2: "#bccdae", inkSoft: "#cbccb9" } },
  { id: "moonlight", name: "Moonlight", theme: { ...DEFAULT_THEME, ink: "#e8ecf3", inkSoft: "#b7c1d1", gold: "#9fb0c9", gold2: "#c8d3e6", bg: "#0a0d13", panel: "rgba(14,18,26,.58)" } },
  { id: "ivory", name: "Ivory & Gold", theme: { ...DEFAULT_THEME, fontDisplay: "Playfair Display", fontScript: "Great Vibes" } },
];

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
    case "schedule": return { id, type, visible: true, label: "The Day", heading: "Schedule", events: [{ time: "Half past three", title: "Ceremony", desc: "", location: "" }, { time: "Five o'clock", title: "Cocktails & canapés", desc: "", location: "" }, { time: "Six thirty", title: "Dinner & dancing", desc: "", location: "" }] };
    case "faq": return { id, type, visible: true, label: "Good to know", heading: "FAQ", items: [{ q: "Can I bring a guest?", a: "Your invitation notes how many seats you have — please check the RSVP." }, { q: "What should I wear?", a: "See the dress code on the home page." }] };
    case "gallery": return { id, type, visible: true, label: "Us", heading: "Gallery", images: ["/invite/6.jpg"] };
    case "party": return { id, type, visible: true, label: "By our side", heading: "Wedding Party", members: [{ name: "Name", role: "Maid of Honour", photo: "" }, { name: "Name", role: "Best Man", photo: "" }] };
    case "gifts": return { id, type, visible: true, label: "Your presence", heading: "Gifts", message: "Your company is the only gift we need. If you’d still like to help us celebrate, a card table will be set up at the reception.", links: [] };
    case "richText": return { id, type, visible: true, label: "", heading: "A heading", body: "Write anything you like here." };
    case "camera": return { id, type, visible: true, label: "Say cheese", heading: "Disposable Camera", lead: "Be our photographer for the day. Snap a moment, add your name, and it lands in our shared gallery for everyone to see.", prompts: ["A candid of the couple", "Your table, all together", "Someone on the dance floor", "The happiest face you can find", "A detail you love about today", "A selfie with someone you just met"] };
    case "guestbook": return { id, type, visible: true, label: "Leave your mark", heading: "Guestbook", lead: "Share a wish, a memory, or a little advice for the newlyweds." };
    case "songs": return { id, type, visible: true, label: "Fill the floor", heading: "Song Requests", lead: "What will get you dancing? Send it to the DJ." };
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
