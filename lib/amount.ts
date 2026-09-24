import { copy } from "./copy";

export type AmountError = typeof copy.amountInvalid;

export function parseAmountCents(raw: unknown): { ok: true; cents: number } | { ok: false; error: AmountError } {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return { ok: false, error: copy.amountInvalid };
    const text = raw.toString();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: copy.amountInvalid };
    return { ok: true, cents: Math.round(raw * 100) };
  }
  if (typeof raw !== "string") return { ok: false, error: copy.amountInvalid };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: copy.amountInvalid };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, error: copy.amountInvalid };
  const value = Number.parseFloat(trimmed);
  if (!(value > 0)) return { ok: false, error: copy.amountInvalid };
  return { ok: true, cents: Math.round(value * 100) };
}

export function formatHkd(cents: number): string {
  return `HK$${(cents / 100).toFixed(2)}`;
}
