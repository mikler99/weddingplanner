// Payment due-date derivation. Contracts express timing relative to the wedding
// ("12 months prior", "with signed contract"); we store that rule and resolve
// the actual date from the event date here — pure, usable on server or client.

export type DueRule = {
  kind: "on_booking" | "before_event" | "absolute" | "unknown";
  value: number | null;
  unit: "days" | "weeks" | "months" | "years" | null;
  date: string | null; // ISO, for kind === "absolute"
};

export type ResolvedDue = { date: string | null; label: string; sort: string };

const fmt = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
};

// An explicit `dueDate` column always wins (a manually set / stated calendar
// date). Otherwise resolve the rule against the wedding's event date.
export function resolveDue(rule: DueRule | null, dueDate: string | null, eventDate: string): ResolvedDue {
  if (dueDate) return { date: dueDate, label: fmt(dueDate), sort: dueDate };
  if (!rule) return { date: null, label: "Unscheduled", sort: "9998" };

  switch (rule.kind) {
    case "on_booking":
      return { date: null, label: "At signing", sort: "0000" };
    case "absolute":
      return rule.date ? { date: rule.date, label: fmt(rule.date), sort: rule.date } : unscheduled();
    case "before_event": {
      if (rule.value == null || !rule.unit) return unscheduled();
      const d = new Date(eventDate + "T00:00:00");
      if (rule.unit === "days") d.setDate(d.getDate() - rule.value);
      else if (rule.unit === "weeks") d.setDate(d.getDate() - rule.value * 7);
      else if (rule.unit === "months") d.setMonth(d.getMonth() - rule.value);
      else if (rule.unit === "years") d.setFullYear(d.getFullYear() - rule.value);
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, label: fmt(iso), sort: iso };
    }
    default:
      return unscheduled();
  }
}

const unscheduled = (): ResolvedDue => ({ date: null, label: "Unscheduled", sort: "9998" });
