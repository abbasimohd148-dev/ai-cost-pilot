export const usd = (n, digits = 2) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);

export const num = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(n);

export const compact = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n, digits = 1) => (n == null ? "—" : `${Number(n).toFixed(digits)}%`);

export const dt = (s) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const dateOnly = (s) =>
  s ? new Date(s).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";
