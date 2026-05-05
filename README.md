# EVTX Inspector

> A fast, privacy-first Windows Event Log analyzer that runs entirely in your browser.

**[→ Try it now](https://evtx-inspector.apurvashelar303.workers.dev/)** — no install, no upload.

EVTX Inspector lets incident responders and forensic analysts investigate Windows `.evtx` files and CSV event log exports without installing anything and without uploading data anywhere. All parsing, filtering, and flagging happens locally in Web Workers.

---

## The problem

Eric Zimmerman's **EvtxECmd** + **Timeline Explorer** is the gold standard for Windows Event Log triage — but it's Windows-only. Analysts on **macOS** and **Linux** have no equivalent investigation UI. The options today are:

- Spin up a Windows VM just to open an EVTX file in a usable GUI.
- Pipe the file through CLI tools (Hayabusa, Chainsaw) — powerful, but headless: they produce output files, not interactive triage environments.
- Open CSV exports in Excel — no per-column filtering, no row flagging, no forensics-aware features.
- Use [omerbenamram.github.io/evtx](https://omerbenamram.github.io/evtx/) — excellent parsing, but no CSV support and no investigation workflow (flags, per-column filtering, multi-file).

EVTX Inspector closes that gap: a zero-install, browser-based investigation surface with the column filtering, row flagging, and CSV-export support analysts actually use during triage — running on any OS, with no data ever leaving the machine.

---

## Demo

<!-- Replace with a GIF showing: drop a file → filter a column → flag a row → export. -->
<!-- Recommended: 1280×720, ≤ 8 MB, ≤ 15 s. Place at docs/demo.gif. -->

![EVTX Inspector demo](docs/demo.gif)

---

## Features

| Category | Capability |
|----------|-----------|
| **File support** | Native `.evtx` files and CSV exports (EvtxECmd, Get-WinEvent, any header-row CSV) |
| **Performance** | Virtual scroll handles hundreds of thousands of events without pagination |
| **Multi-file** | Open multiple logs simultaneously; switch between them in the sidebar |
| **Filtering** | Per-column text filters with OR logic (`4624, 4625`), global search, time range picker |
| **Context filter** | Right-click any cell value → **Add to filter** (OR-appends to existing filter) |
| **Column management** | Show/hide columns, resize by dragging handles, reorder by dragging headers |
| **Row flagging** | Mark rows Suspicious / Reviewed / Noteworthy; flags persist across browser sessions |
| **Batch operations** | Checkbox-select multiple rows → bulk flag or clear in one action |
| **Flag navigation** | Toolbar chips jump between flagged rows of each type |
| **Export** | Download all flagged rows as CSV |
| **Themes** | Dark and light mode; respects system preference, persists to localStorage |
| **Privacy** | Zero telemetry, zero uploads, zero cookies — localStorage only (theme + flags) |

---

## Getting Started

**Requirements:** Node.js 18+ · npm 9+

```bash
git clone https://github.com/Apurvashelar/EVTX-Inspector.git
cd EVTX-Inspector
npm install
npm run dev          # → http://localhost:5173
```

```bash
npm run build        # production build → dist/
npm run preview      # preview the production build locally
```

---

## Usage Guide

### Loading files

Drag-and-drop an `.evtx` or `.csv` file onto the app, or click the **+** button in the left sidebar. Multiple files can be loaded at once; click any file in the sidebar to switch.

The app starts with a sample dataset of realistic Windows Security and System events so you can explore the interface without loading a real file.

### Filtering events

| Method | How to use |
|--------|-----------|
| **Global search** | Search bar in the toolbar — matches any column |
| **Column filter** | Text input below each column header |
| **OR values** | Comma-separate terms in any column filter: `4624, 4625` |
| **Right-click filter** | Right-click a cell → **Add "[value]"** — appends to that column's filter with OR |
| **Time range** | Set From / To timestamps in the toolbar, then click **OK** |
| **Clear all** | "Clear all" button in toolbar removes every active filter at once |

### Flagging and investigation

- **Right-click** any row to flag it as Suspicious, Reviewed, or Noteworthy.
- **Checkbox** rows (or use the header checkbox for "select all") then use the batch action bar to flag multiple rows at once.
- **Toolbar chips** (coloured counts) let you jump to the next flagged row of each type.
- Toggle **Flagged only** in the toolbar to hide unflagged rows.
- Click **Export flagged** to download a CSV of all flagged rows with their flag type.

Flags are stored in `localStorage` keyed by a hash of the file (name + size + content sample), so reopening the same file in the same browser restores all previous flags.

### Column management

| Action | How |
|--------|-----|
| **Resize** | Drag the right edge of any column header |
| **Reorder** | Drag a column header left or right; a blue indicator shows the drop position |
| **Show / hide** | **Columns** button in the toolbar → toggle individual columns |
| **Reset layout** | **Columns → Reset** restores default widths and visibility |

---

## Supported File Formats

### `.evtx`
Native Windows Event Log binary format. Parsed in a Web Worker using [`@ts-evtx/core`](https://github.com/mdamien/ts-evtx). Extracts System fields (EventID, TimeCreated, Level, Channel, Computer, Provider, UserID, Keywords, Task, Opcode) plus all `<EventData>` name/value pairs concatenated into a single column.

### `.csv`
Any CSV with a header row. Column names from common tools are auto-recognized:

| Tool | Key columns detected |
|------|---------------------|
| **EvtxECmd** | EventRecordID, TimeCreated, EventID, LevelName, Channel, Computer, Provider, MapDescription, PayloadData1–6 |
| **Get-WinEvent** | TimeCreated, Id, Message |
| **Generic** | Any column names; timestamp columns detected by name heuristic |

---

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | React | 19 |
| Build | Vite | 8 |
| Styling | Tailwind CSS | 4 |
| Table engine | TanStack Table | v8 |
| Virtualization | TanStack Virtual | v3 |
| State | Zustand | 5 |
| EVTX parsing | @ts-evtx/core | 1.1 |
| CSV parsing | PapaParse | 5 |
| Language | TypeScript | 6 |

---

## Privacy

All processing runs in your browser. Nothing is transmitted to any server. The only data written to `localStorage` is:
- Your theme preference (`evtx-theme`)
- Row flags (`evtx-inspector-flags`) — keyed by file hash, not file content

No analytics, no error reporting, no external requests of any kind.

---

## Browser Support

Modern Chromium browsers (Chrome 90+, Edge 90+) and Firefox 90+. Safari is supported but less tested. Requires ES modules and `Blob` + `URL.createObjectURL` for CSV export.

---

## License

MIT
