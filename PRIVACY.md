# Privacy Policy

**UiPath XAML Viewer** ("the Extension")

Last updated: 2026-04-09

## Data Collection

The Extension does **not** collect, transmit, or store any personal data, browsing history, analytics, or user content on any server controlled by the developer.

## Local Processing

To provide its user-facing features, the Extension processes the current page URL, repository context, and UiPath `.xaml` workflow content shown on GitHub.com, GitLab.com, or user-approved GitHub Enterprise Server and self-hosted GitLab instances.

This processing happens locally in your browser to:

- Detect supported file and compare pages on GitHub and GitLab
- Fetch workflow file contents from the relevant platform API
- Render diagrams, flowcharts, state machines, and visual diffs
- Search within workflow activities and inspect workflow metadata

The Extension does not send this data to the developer or to any analytics, advertising, or tracking service.

## Data Storage

The Extension stores the following data locally in your browser profile using `chrome.storage.local`:

- **Personal Access Tokens**: Optionally provided by the user to increase API rate limits and access private repositories. GitHub and GitLab tokens are stored separately, per instance hostname, and are sent only to the corresponding platform endpoint when authenticated requests are required.
- **Auto-visualize preference**: A boolean setting indicating whether to automatically open the visualizer on .xaml file pages.
- **Custom host configuration**: Hostnames you explicitly register so the Extension can run on GitHub Enterprise Server or self-hosted GitLab instances.

No data is synced across devices or transmitted to any server other than the relevant GitHub or GitLab page, raw-content, and API endpoints needed for the feature you use.

## API Usage

The Extension may make requests to the following platform-controlled endpoints for the repository you are viewing:

**GitHub:**
- GitHub page URLs on `github.com`
- Raw file URLs on `raw.githubusercontent.com`
- GitHub REST API v3 endpoints such as `api.github.com`
- Equivalent GitHub Enterprise Server page, raw, and API endpoints for hosts you explicitly configure

**GitLab:**
- GitLab page URLs on `gitlab.com`
- GitLab REST API v4 endpoints such as `gitlab.com/api/v4`
- Equivalent self-hosted GitLab page and API endpoints for hosts you explicitly configure

When the visual diff feature or private repository access is used, the Extension may send your optional token in the request header to the relevant platform endpoint. Tokens are used only to authenticate those requests and are not sent anywhere else.

## Permissions

- **`storage`**: Used to store tokens and preferences locally.
- **`scripting`**: Used to dynamically register content scripts on custom GitHub Enterprise or self-hosted GitLab hosts.
- **Host permissions (`github.com`, `raw.githubusercontent.com`, `gitlab.com`)**: Required to inject the visualization UI into GitHub and GitLab pages and fetch XAML file contents.
- **Optional host permissions (`https://*/*`)**: Requested only when you configure a custom GitHub Enterprise Server or self-hosted GitLab instance.

## Third-Party Services

The Extension does not use any third-party analytics, tracking, or advertising services.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/marcelocruzrpa/uipath-xaml-viewer/issues
