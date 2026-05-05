# Changelog

All notable changes to EVTX Inspector are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Pre-rendered SEO content in `index.html` so crawlers without a JavaScript runtime (Bing, LinkedIn, Slack) index the page with real keyword-relevant copy.
- Real `<h1>` heading on the brand instead of `<span>`, improving SEO and screen-reader semantics.
- Open Graph PNG (`public/og-image.png`, 1200×630) so social previews render correctly on LinkedIn, Slack, Twitter/X, and Discord.

### Changed
- Cache-Control on HTML changed from `no-cache, no-store` to `no-cache, must-revalidate` — repeat visits are now served from cache when the validator matches, with no risk of stale content.

### Fixed
- Production EVTX parsing returned empty rows. Vite 8's Rolldown/oxc minifier mangles class names; `@ts-evtx/core` branches on `node.constructor.name === 'OpenStartElementNode'` etc., so every comparison failed silently. Fixed by setting `output.keepNames: true` on both the main and worker bundles.

## [1.0.0] — 2026-04-30

### Added
- Initial public release.
- Native `.evtx` file parsing via `@ts-evtx/core` in a Web Worker.
- CSV file parsing via PapaParse in a Web Worker; auto-detects column names from EvtxECmd, Hayabusa, Chainsaw, and `Get-WinEvent` exports.
- Multi-file investigation: open many files at once and switch between them in the sidebar.
- Per-column text filters with OR logic (`4624, 4625`), global search, and time-range picker.
- Right-click any cell value to OR-append it to that column's filter.
- Row flagging (Suspicious, Reviewed, Noteworthy) persisted to `localStorage` keyed by file hash.
- Batch flag/unflag via row checkboxes.
- Toolbar flag-navigation chips that scroll to the next flagged row of each type.
- Export flagged rows to CSV with a `FlagType` column appended.
- Column show/hide, drag-to-reorder, drag-to-resize.
- Dark and light themes with system-preference default and `localStorage` persistence.
- Sample dataset bundled for first-visit exploration.

[Unreleased]: https://github.com/Apurvashelar/EVTX-Inspector/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Apurvashelar/EVTX-Inspector/releases/tag/v1.0.0
