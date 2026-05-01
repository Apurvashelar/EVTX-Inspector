# Product Requirements Document — v2
## EVTX Investigator: Feature Expansion & Bug Fix Sprint

**Version:** 2.0
**Date:** 2026-04-30
**Author:** Atharav Hedage
**Status:** Pending Approval — Do Not Implement

---

## 0. Bug Fix (P0 — Blocks Core Feature)

### EVTX File Parsing Fails on Upload

**Root Cause (diagnosed):**
`@ts-evtx/core`'s `logger.js` contains:
```js
export const ENABLE_DEBUG_LOGGING = process.env.EVTX_DEBUG === 'true' || false;
```
This module is imported by every file in the parsing chain (`Record.js`, `BXmlParser.js`, `ChunkHeader.js`, etc.). In the browser, `process` is not defined, so the Worker throws a `ReferenceError` before parsing begins. The CSV worker is unaffected because it uses PapaParse, which has no Node.js dependencies.

**Fix (one line):**
Add a `define` entry to `vite.config.ts` to replace `process.env` at build time:
```js
define: {
  'process.env': JSON.stringify({})
}
```
This inlines an empty object for all `process.env.*` lookups without needing a polyfill.

**Risk:** Low. Only `EVTX_DEBUG` and similar env-check flags are affected. The parsing logic itself is pure binary/JS.

---

## 1. Requested Features

### 1.1 File Sidebar with Multi-File Navigation

**Description:**
A collapsible left panel that lists all files loaded in the current session. The analyst can click a file entry to switch the main table to that file's data. Multiple files can be loaded without clearing the previous one.

**Behavior:**
- Sidebar is ~220px wide, collapsible to an icon rail via a toggle button.
- Each file entry shows: file type badge (EVTX/CSV), truncated filename, row count, flag summary (count of flagged rows across all flag types).
- Clicking a file makes it the active file. The main table, toolbar, and column filters all update to reflect the selected file.
- Hovering a file entry shows a remove (×) button to unload that file.
- Files are stored in app state (not localStorage) — they are cleared on page refresh.
- A prominent "+" or "Load file" button at the top of the sidebar opens the file picker.
- When only one file is loaded and the sidebar is collapsed, the toolbar still shows the current filename.

**States:**
- Empty sidebar: shows the drag-drop zone centered in the main area.
- One file loaded: table is shown; sidebar shows the single file.
- Multiple files loaded: sidebar highlights the active file.

**Implementation note:**
App state changes from a single `loadedFile` + `rows` to a map of `{ fileId → { metadata, columns, rows } }` with a `activeFileId` pointer. Flag state (already keyed by `fileHash`) requires no change.

---

### 1.2 Sample Data Pre-Loaded on First Visit

**Description:**
When the app is first opened (or when no files have been loaded), a set of sample events is automatically displayed in the table so the analyst can explore the UI without needing a file immediately.

**Behavior:**
- On first render with an empty sidebar, the app loads a bundled sample dataset instead of showing the drop zone.
- The sample is clearly labelled: a `SAMPLE` badge in the toolbar and a dismissible banner: *"Showing built-in sample data. Drop your own .evtx or .csv file to begin."*
- Clicking "Load file" or dropping a file dismisses the sample and loads the real file.
- The sample data is a small (< 200 KB), realistic subset of Windows Security and System log events covering common EventIDs: 4624 (logon), 4625 (failed logon), 4634 (logoff), 4688 (process creation), 7036 (service started/stopped), 1102 (log cleared).
- The sample is shipped as a static JSON file bundled with the app — no network request.
- Sample data flags and filters are not persisted to localStorage (keyed to a sentinel hash like `__sample__`).

**Rationale:**
Reduces the "blank slate" problem. An analyst demoing the tool to a colleague can immediately show all three MVP features without having a file ready.

---

### 1.3 Dark / Light Mode Toggle

**Description:**
A toggle button in the app header switches between a dark theme (current default) and a light theme. The preference is persisted in localStorage.

**Behavior:**
- A sun/moon icon button in the top-right of the header toggles themes.
- Theme is applied via a `data-theme="dark"|"light"` attribute on `<html>`.
- CSS variables are defined for both themes; switching the attribute triggers a CSS transition for background and text colors (150ms ease).
- Default: respects `prefers-color-scheme` on first visit. If the OS is set to light mode, the app opens in light mode. Subsequent visits use the stored preference.

**Light theme palette:**
- Background: `#ffffff` / `#f6f8fa`
- Surface: `#f6f8fa` / `#ffffff`
- Border: `#d0d7de`
- Text primary: `#1f2328`
- Text secondary: `#656d76`
- Flag colors: same (red/green/yellow are readable on both backgrounds)

---

### 1.4 Column Management: Visibility & Resizing

**Description:**
The analyst can choose which columns are visible and can resize individual columns by dragging.

