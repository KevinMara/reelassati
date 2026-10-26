import { describe, expect, it } from "vitest";
import {
  creditReceiptTotal,
  mergeCreditReceipt,
  readCreditReceipt,
} from "./credit-receipt";
import { normalizeEditorChatState } from "./editor-chat-state";

describe("request credit receipts", () => {
  it("counts settlement once and never counts a reservation or release", () => {
    const pending = { id: "one", credits: 0, status: "reserved" as const };
    const settled = { id: "one", credits: 7, status: "settled" as const };
    const receipts = mergeCreditReceipt(
      mergeCreditReceipt([pending], settled),
      settled
    );
    expect(
      creditReceiptTotal([
        ...receipts,
        { id: "other", credits: 99, status: "released" },
      ])
    ).toBe(7);
    expect(receipts).toHaveLength(1);
  });
  it("rejects quotes and malformed values", () => {
    expect(readCreditReceipt({ credits: 5 })).toBeUndefined();
    expect(
      readCreditReceipt({ id: "one", credits: -1, status: "settled" })
    ).toBeUndefined();
    expect(
      readCreditReceipt({ id: "one", credits: 25, status: "reserved" })?.credits
    ).toBe(0);
  });
  it("preserves recorded auto-edit results and unconfirmed accounting across reopen", () => {
    const restored = normalizeEditorChatState({
      mode: "auto",
      maxCredits: 200,
      messages: [
        {
          id: "edit",
          role: "assistant",
          text: "Saved",
          createdAt: new Date(0).toISOString(),
          status: "completed",
          usedCredits: 99,
          creditReceiptsComplete: false,
          creditReceipts: [{ id: "receipt", credits: 5, status: "settled" }],
          activity: { kind: "auto-edit", steps: ["Saved the finished edit"] },
        },
      ],
    })!.messages[0];
    expect(restored.creditReceiptsComplete).toBe(false);
    expect(creditReceiptTotal(restored.creditReceipts)).toBe(5);
    expect(restored.activity?.steps).toEqual(["Saved the finished edit"]);
  });
});
