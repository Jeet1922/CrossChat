import { providerForUrl } from "../core/sites";
import { inspectActivePage, type ProbeReport } from "./probe";
import "./style.css";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The side panel is missing ${selector}.`);
  return element;
}

const probeButton = requiredElement<HTMLButtonElement>("#probe");
const copyButton = requiredElement<HTMLButtonElement>("#copy");
const status = requiredElement<HTMLParagraphElement>("#status");
const reportField = requiredElement<HTMLTextAreaElement>("#report");

let latestReport: ProbeReport | null = null;

probeButton.addEventListener("click", () => {
  void runProbe();
});

copyButton.addEventListener("click", () => {
  void copyReport();
});

async function runProbe(): Promise<void> {
  probeButton.disabled = true;
  copyButton.disabled = true;
  status.textContent = "Inspecting the active tab…";
  reportField.value = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url || !providerForUrl(tab.url)) {
      throw new Error("Open chatgpt.com or gemini.google.com in the active tab.");
    }

    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: inspectActivePage,
    });
    if (!execution?.result) {
      throw new Error("The probe did not return a report.");
    }

    latestReport = execution.result;
    reportField.value = JSON.stringify(latestReport, null, 2);
    copyButton.disabled = false;
    const candidateCount = Object.values(latestReport.roles).reduce(
      (count, candidates) => count + candidates.length,
      0,
    );
    status.textContent = `Probe complete for ${latestReport.provider}; found ${candidateCount} candidates. Review and remove personal content before sharing.`;
  } catch (error) {
    latestReport = null;
    status.textContent = error instanceof Error ? error.message : "The probe failed.";
  } finally {
    probeButton.disabled = false;
  }
}

async function copyReport(): Promise<void> {
  if (!latestReport) return;

  try {
    await navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2));
    status.textContent = "JSON report copied. Review and remove personal content before sharing.";
  } catch (error) {
    status.textContent = error instanceof Error
      ? `Could not copy the report: ${error.message}`
      : "Could not copy the report.";
  }
}
