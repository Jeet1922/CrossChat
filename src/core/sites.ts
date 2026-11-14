export type ProviderId = "chatgpt" | "gemini";

export function providerForUrl(url: string): ProviderId | null {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "chatgpt.com") return "chatgpt";
    if (hostname === "gemini.google.com") return "gemini";
    return null;
  } catch {
    return null;
  }
}
