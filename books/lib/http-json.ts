import { copy } from "./copy";

export async function readResponseJson(
  response: Response,
): Promise<{ data: unknown; parseError: boolean }> {
  const text = await response.text();
  if (!text.trim()) {
    return { data: null, parseError: false };
  }
  try {
    return { data: JSON.parse(text) as unknown, parseError: false };
  } catch {
    return { data: null, parseError: true };
  }
}

export function errorMessageFromBody(
  data: unknown,
  parseError: boolean,
  fallback: string,
): string {
  if (parseError) return copy.requestFailed;
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}
