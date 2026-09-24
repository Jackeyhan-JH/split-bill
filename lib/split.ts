/** Equal split with remainder to payer if among sharees, else earliest sharee by join order. */
export function computeShareCents(
  amountCents: number,
  shareeIdsInJoinOrder: number[],
  payerId: number,
): Map<number, number> {
  const n = shareeIdsInJoinOrder.length;
  if (n === 0) return new Map();
  const base = Math.floor(amountCents / n);
  const remainder = amountCents - base * n;
  const shares = new Map<number, number>();
  for (const id of shareeIdsInJoinOrder) {
    shares.set(id, base);
  }
  const recipient = shareeIdsInJoinOrder.includes(payerId) ? payerId : shareeIdsInJoinOrder[0];
  shares.set(recipient, (shares.get(recipient) ?? 0) + remainder);
  return shares;
}
