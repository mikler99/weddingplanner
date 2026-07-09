// Defaults provisioned when a wedding is created, so a brand-new wedding has the
// same shape the app assumes (categories, a starter checklist, a tax default).

export const DEFAULT_CATEGORIES: { name: string; slug: string; color: string; sort: number }[] = [
  { name: "Venue", slug: "venue", color: "#4F52C4", sort: 0 },
  { name: "Ceremony venue", slug: "ceremony-venue", color: "#D6567F", sort: 1 },
  { name: "Catering", slug: "catering", color: "#E08A2B", sort: 2 },
  { name: "Bar", slug: "bar", color: "#1E9E96", sort: 3 },
  { name: "Florals", slug: "florals", color: "#4C9A52", sort: 4 },
  { name: "Photography", slug: "photography", color: "#8A5CD1", sort: 5 },
  { name: "Attire", slug: "attire", color: "#D45AA8", sort: 6 },
  { name: "Music", slug: "music", color: "#3E86D4", sort: 7 },
  { name: "Other", slug: "other", color: "#7A8290", sort: 90 },
];

// A generic wedding checklist (not tied to any one venue). when_label groups them.
export const STARTER_TASKS: { when_label: string; task: string; sort: number }[] = [
  { when_label: "12+ months out", task: "Set your budget and rough guest count", sort: 0 },
  { when_label: "12+ months out", task: "Tour & book your ceremony and reception venue", sort: 1 },
  { when_label: "12+ months out", task: "Start a shortlist of vendors (catering, photo, music)", sort: 2 },
  { when_label: "9 months out", task: "Book your photographer", sort: 3 },
  { when_label: "9 months out", task: "Book your caterer and plan the menu", sort: 4 },
  { when_label: "9 months out", task: "Send save-the-dates", sort: 5 },
  { when_label: "6 months out", task: "Shop for attire and book alterations", sort: 6 },
  { when_label: "6 months out", task: "Book florals, music/DJ, and any rentals", sort: 7 },
  { when_label: "3 months out", task: "Send invitations and open RSVPs", sort: 8 },
  { when_label: "3 months out", task: "Confirm the day-of timeline with vendors", sort: 9 },
  { when_label: "1 month out", task: "Give the venue/caterer your final guest count", sort: 10 },
  { when_label: "1 month out", task: "Make final payments and confirm every vendor", sort: 11 },
  { when_label: "Week of", task: "Pack, delegate day-of tasks, and breathe", sort: 12 },
];

// Region → sensible tax default (editable later). Currency threading is a
// separate follow-up; tax is what the budget uses today.
export const REGIONS: { key: string; label: string; tax: number }[] = [
  { key: "ON", label: "Ontario, Canada", tax: 0.13 },
  { key: "CA", label: "Canada (other province)", tax: 0.05 },
  { key: "US", label: "United States", tax: 0 },
  { key: "UK", label: "United Kingdom", tax: 0.2 },
  { key: "AU", label: "Australia", tax: 0.1 },
  { key: "OTHER", label: "Somewhere else", tax: 0 },
];

export const taxForRegion = (key: string) => REGIONS.find((r) => r.key === key)?.tax ?? 0;
