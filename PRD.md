# Product Requirements Document
## EVTX Investigator — Cross-Platform Browser-Based Windows Event Log Viewer

**Version:** 1.0 (MVP)
**Date:** 2026-04-30
**Author:** Atharav Hedage

---

## 1. Executive Summary

EVTX Investigator is a fully static, browser-based tool that allows DFIR analysts to load, view, search, and annotate Windows Event Log files (`.evtx`) and their CSV exports — entirely on the client side, with no data ever leaving the user's machine. It targets analysts working on macOS, Linux, or any OS without access to native Windows EVTX tooling. The MVP delivers three high-value features absent in current browser tools: column-wise search/filtering, row flagging, and CSV file support.

---

## 2. Problem Statement

### The Gap

Eric Zimmerman's **EvtxECmd + EZ Timeline Explorer** is the gold standard for Windows Event Log investigation on Windows. It provides:
- Parsed, normalized tabular views with column-level filtering
- Row bookmarking and color-coded flagging
- Support for both raw `.evtx` files and their exported `.csv` form
- Fast search across millions of rows

**No equivalent exists for analysts on macOS or Linux.** CLI tools like Hayabusa and Chainsaw are powerful but headless — they produce output files rather than interactive investigation environments. The one browser-based tool that comes close, [omerbenamram.github.io/evtx](https://omerbenamram.github.io/evtx/), provides excellent parsing but lacks investigative workflow features.

### Analyst Pain Points (macOS / Cross-Platform)
1. Must spin up a Windows VM just to open an EVTX file in a usable GUI.
2. Cannot resume an investigation session — no way to persist which rows were already reviewed or flagged as suspicious.
3. EVTX files exported to CSV by lab tools (EvtxECmd, Chainsaw, Hayabusa) cannot be re-loaded into any browser viewer — analysts fall back to Excel, which has no forensics-specific features.
4. Row-level search forces analysts to scroll through thousands of log lines manually.

---

## 3. Goals

### MVP Goals
- Provide a zero-install, cross-platform EVTX investigation UI that runs in any modern browser.
- Support loading both raw `.evtx` files and CSV exports from common tools.
- Enable column-wise search and filtering so analysts can narrow down events precisely.
- Enable row flagging so analysts can mark lines of interest during an investigation session.
- Ensure **no data leaves the client** — all parsing, filtering, and rendering happens in-browser.
- Deploy as a fully static site — zero backend, zero maintenance cost, zero hosting fees.

### Non-Goals (MVP)
- Sigma rule-based threat hunting (future scope)
- Timeline correlation across multiple files (future scope)
- EVTX export back to file
- User accounts, saved sessions server-side, or any backend
- Support for legacy `.evt` files (pre-Vista format)
- Mobile/tablet layout optimization

---

## 4. User Personas

### Primary — Field DFIR Analyst (macOS)
Sarah is a threat hunter at a mid-size MSSP. Her primary workstation is a MacBook Pro. She receives EVTX files or CSV exports from Windows endpoints and needs to triage them during incident response. She knows what EventIDs to look for but needs a fast, filterable table to get there without spinning up a VM.

### Secondary — CTF / Student Analyst (Any OS)
Marcus is a cybersecurity student competing in CTF challenges and participating in Blue Team Labs Online. He often needs to analyze EVTX files on Linux. He is less experienced but needs the same investigative UX.

### Tertiary — Windows Analyst Who Prefers Browser Tools
Priya is a SOC analyst on Windows who finds browser-based tools faster to access than installing software. She frequently exports CSVs from EvtxECmd and wants a cleaner viewer than Excel.

---

## 5. Competitive Analysis

| Tool | Platform | EVTX Load | CSV Load | Column Filter | Row Flag | Browser-Based | Client-Side Only |
|------|----------|-----------|----------|---------------|----------|---------------|-----------------|
| EZ Timeline Explorer | Windows only | Yes | Yes | Yes | Yes | No | N/A |
| omerbenamram.github.io/evtx | Any (browser) | Yes | **No** | Partial | **No** | Yes | Yes |
| FullEventLogView (NirSoft) | Windows only | Yes | No | Yes | No | No | N/A |
| Event Log Explorer | Windows only | Yes | No | Yes | No | No | N/A |
| Hayabusa / Chainsaw | Any (CLI) | Yes | Output only | CLI flags | No | No | N/A |
| Gigasheet | Any (browser) | Yes | Yes | Yes | No | Yes | **No** (cloud upload) |
| **EVTX Investigator (ours)** | **Any (browser)** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

### Key Differentiators vs. omerbenamram.github.io/evtx
The reference site is technically excellent — it uses the same Rust `evtx` library compiled to WebAssembly. Our differentiators are **workflow-level**:
1. **CSV loading** — essential because most analysts receive EVTX data already exported by EvtxECmd, Hayabusa, or Chainsaw.
2. **Row flagging with color labels** — analysts work through thousands of rows; they need to mark suspicious, reviewed, or important lines without leaving the tool.
3. **Per-column search bars** — the reference site has a global search; per-column filtering (e.g., "filter EventID column to 4624") is a fundamentally faster investigative workflow.

> **Note:** The reference site has reportedly added DuckDB-WASM-backed filters recently. If column filtering parity is achieved there, our value proposition shifts further toward CSV support and row flagging, which remain unaddressed by any browser tool.

---

## 6. Feature Specifications (MVP)

### Feature 1 — Column-Wise Search & Filtering

**Description:** Each column in the event table has an individual search input. Filters are AND-combined across columns. Filtering is instant (no submit button needed).

**Behavior:**
- Text columns (EventID, Channel, Computer, Provider, Level): substring match, case-insensitive.
- Timestamp column (TimeCreated): support `YYYY-MM-DD` prefix match and range syntax (`2024-01-01 to 2024-01-31`).
- A "Clear All Filters" button resets all columns at once.
- Active filter count is shown in the toolbar so the analyst knows how many filters are live.
- Filtered row count is shown: e.g., "Showing 142 of 50,000 events."

**Acceptance Criteria:**
- Typing in an EventID column filter immediately narrows the table to matching rows.
- Multiple column filters combine: EventID=4624 AND Computer=DC01 shows only rows matching both.
- Clearing a single filter updates the table immediately.
- Performance: filtering 100,000 rows completes in < 300ms on a mid-range laptop.

---

### Feature 2 — Row Flagging

**Description:** Analysts can mark individual rows with a color-coded flag label during an investigation session. Flagged rows can be filtered to show only flagged items.

**Behavior:**
- Right-click a row (or click a flag icon on hover) opens a context menu with flag options:
  - Suspicious (red)
  - Reviewed (green)
  - Noteworthy (yellow)
  - Clear Flag
- Flagged rows display the color in a left-side indicator column.
- A toolbar toggle "Show Flagged Only" filters the table to flagged rows only.
- A flag summary chip in the toolbar shows counts: e.g., `🚩 3 suspicious | ✓ 12 reviewed`.
- Flags are stored in **browser localStorage** keyed by `EventRecordID` (EVTX) or row index (CSV), so the session survives a page refresh as long as the same file is re-loaded in the same browser.
- "Export Flagged Rows" button downloads flagged rows as a CSV.

**Acceptance Criteria:**
- Right-clicking any row shows the flag context menu.
- Applying a flag updates the row indicator color immediately.
- "Show Flagged Only" correctly filters to flagged rows across all flag types.
- Flagged state persists across page refresh (localStorage).
- Export produces a valid CSV containing only flagged rows with a `FlagType` column appended.

---

### Feature 3 — Load Both EVTX and CSV Files

**Description:** The file loader accepts both `.evtx` binary files and `.csv` files. EVTX files are parsed client-side via WebAssembly. CSV files are parsed client-side via a JavaScript CSV parser.

**Behavior:**

**EVTX loading:**
- Drag-and-drop or click-to-browse file input.
- WASM-based parsing using the `evtx` Rust library compiled to WebAssembly (same technology as the reference site).
- Parsed fields exposed as columns: EventRecordID, TimeCreated, EventID, Level, Channel, Provider, Computer, UserID, EventData (as expandable JSON in a detail pane).
- Large files (> 50 MB) show a progress indicator during parsing.

**CSV loading:**
- Accept `.csv` files produced by common tools: EvtxECmd, Hayabusa, Chainsaw.
- Auto-detect column names from the CSV header row — all columns become filterable.
- No column mapping required; the tool treats each CSV column as a first-class filter target.
- Support CSVs up to 500 MB (parsed in a Web Worker to avoid blocking the UI thread).

**Unified experience:**
- Regardless of source format, the event table, column filters, and row flagging work identically.
- A format badge in the toolbar indicates the loaded file type: `EVTX` or `CSV`.
- When a CSV is loaded, the tool makes a best-effort match of common EvtxECmd column names to canonical names (e.g., `TimeCreated` → TimeCreated column) so column filters remain intuitive.

**Acceptance Criteria:**
- `.evtx` file loads and populates the table with correct EventID, timestamp, and channel values.
- `.csv` file loads with all columns auto-detected from headers.
- Drag-and-drop works in Chrome, Firefox, and Safari.
- A file with 200,000 rows loads and renders in < 5 seconds on a mid-range laptop.
- Attempting to load an unsupported file type shows a clear error message.

---

## 7. Technical Architecture

### Approach

The entire application is a **static single-page application (SPA)**. There is no backend, no API, no database, no user accounts. All computation happens in the browser.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                      │
│  ┌──────────────┐   ┌─────────────────────────────┐ │
│  │  File Input  │   │       React SPA (UI)        │ │
│  │ .evtx / .csv │   │  - Table (virtualized)      │ │
│  └──────┬───────┘   │  - Column filter inputs     │ │
│         │           │  - Flag context menu        │ │
│         ▼           │  - Toolbar / export         │ │
│  ┌──────────────┐   └────────────┬────────────────┘ │
│  │  Web Worker  │                │                   │
│  │              │                ▼                   │
│  │ EVTX: WASM   │   ┌─────────────────────────────┐ │
│  │ (evtx crate) │   │       localStorage          │ │
│  │              │   │  (flags, persisted per file)│ │
│  │ CSV: PapaParse│   └─────────────────────────────┘ │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| UI Framework | React 18 + TypeScript | Mature ecosystem, strong table library support |
| Build Tool | Vite | Fast dev server, excellent WASM support via `vite-plugin-wasm` |
| EVTX Parsing | `evtx` Rust crate → WASM | Same proven tech as reference site; battle-tested on real forensic files |
| CSV Parsing | PapaParse | Industry standard, streaming support, handles large files |
| Table Rendering | TanStack Table (headless) + TanStack Virtual | Handles 500K+ rows without performance degradation via row virtualization |
| Filtering Logic | TanStack Table built-in column filters | Composable, supports custom filter functions |
| Styling | Tailwind CSS | Utility-first, easy to produce a dense data-table UI |
| State Management | Zustand | Lightweight, no boilerplate, easy localStorage integration |
| Flag Persistence | localStorage (via Zustand persist middleware) | Survives page refresh; no server needed |
| Hosting | GitHub Pages or Cloudflare Pages | Free, CDN-backed, static-only |

### Key Technical Decisions

**Why WebAssembly for EVTX?**
EVTX is a binary format with chunked, compressed records. Parsing it reliably in pure JavaScript would be a significant undertaking prone to edge-case bugs. The `evtx` Rust library by Omer Ben-Amram is already production-grade and has been compiled to WASM. We reuse this rather than reinventing the parser.

**Why Web Workers?**
Parsing a large EVTX file synchronously on the main thread would freeze the browser UI. Offloading to a Web Worker keeps the UI responsive and allows showing a real progress bar.

**Why TanStack Virtual (row virtualization)?**
EVTX files routinely contain hundreds of thousands of rows. Rendering all of them in the DOM at once would crash the browser. Virtualization renders only the ~30 rows visible in the viewport at any given time, making even 500K-row files feel instant to scroll.

**Flag persistence strategy:**
Flags are stored as `{ [fileHash]: { [eventRecordId]: FlagType } }` in localStorage. The file hash is computed from the first 4KB of the file (fast, deterministic). This means the same file re-loaded in the same browser restores its flags correctly without any server.

---

## 8. Hosting Strategy

### Recommendation: GitHub Pages (primary) + Cloudflare Pages (optional upgrade)

**GitHub Pages:**
- Free forever, no bandwidth limits enforced in practice.
- Trivial CI/CD: push to `main` → deploy via GitHub Actions.
- Custom domain support via CNAME.
- Sufficient for a forensics tool used by individual analysts (not expecting millions of hits).

**Cloudflare Pages (if needed):**
- Genuinely unlimited bandwidth on free tier.
- Better global CDN performance.
- Slightly more setup, but still free.

Since all computation is client-side, the server only delivers static assets (HTML, JS, CSS, WASM binary). The WASM file (~1–2 MB) is the largest asset and will be served with proper caching headers.

### Privacy Guarantee Copy
> "All processing happens in your browser. No file data, no log contents, no filenames are ever transmitted to any server. You can verify this by running the tool while offline."

---

## 9. Success Metrics

Since this is a free, zero-analytics tool (for privacy reasons), traditional product metrics are not applicable. The following qualitative and community signals will serve as proxies:

| Signal | Target |
|--------|--------|
| GitHub stars | 100 within 3 months of launch |
| Shared in DFIR community channels (Reddit r/computerforensics, DFIR Discord) | At least 1 organic mention |
| Tool works on EVTX files from real incident cases without errors | Internal validation on 10+ public sample EVTX files |
| Positive user feedback on row flagging workflow | 3+ unprompted mentions in GitHub issues or social |

---

## 10. Risks & Open Questions

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `evtx` WASM binary is large (>2MB), causing slow initial load | Medium | Lazy-load WASM only when user drops an EVTX file; show spinner |
| Malformed / edge-case EVTX files fail to parse | Medium | Catch WASM panics, show per-chunk error without crashing the whole file |
| localStorage flags lost if user clears browser data | High (by design) | Document this clearly; offer "Export Session" as JSON as future scope |
| omerbenamram site ships column filtering before we launch | Low-Medium | Our CSV support and row flagging remain unique regardless |
| Very large CSV files (>500MB) cause browser memory pressure | Low-Medium | Cap at 500MB with a clear warning; consider streaming parse for V2 |

### Open Questions
1. **Naming:** What should the tool be called? (Suggestions: `ForensicTab`, `EVTXLens`, `LogFlag`, `LogFort`)
2. **EVTX WASM source:** Should we use the existing compiled WASM from the reference site's GitHub repo, or compile the `evtx` crate ourselves for control over the binary? Compiling ourselves is more work but gives us control over the API surface.
3. **CSV column auto-mapping:** Should we hard-code known EvtxECmd column names for display, or keep it fully generic? Hard-coding gives better UX for the primary use case but may confuse users who load Hayabusa CSVs with different column names.
4. **Accessibility:** Should the MVP meet WCAG 2.1 AA? Relevant if the tool is adopted by government/defense contractors.

---

## 11. Out-of-Scope Features (Future Roadmap Ideas)

The following are explicitly excluded from MVP but noted for future reference:
- Sigma rule matching against loaded events
- Multi-file correlation / merged timeline view
- Event ID knowledge base tooltip (e.g., hover EventID 4624 → "An account was successfully logged on")
- Dark/light theme toggle
- Shareable filtered view via URL hash
- EVTX → CSV export from the browser
- Session export/import (flags + filters) as JSON

---

*This PRD covers the MVP scope only. All three features (column-wise search, row flagging, CSV loading) are self-contained and can be implemented in a single development sprint.*
