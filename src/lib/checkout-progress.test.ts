import { afterEach, expect, it, vi } from "vitest";
import { waitForCheckout } from "./checkout-progress";

afterEach(() => vi.useRealTimers());

it("waits for a locked checkout and returns the recovered link", async () => {
  vi.useFakeTimers();
  const request = vi.fn()
    .mockResolvedValueOnce({ status: "pending", retryAfterMs: 2000 })
    .mockResolvedValueOnce({ checkoutUrl: "https://checkout.stripe.com/example" });
  const result = waitForCheckout(request);
  await vi.advanceTimersByTimeAsync(2000);
  expect(await result).toEqual({ checkoutUrl: "https://checkout.stripe.com/example" });
  expect(request).toHaveBeenCalledTimes(2);
});

it("does not hide or retry genuine provider failures", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Provider unavailable"));
  await expect(waitForCheckout(request)).rejects.toThrow("Provider unavailable");
  expect(request).toHaveBeenCalledTimes(1);
});

it("stops waiting when a checkout stays locked", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ status: "pending" });
  const assertion = expect(waitForCheckout(request)).rejects.toThrow("longer than expected");
  await vi.advanceTimersByTimeAsync(152000);
  await assertion;
});
