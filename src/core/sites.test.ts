import { describe, expect, it } from "vitest";
import { providerForUrl } from "./sites";

describe("providerForUrl", () => {
  it("accepts only the two configured provider hosts", () => {
    expect(providerForUrl("https://chatgpt.com/")).toBe("chatgpt");
    expect(providerForUrl("https://gemini.google.com/app")).toBe("gemini");
    expect(providerForUrl("https://example.com/")).toBeNull();
    expect(providerForUrl("not a url")).toBeNull();
  });
});