**Visibility (hide/show columns):**
- A "Columns" button in the toolbar opens a dropdown checklist.
- Each column is listed with a checkbox. Unchecking hides the column from the table.
- A "Reset" option in the dropdown restores all columns to visible.
- Hidden column preferences are persisted in localStorage per file type (EVTX vs CSV dynamic columns). EVTX column visibility is stored as a named preset; CSV visibility is per-session only.
- When a column is hidden, its filter input is also hidden. Any active filter on a hidden column is paused (not cleared) so it reactivates when the column is shown again.

**Column resizing:**
- Each column header has a drag handle on its right border.
- Dragging the handle resizes the column. Minimum width is 40px.
- Double-clicking the drag handle auto-sizes the column to fit its widest visible value (up to a cap of 400px).
- Column widths are persisted to localStorage per file type.

**Implementation note:**
TanStack Table v8 has built-in column resizing support via `enableResizing: true` and the `columnResizeMode: 'onChange'` option. No additional library needed.

---

### 1.5 Flag Navigation from Toolbar

**Description:**
The flag summary chips in the toolbar (e.g., "3 suspicious") are clickable. Clicking a chip scrolls the table to the next flagged row of that type and cycles through all flagged rows of that type sequentially.

**Behavior:**
- Toolbar shows flag chips: `● 3 suspicious   ● 12 reviewed   ● 5 noteworthy`.
- Clicking `● 3 suspicious` scrolls the virtual table to the first suspicious row and highlights it with a brief flash animation (yellow outline, 600ms fade). Clicking again scrolls to the next, cycling back to the first after the last.
- A small counter appears next to the chip while navigating: `● suspicious (2/3)`.
- The virtualizer's `scrollToIndex` API is used for programmatic scrolling — this must account for filtered rows (scroll to the correct index in `filteredRows`, not `rows`).
- If "Flagged only" mode is active, navigation still works within the filtered set.
- Keyboard shortcut: `Shift + F` cycles through all flagged rows across all types.

---

## 2. Brainstormed Analyst Features (Ranked by Practical Value)

The following features were developed from first principles based on real DFIR investigation workflows. All are feasible as client-side, zero-backend features.

---

### 2.1 EventData Detail Pane (High Priority)

**Problem it solves:**
The EventData column is currently a truncated `key=value | key=value` string. For Security events (4624, 4688, etc.), EventData contains 10–20 fields. An analyst cannot read these without exporting.

**Proposed behavior:**
- Clicking any row opens a collapsible detail pane at the bottom of the screen (or a slide-in right drawer — configurable).
- The pane shows two tabs: **Structured** (key-value table of all EventData fields, formatted, copyable) and **Raw XML** (the full rendered XML from the parser, syntax-highlighted, copyable).
- The pane resizes by dragging its top border.
- Clicking another row updates the pane. Pressing `Escape` closes it.
- A "Copy as JSON" button in the pane header copies the entire row as a JSON object to the clipboard.

---

### 2.2 EventID Knowledge Base Tooltip (High Priority)

**Problem it solves:**
No analyst has every Windows EventID memorized. Currently there is no way to know what EventID 4776 or 7045 means without leaving the tool.

**Proposed behavior:**
- EventID cells display a small `ⓘ` icon on hover.
- Clicking the icon (or hovering after a 500ms delay) shows a tooltip with:
  - Event description (e.g., "4624 — An account was successfully logged on")
  - Brief analyst note (e.g., "Logon Type 3 = network logon; look for unusual source IPs")
  - MITRE ATT&CK tactic tag if applicable (e.g., `TA0001 Initial Access`)
- The knowledge base is a static JSON file bundled with the app (~150 KB for the top ~800 common Windows EventIDs).
- Source: curated from Windows Security Auditing documentation and community resources (UltimateWindowsSecurity.com mapping).
- Unknown EventIDs show: "No description available for EventID XXXX."

---

### 2.3 Frequency / Pivot Summary Panel (High Priority)

**Problem it solves:**
When opening a large EVTX file, an analyst's first question is always: "What's in here? What are the top EventIDs? Which computer/user appears most?" Currently the analyst must manually apply filters to explore.

**Proposed behavior:**
- A "Summary" button in the toolbar toggles a summary sidebar panel (or modal).
- The panel shows top-10 frequency tables for: EventID, Channel, Computer, Level, Provider, and — for Security logs — UserID.
- Each row in the frequency table is a clickable filter shortcut: clicking "4624 (15,432)" instantly sets the EventID column filter to `4624`.
- Counts update in real-time as column filters are applied.
- For EVTX files, the panel also shows: total event count, date range (earliest and latest TimeCreated), and file size.

---

### 2.4 Time Range Filter with Date Pickers (High Priority)

