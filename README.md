# UiPath XAML Viewer

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/kompgmchmppekbnafaigolnjljbgcccm)](https://chromewebstore.google.com/detail/uipath-xaml-visualizer-fo/kompgmchmppekbnafaigolnjljbgcccm)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Chromium extension that renders UiPath workflow `.xaml` files as interactive diagrams directly on GitHub, GitLab, and their self-hosted variants, with side-by-side visual diffs for commits, pull requests, merge requests, and compare pages.

## Features

### Workflow Visualization
- One-click or auto-visualization on GitHub and GitLab file pages for `.xaml` files.
- Three view modes: **Diagram** (interactive SVG), **Outline** (collapsible tree), and **Flowchart** (Dagre graph layout).
- Sequential workflow rendering with nested containers, connectors, collapse/expand, zoom, pan, and minimap.
- Flowchart rendering with decision diamonds, FlowSwitch boxes, and labeled edges. FlowStep inner activities (nested Sequences, TryCatch, etc.) are fully traversable.
- State machine rendering with transitions, initial-state marker, and multi-line edge labels showing trigger activities, conditions, and action activities.
- Supports both Classic and Modern UiPath design experiences, with 200+ recognized activity types across 15 categories.

### Navigation & Inspection
- Inspector panel: click any activity to view its properties, annotations, and transition details.
- Search with keyboard navigation (`/`, `Ctrl+K`, `Ctrl+F`) and viewport centering on matches.
- Double-click InvokeWorkflowFile nodes to navigate to the referenced workflow with branch-aware, path-normalized links.
- Hover over InvokeWorkflowFile nodes to preview the target workflow's arguments and type.
- Activity navigation with `n`/`p` keys, bookmarks with `b`, and expand/collapse with `Enter`.
- Variable highlighting: click a variable name in the panel to highlight all references.
- Breadcrumb navigation for nested containers.
- Hash-based deep links (`#uxv-<nodeId>;z=;x=;y=`) for sharing specific views.

### Visual Diffs
- Side-by-side visual diff with synchronized pan/zoom: old tree on the left, new tree on the right, with color-coded change indicators (green/red/orange).
- Click any node to see a property-level diff panel (base vs head values, changed rows highlighted).
- Cross-pane node highlighting for matched activities.
- Fallback to single-pane view for new files, deleted files, and parse errors.
- Identity-aware diff matching using stable UiPath IDs (from `sap2010:WorkflowViewState.IdRef`) with LCS-based fallback for accurate pairing of repeated activities.
- Correct handling of renamed/moved `.xaml` files on PR and compare pages.
- Inline change summary badges (added/removed/modified) on file list pages, lazy-loaded via IntersectionObserver.
- Branch comparison view from the toolbar.

### Export
- Export diagrams as SVG (vector) or PNG (2x resolution).
- Print-friendly rendering with full SVG embedding.

### Appearance
- Dark and light theme support, auto-detected from the platform's color mode settings.
- Manual theme override toggle in the toolbar.
- Arguments, scoped variables, design mode badge, and activity count summary by category.
- Auto-collapse for large workflows (>150 activities) to prevent rendering timeouts.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Search activities |
| `Enter` / `Shift+Enter` | Next / previous search match |
| `Esc` | Close viewer or search |
| `+` / `-` | Zoom in / out |
| `0` | Fit to view |
| Arrow keys | Pan diagram |
| `n` / `p` | Next / previous activity |
| `Enter` | Expand / collapse selected |
| `b` | Bookmark selected activity |
| `?` | Toggle shortcut help |

### Platform Support
- Works on **GitHub.com**, **GitHub Enterprise Server**, **GitLab.com**, and **self-hosted GitLab** instances.
- Auto-detects the platform from the page hostname. Custom hosts (GHE or self-hosted GitLab) are activated from the options page after granting the host permission.
- API URLs derived automatically (`api.github.com` / `/api/v3` for GitHub; `/api/v4` for GitLab).
- Dynamic content script registration per host via the service worker.
- Per-host token storage: configure separate tokens for each instance.

### Tokens (Optional)
- The extension uses GitHub/GitLab APIs to fetch file content for diffs and ref resolution. Without a token, public repositories are subject to lower rate limits. Adding a token increases the limit and enables access to private repositories.
- **GitHub**: tokens start with `ghp_` or `github_pat_`. Without a token: 60 req/hour; with a token: 5,000 req/hour.
- **GitLab**: tokens start with `glpat-` and require the `read_api` scope.
- Tokens are stored locally in the browser profile via extension storage and are not synced across devices.
- Response caching (LRU, max 200 items) to minimize API calls.

## Installation

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/uipath-xaml-visualizer-fo/kompgmchmppekbnafaigolnjljbgcccm)**

### Manual Installation (for development)

1. Download and unzip the extension folder.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder.
5. Open a UiPath `.xaml` file on GitHub or GitLab.

## Token Setup

1. Open the extension options page from the extensions screen.
2. Select the platform tab (**GitHub** or **GitLab**).
3. Enter the instance hostname (defaults to `github.com` or `gitlab.com`; enter a custom hostname for enterprise/self-hosted instances).
4. Paste a token with the minimum scope required for your repositories.
5. Reload open tabs after saving.

## Project Structure

```text
uipath-xaml-viewer/
|-- manifest.json
|-- package.json
|-- vitest.config.js
|-- eslint.config.mjs
|-- CONTRIBUTING.md
|-- PRIVACY.md
|-- LICENSE
|-- icons/
|   |-- icon16.png
|   |-- icon48.png
|   `-- icon128.png
|-- lib/
|   `-- dagre.min.js
|-- scripts/
|   `-- package.js
|-- src/
|   |-- background.js          # Service worker: dynamic host registration
|   |-- content.js             # Entry point orchestrator
|   |-- content-export.js      # SVG/PNG export
|   |-- content-fetch.js       # Authenticated API client with caching
|   |-- content-github.js      # GitHub page detection, XAML fetching, button injection
|   |-- content-gitlab.js      # GitLab page detection, XAML fetching, button injection
|   |-- content-interactions.js # Pan/zoom, search, keyboard, inspector, bookmarks
|   |-- content-search.js      # Search and filter utilities
|   |-- content-state.js       # Shared state namespace (UXV)
|   |-- content-viewer.js      # Viewer lifecycle and rendering orchestration
|   |-- diff.js                # Visual diff engine with LCS matching
|   |-- options.html           # Settings page
|   |-- options.js             # Settings handler
|   |-- parser.js              # XAML parser (Classic & Modern)
|   |-- renderer.js            # SVG diagram renderer (sequential, flowchart, state machine)
|   |-- styles.css             # UI styling (dark/light themes)
|   `-- utils.js               # Shared utilities
`-- test/
    |-- assets.test.js
    |-- content.test.js
    |-- diff.test.js
    |-- e2e.test.js
    |-- integration.test.js
    |-- parser.test.js
    |-- renderer.test.js
    |-- url-parser.test.js
    `-- fixtures/
        |-- arguments.xaml
        |-- classic-sequence.xaml
        |-- duplicate-activities.xaml
        |-- flowchart.xaml
        |-- flowchart-nested.xaml
        |-- modern-sequence.xaml
        |-- parse-error.xaml
        |-- state-machine.xaml
        `-- state-machine-rich.xaml
```

## Development

```bash
npm install        # Install dev dependencies (vitest, jsdom, eslint)
npm run lint       # Run ESLint
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run package    # Build dist/uipath-xaml-viewer.zip
```

## Browser Support

Chromium browsers with Manifest V3 support, including Chrome, Edge, Brave, Arc, and Vivaldi.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
