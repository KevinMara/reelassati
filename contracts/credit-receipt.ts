/** A receipt is returned from an owned ledger entry, never inferred from a quote. */
export interface CreditReceipt {
  id: string;
  credits: number;
  status: "reserved" | "settled" | "released";
}

export function readCreditReceipt(value: unknown): CreditReceipt | undefined {
  if (!value || typeof value !== "object") return;
  const row = value as Partial<CreditReceipt>;
  if (
    typeof row.id !== "string" ||
    !row.id ||
    row.id.length > 120 ||
    !Number.isSafeInteger(row.credits) ||
    Number(row.credits) < 0 ||
    !["reserved", "settled", "released"].includes(String(row.status))
  )
    return;
  return {
    id: row.id,
    credits: row.status === "settled" ? Number(row.credits) : 0,
    status: row.status!,
  };
}

export function mergeCreditReceipt(
  receipts: CreditReceipt[] = [],
  receipt: CreditReceipt
) {
  return [...receipts.filter(item => item.id !== receipt.id), receipt];
}

export function creditReceiptTotal(receipts: CreditReceipt[] = []) {
  return [
    ...new Map(receipts.map(receipt => [receipt.id, receipt])).values(),
  ].reduce(
    (total, receipt) =>
      total + (receipt.status === "settled" ? receipt.credits : 0),
    0
  );
}
