// Pure vendor types + constants — safe to import from client components.

export const VENDOR_STATUSES = ["Considering", "Booked", "Passed"] as const;

export type Vendor = {
  id: string;
  wedding_id: string;
  name: string | null;
  category: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  next_step: string | null;
  status: string;
  sort: number;
};

export type VendorCard = Vendor & {
  categories: string[]; // categories their options touch
  optionCount: number; // options in the pool
  inPlanCount: number; // options selected in the active plan
  planCost: number; // their derived cost in the active plan
  docCount: number;
  scenarioNames: string[]; // scenarios that use them
};
