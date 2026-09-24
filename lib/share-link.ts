import { copyTextToClipboard } from "./clipboard";

export type ShareLinkResult = "shared" | "copied" | "cancelled" | "failed";

export type ShareFn = (data: ShareData) => Promise<void>;

export async function shareGatheringLink(
  url: string,
  title: string,
  shareFn?: ShareFn | null,
): Promise<ShareLinkResult> {
  const share = shareFn ?? getNavigatorShare();
  if (share) {
    try {
      await share({ url, title, text: title });
      return "shared";
    } catch (error) {
      if (isShareCancelled(error)) return "cancelled";
    }
  }
  const copied = await copyTextToClipboard(url);
  return copied ? "copied" : "failed";
}

function getNavigatorShare(): ShareFn | null {
  if (typeof navigator === "undefined") return null;
  const share = navigator.share;
  if (typeof share !== "function") return null;
  return share.bind(navigator);
}

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
