# crossexam

Cross-examine ChatGPT and Gemini from a Chrome side panel using your existing
logged-in browser sessions. The extension is local-only: it has no API keys,
backend, analytics, or remotely loaded code.

## Phase 0: build and load the probe

Requirements: Node.js 20+ and Chrome 116+.

```sh
npm install
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select this repository's `dist/` folder. Pin the extension and
open ChatGPT or Gemini in a tab. Click the extension icon to open the side
panel, then click **Probe active tab**. The probe only runs on
`chatgpt.com` and `gemini.google.com`.

The probe scans the live page for generic semantic candidates; it does not
submit prompts or assume provider-specific selectors. It outlines candidates
on the page and reports the observed tag, accessible labels, text preview,
generated selector, match count, and reason for inclusion. Review the
candidates, then use **Copy JSON report** and paste the report into the
development conversation. The report includes only the site origin, not the
conversation path. Review text previews and remove any personal content before
sharing.

To clear the highlights, click **Probe active tab** again; the previous overlay
is replaced. Highlights are an overlay and do not change the page's styles.

## Development

```sh
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run dev` starts Vite's local UI preview; it is not an extension runtime.
Load the built `dist/` directory in Chrome to test extension APIs.

The Phase 0 probe report is diagnostic only. Provider selectors and adapters
will be added after reports from both live sites are reviewed.
