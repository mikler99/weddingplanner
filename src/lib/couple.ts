// The two partners' first names, derived from the wedding name
// ("Michael & Olivia McCann" → ["Michael", "Olivia"]). Same split as the guest
// "side" options in guests.ts, without the "Both" suffix.
export function partnerNames(weddingName: string | null | undefined): string[] {
  return (weddingName ?? "")
    .split(/&|\band\b|\+/)
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 2);
}
