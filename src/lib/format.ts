const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
});

const CAD0 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export const money = (n: number) => CAD.format(n);
export const money0 = (n: number) => CAD0.format(n);
