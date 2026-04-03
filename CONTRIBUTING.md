# Contributing to UiPath XAML Visualizer for GitHub

Thanks for your interest in contributing! This guide covers how to report issues, suggest features, and submit pull requests.

## Reporting Bugs

Open a [bug report](../../issues/new?template=bug_report.md) and include:

- A clear description of the problem.
- Steps to reproduce (a link to the `.xaml` file on GitHub is ideal).
- Expected vs. actual behavior.
- Browser name and version.

## Suggesting Features

Open a [feature request](../../issues/new?template=feature_request.md) describing the problem you want to solve and your proposed solution.

## Development Setup

1. Clone the repository.
2. Open `chrome://extensions/` in a Chromium browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the cloned folder.
5. Make changes in `src/`, then click the reload button on the extensions page to pick them up.

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Keep changes focused — one fix or feature per PR.
3. Test your changes on at least one `.xaml` file on GitHub (file view and diff view where applicable).
4. Describe what you changed and why in the PR description.

## Code Style

- Use plain JavaScript (no build step, no frameworks).
- Follow the existing formatting and naming conventions in `src/`.
- Keep the extension lightweight — avoid adding external dependencies unless absolutely necessary.

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
