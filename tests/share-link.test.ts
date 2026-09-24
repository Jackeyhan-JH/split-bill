import { describe, expect, test, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";
import { shareGatheringLink } from "@/lib/share-link";

describe("copyTextToClipboard", () => {
  test("uses clipboard API when available", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("https://example.com/g/abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/g/abc");
    vi.unstubAllGlobals();
  });
});

describe("shareGatheringLink", () => {
  const url = "https://example.com/g/test-id";
  const title = "周五火锅";

  test("returns shared when share succeeds", async () => {
    const share = vi.fn(async () => {});
    await expect(shareGatheringLink(url, title, share)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ url, title, text: title });
  });

  test("returns cancelled on AbortError without copying", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(shareGatheringLink(url, title, share)).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("falls back to copy when share is unavailable", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(shareGatheringLink(url, title, null)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(url);
    vi.unstubAllGlobals();
  });
});
