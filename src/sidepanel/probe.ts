import type { ProviderId } from "../core/sites";

export interface ProbeCandidate {
  selector: string;
  matchCount: number;
  tag: string;
  role: string | null;
  ariaLabel: string | null;
  title: string | null;
  textPreview: string;
  reason: string;
}

export interface ProbeReport {
  provider: ProviderId;
  url: string;
  capturedAt: string;
  roles: Record<string, ProbeCandidate[]>;
}

export function inspectActivePage(): ProbeReport {
  const hostname = location.hostname;
  const provider = hostname === "chatgpt.com"
    ? "chatgpt"
    : hostname === "gemini.google.com"
      ? "gemini"
      : null;
  if (!provider) {
    throw new Error("Probe only supports chatgpt.com and gemini.google.com.");
  }

  const rolePatterns: Record<string, RegExp> = {
    sendButton: /\b(send|submit|ask|go)\b/i,
    stopButton: /\b(stop|cancel)\b/i,
    copyButton: /\b(copy)\b/i,
    usageLimit: /\b(usage limit|limit reached|too many requests|try again later)\b/i,
  };
  const visible = (element: Element): boolean => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 &&
      style.visibility !== "hidden" && style.display !== "none";
  };
  const textOf = (element: Element): string =>
    (element.getAttribute("aria-label") ?? "") + " " +
    (element.getAttribute("title") ?? "") + " " +
    (element.textContent ?? "").trim();
  const selectorFor = (element: Element): string => {
    if (element.id) {
      const byId = `#${CSS.escape(element.id)}`;
      if (document.querySelectorAll(byId).length === 1) return byId;
    }

    for (const attribute of ["data-testid", "data-test-id", "aria-label", "name", "role"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const candidate = `${element.localName}[${attribute}=${JSON.stringify(value)}]`;
      let isUnique = false;
      try {
        isUnique = document.querySelectorAll(candidate).length === 1;
      } catch {
        // Fall back to the observed DOM path when an attribute value is not CSS-safe.
      }
      if (isUnique) return candidate;
    }

    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body) {
      const parent: Element | null = current.parentElement;
      const sameTagSiblings = parent
        ? Array.from(parent.children).filter((child) => child.localName === current?.localName)
        : [];
      const suffix = sameTagSiblings.length > 1
        ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
        : "";
      parts.unshift(`${current.localName}${suffix}`);
      current = parent;
    }
    return `body > ${parts.join(" > ")}`;
  };

  const allVisible = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter(visible);
  const selectorCache = new Map<string, ProbeCandidate>();
  const candidate = (element: HTMLElement, reason: string): ProbeCandidate => {
    const selector = selectorFor(element);
    const prior = selectorCache.get(selector);
    if (prior) return prior;
    let matchCount = 0;
    try {
      matchCount = document.querySelectorAll(selector).length;
    } catch {
      // The report keeps the selector for inspection even if it is not reusable.
    }
    const result: ProbeCandidate = {
      selector,
      matchCount,
      tag: element.localName,
      role: element.getAttribute("role"),
      ariaLabel: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      textPreview: (element.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180),
      reason,
    };
    selectorCache.set(selector, result);
    return result;
  };
  const buttons = allVisible.filter((element) =>
    element.localName === "button" || element.getAttribute("role") === "button",
  );
  const roles: Record<string, ProbeCandidate[]> = {
    inputBox: allVisible
      .filter((element) =>
        element.isContentEditable ||
        element.getAttribute("role") === "textbox" ||
        element.localName === "textarea" ||
        (element.localName === "input" &&
          ["text", "search"].includes((element as HTMLInputElement).type)),
      )
      .slice(0, 20)
      .map((element) => candidate(element, "Editable or textbox semantic")),
    sendButton: [],
    stopButton: [],
    latestResponse: [],
    copyButton: [],
    usageLimit: [],
  };

  for (const [roleName, pattern] of Object.entries(rolePatterns)) {
    const matchingButtons = buttons
      .filter((element) => pattern.test(textOf(element)))
      .slice(0, 20)
      .map((element) => candidate(element, "Visible button label or text matches the role"));
    if (roleName === "sendButton" || roleName === "stopButton" || roleName === "copyButton") {
      roles[roleName] = matchingButtons;
    } else {
      roles[roleName] = allVisible
        .filter((element) => pattern.test(textOf(element)))
        .slice(0, 20)
        .map((element) => candidate(element, "Visible text matches a usage-limit phrase"));
    }
  }

  roles.latestResponse = allVisible
    .filter((element) => {
      const semantic = element.localName === "article" ||
        element.getAttribute("role") === "article" ||
        Array.from(element.attributes).some(({ name, value }) =>
          /message|response|assistant|model/i.test(name) &&
          /assistant|response|model/i.test(value),
        );
      const textLength = (element.textContent ?? "").trim().length;
      return semantic || (textLength >= 240 && element.children.length >= 1);
    })
    .sort((left, right) => {
      const leftSemantic = left.localName === "article" ||
        left.getAttribute("role") === "article" ? 1 : 0;
      const rightSemantic = right.localName === "article" ||
        right.getAttribute("role") === "article" ? 1 : 0;
      if (leftSemantic !== rightSemantic) return rightSemantic - leftSemantic;
      return (right.textContent ?? "").length - (left.textContent ?? "").length;
    })
    .slice(0, 20)
    .map((element) => candidate(element, "Article semantics or substantial visible text"));

  const colors = ["#d13b32", "#1466cc", "#16834a", "#8a45aa", "#bd6c00", "#087e8b"];
  const priorOverlay = document.getElementById("crossexam-probe-overlay");
  priorOverlay?.remove();
  const overlay = document.createElement("div");
  overlay.id = "crossexam-probe-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
  });
  let labelIndex = 0;
  for (const [roleName, candidates] of Object.entries(roles)) {
    for (const item of candidates) {
      const element = document.querySelector(item.selector);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const color = colors[labelIndex++ % colors.length];
      const marker = document.createElement("div");
      marker.textContent = `${roleName} · ${item.selector}`;
      Object.assign(marker.style, {
        position: "fixed",
        left: `${Math.max(0, rect.left)}px`,
        top: `${Math.max(0, rect.top)}px`,
        maxWidth: `${Math.max(120, Math.min(rect.width, 420))}px`,
        maxHeight: `${Math.max(24, rect.height)}px`,
        overflow: "hidden",
        outline: `2px solid ${color}`,
        background: "rgba(255,255,255,.92)",
        color,
        font: "12px/1.3 sans-serif",
        padding: "2px 4px",
        overflowWrap: "anywhere",
      });
      overlay.append(marker);
    }
  }
  document.documentElement.append(overlay);

  return {
    provider,
    url: location.origin,
    capturedAt: new Date().toISOString(),
    roles,
  };
}