**Problem it solves:**
Incident response is always time-bounded. An analyst investigating a breach at 14:30–15:15 on a specific date needs to scope events to that window immediately, without manually filtering the timestamp column with text.

**Proposed behavior:**
- A **From / To** date-time picker pair in the toolbar, initially empty (no time filter).
- Supports: `YYYY-MM-DD HH:MM:SS` manual entry, or a calendar picker on click.
- Setting either bound immediately filters the `TimeCreated` column.
- A "Clear time filter" button resets both bounds.
- A "±30 min" convenience button expands/contracts the current window by 30 minutes in both directions.
- Works on both EVTX (ISO timestamp) and CSV (auto-detected timestamp column).

---

### 2.5 Regex Mode Toggle for Column Filters (Medium Priority)

**Problem it solves:**
Text substring matching is too broad for some investigative queries. An analyst looking for logon events to computers matching `DC\d+` (DC01, DC02, DC15) cannot do this with a substring filter.

**Proposed behavior:**
- A small `.*` (regex) toggle button appears on focus of any filter input.
- When active, the filter uses the input value as a JavaScript regex rather than substring match.
- Regex errors (invalid patterns) are shown as a red border on the input without crashing.
- Regex mode state is per-column and resets on file change.

---

### 2.6 Export Current View to CSV (Medium Priority)

**Problem it solves:**
Currently only flagged rows can be exported. An analyst who has applied a specific set of column filters — e.g., all EventID 4688 (process creation) events — may want to export that filtered subset for reporting.

**Proposed behavior:**
- A dropdown arrow on the existing "Export flagged" button reveals a second option: **"Export current view"**.
- Exports all rows currently visible in the filtered table (respecting column filters, showFlaggedOnly, and time range filter).
- A `FlagType` column is appended (empty for unflagged rows).
- Filename: `filtered_<originalFilename>_<timestamp>.csv`.

---

### 2.7 Investigation Notes Pad (Medium Priority)

**Problem it solves:**
Analysts take notes during triage. Currently these go into a separate text editor or notepad, disconnected from the tool. When they re-open the same file, the context is lost.

**Proposed behavior:**
- A **Notes** tab in the left sidebar (below the file list).
- A plain-text area (no rich text, keeping it simple) where the analyst can type investigation notes.
- Notes are persisted to localStorage keyed by `fileHash` — the same file re-loaded restores the notes.
- A "Copy notes" button copies the notes to the clipboard.
- Notes are included as a final section when exporting flagged rows (appended as a comment block at the top of the CSV).

---

### 2.8 "Go to Record" Jump (Medium Priority)

**Problem it solves:**
When an analyst reads an incident report or ticket that references a specific `EventRecordID` (e.g., "check record 84211"), there is no way to navigate directly to that record in the current tool.

**Proposed behavior:**
- A small `#` search input in the toolbar (collapsed to an icon, expands on click).
- Typing a numeric EventRecordID and pressing Enter scrolls to that record and flashes it.
- If the record is filtered out (hidden by column filters), the analyst is warned: "Record 84211 exists but is hidden by current filters. Clear filters to navigate to it." with a "Clear & go" button.
- Works for EVTX (by EventRecordID) and CSV (by row index).

---

### 2.9 Linked Row Highlighting (Medium Priority)

**Problem it solves:**
Logon/logoff correlation, process creation chains, and service start/stop pairs involve multiple rows. An analyst needs to visually group related events by a shared field value (EventID, UserID, ActivityID, Process ID).

**Proposed behavior:**
- Right-clicking a row expands the existing flag context menu with a second section: **"Highlight all rows with same…"** followed by clickable field names (EventID, UserID, Computer, ActivityID if present).
- Clicking an option applies a soft background highlight (distinct from flags — a blue left-border glow) to all rows matching that field value.
- A "Clear highlights" option in the same menu removes all highlights.
- Multiple highlight groups can coexist using different highlight colors (up to 5 colors cycling).
- Highlights are in-session only (not persisted).

---

### 2.10 Session State Save / Restore (Low-Medium Priority)

**Problem it solves:**
Investigations span hours or days. Flags, filters, time range, and notes represent significant analyst work. Browser data can be cleared. The analyst may want to hand off an investigation to a colleague.

**Proposed behavior:**
- A **"Save session"** option in the toolbar exports a `.evtxi` (EVTX Investigator session) JSON file containing:
  - File metadata (name, hash, size, type)
  - Active column filters
  - Flag state (all flagKeys and their flag types)
  - Time range filter bounds
  - Investigation notes
  - Column visibility and width state
- A **"Load session"** button restores all of the above. The analyst must re-drop the original data file separately (the session file stores metadata + annotations, not the raw log data — keeping it small and privacy-safe).
- If the re-loaded file hash doesn't match the session's stored hash, a warning is shown: "File hash mismatch — annotations may not align correctly."

---

### 2.11 Keyboard Shortcuts (Low-Medium Priority)

