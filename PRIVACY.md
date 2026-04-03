# Privacy Policy

**UiPath XAML Visualizer for GitHub** ("the Extension")

Last updated: 2026-04-03

## Data Collection

The Extension does **not** collect, transmit, or store any personal data, browsing history, analytics, or user content on any server controlled by the developer.

## Local Processing

To provide its user-facing features, the Extension processes the current GitHub.com or user-approved GitHub Enterprise Server page URL, repository context, and UiPath `.xaml` workflow content shown in the repository being viewed.

This processing happens locally in your browser to:

- Detect supported GitHub file and compare pages
- Fetch workflow file contents from GitHub or GitHub Enterprise Server
- Render diagrams, flowcharts, state machines, and visual diffs
- Search within workflow activities and inspect workflow metadata

The Extension does not send this data to the developer or to any analytics, advertising, or tracking service.

## Data Storage

The Extension stores the following data locally in your browser profile using `chrome.storage.local`:

- **GitHub Personal Access Tokens**: Optionally provided by the user to increase API rate limits and access private repositories. Tokens are stored per GitHub instance hostname and are sent only to the corresponding GitHub or GitHub Enterprise Server endpoints when authenticated requests are required.
- **Auto-visualize preference**: A boolean setting indicating whether to automatically open the visualizer on .xaml file pages.
- **GitHub Enterprise host configuration**: Hostnames you explicitly register so the Extension can run on those GitHub Enterprise Server instances.

No data is synced across devices or transmitted to any server other than the relevant GitHub or GitHub Enterprise Server page, raw-content, and API endpoints needed for the feature you use.

## GitHub API Usage

The Extension may make requests to the following GitHub-controlled endpoints for the repository you are viewing:

- GitHub page URLs on `github.com`
- Raw file URLs on `raw.githubusercontent.com`
- GitHub REST API endpoints such as `api.github.com`
- Equivalent GitHub Enterprise Server page, raw, and API endpoints for hosts you explicitly configure

When the visual diff feature or private repository access is used, the Extension may send your optional GitHub token in the `Authorization` header to the relevant GitHub or GitHub Enterprise Server endpoint. Tokens are used only to authenticate those requests and are not sent anywhere else.

## Permissions

- **`storage`**: Used to store GitHub tokens and preferences locally.
- **Host permissions (`github.com`)**: Required to inject the visualization UI into GitHub pages and fetch raw XAML file contents.
- **Optional host permissions (`https://*/*`)**: Requested only when you configure a GitHub Enterprise Server instance.

## Third-Party Services

The Extension does not use any third-party analytics, tracking, or advertising services.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/marcelocruzrpa/uipath-xaml-viewer/issues