**Problem it solves:**
Power analysts navigate and annotate thousands of rows. Mouse-heavy workflows are slow.

**Proposed shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move row selection up/down |
| `Enter` | Open/close detail pane for selected row |
| `Escape` | Close detail pane / clear search box |
| `S` | Flag selected row as Suspicious |
| `R` | Flag selected row as Reviewed |
| `N` | Flag selected row as Noteworthy |
| `X` | Clear flag on selected row |
| `Shift+F` | Cycle to next flagged row |
| `Ctrl+K` | Focus the global search / Go to Record |
| `Ctrl+E` | Export current view to CSV |
| `Ctrl+/` | Open keyboard shortcuts reference overlay |

- A `?` button in the header opens a shortcut reference overlay.
- Shortcuts are disabled when a text input is focused to avoid conflicts.

---

## 3. Deferred / Not Recommended for v2

The following ideas were considered but are excluded from this sprint's scope:

| Idea | Reason deferred |
|------|----------------|
| **Sigma rule matching** | Requires YAML parsing + Sigma rule evaluation engine (~significant complexity). Viable for v3 if demand exists. |
| **Timeline visualization chart** | High implementation effort (requires a charting library + brushing interaction). Better done after the investigation workflow features are solid. |
| **Multi-file event correlation** | Requires a merged data model and cross-file join logic. Significant architectural change. |
| **IP/Username auto-detection in EventData** | EventData field names are inconsistent across providers. High false-positive risk. |
| **Duplicate detection** | Niche use case. Covered better by EventID frequency summary. |

---

## 4. Revised Feature Priority Matrix

| # | Feature | Type | Priority | Effort |
|---|---------|------|----------|--------|
| 0 | Fix EVTX parsing (`process.env` error) | Bug fix | **P0** | XS |
| 1.1 | File sidebar + multi-file support | UX | **P1** | M |
| 1.2 | Sample data pre-loaded | UX | **P1** | S |
| 1.3 | Dark/Light mode toggle | UX | **P1** | S |
| 1.4 | Column visibility + resizing | UX | **P1** | M |
| 1.5 | Flag navigation from toolbar | UX | **P2** | S |
| 2.1 | EventData detail pane | Analyst | **P1** | M |
| 2.2 | EventID knowledge base tooltip | Analyst | **P1** | M |
| 2.3 | Frequency / pivot summary panel | Analyst | **P1** | M |
| 2.4 | Time range filter | Analyst | **P1** | S |
| 2.5 | Regex mode for column filters | Analyst | **P2** | S |
| 2.6 | Export current view to CSV | Analyst | **P2** | XS |
| 2.7 | Investigation notes pad | Analyst | **P2** | S |
| 2.8 | "Go to Record" jump | Analyst | **P2** | S |
| 2.9 | Linked row highlighting | Analyst | **P3** | M |
| 2.10 | Session state save / restore | Analyst | **P3** | M |
| 2.11 | Keyboard shortcuts | Analyst | **P3** | S |

**Effort key:** XS = < 1 hour | S = 1–3 hours | M = 3–8 hours

---

## 5. Suggested Implementation Order

If approved, implement in this order to minimize rework:

1. **Bug fix** (process.env stub) — unblocks EVTX testing for all subsequent features
2. **Sample data** — allows immediate testing without needing a real file
3. **Dark/Light mode** — CSS-only, low risk, good to do early before more components are added
4. **EventData detail pane** — foundational for all analyst features; the layout change (split pane) should happen before other analyst features are added
5. **File sidebar** — architectural change to app state; do before smaller features to avoid rewiring later
6. **Column management** (visibility + resize) — TanStack Table has built-in support; straightforward
7. **Frequency summary panel** — pure computation, no layout impact
8. **Time range filter** — extend existing filter system
9. **Flag navigation** (scrollToIndex) — small feature, high UX impact
10. **Remaining P2/P3 features** in any order

---

## 6. Open Questions

1. **Sample data source:** Should the sample data be hand-crafted JSON (fastest, fully controlled) or a real anonymized EVTX converted to JSON? Real data is more representative but requires care around PII.

2. **EventID knowledge base:** Build and maintain our own curated JSON, or source from an existing public dataset (e.g., the `eventdata` project on GitHub)? Using an existing source is faster but requires tracking license and version.

3. **Detail pane layout:** Bottom drawer (like browser DevTools) or right-side panel (like VS Code's inspector)? Preference?

4. **Column resize persistence for CSV:** CSV files can have 40+ columns with unpredictable names. Should we persist widths per column name, or only for EVTX's fixed column set?

5. **Notes pad:** Plain text only, or support minimal Markdown (bold, bullet points)? Plain text is simpler to implement and less likely to have rendering bugs.

---

*This document covers v2 scope only. All items require explicit approval before implementation begins.*
