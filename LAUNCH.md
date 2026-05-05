# EVTX Inspector — Launch & Growth Action Plan

A single source of truth for everything left to do. Items marked **[done]** were completed in code; everything else has copy-paste-ready content and exact links.

> **Sequencing principle:** finish §1 before §2. Search Console verification needs to be live before you start driving traffic, otherwise the early indexing data is lost.

---

## 1. Pre-launch hardening (do these in order, ≤ 1 hour total)

### 1.1 Deploy what's already changed **[done — needs deploy]**

Already in the working tree:
- `public/og-image.png` — 1200×630 PNG so social previews render.
- `index.html` — pre-rendered `<h1>`, `<h2>`s, and copy that crawlers see even without JS.
- `src/App.tsx` — brand is now an `<h1>`, not a `<span>`.
- `public/_headers` — fixed `Cache-Control` so repeat visits hit browser cache.
- `CHANGELOG.md` — created. Future releases append Phere.
- `vite.config.ts` — `output.keepNames: true` (the production EVTX-empty-rows fix).

Deploy:

```bash
git add -A
git commit -m "feat(seo): prerender SEO content, add real og-image.png, h1, changelog"
git push
```

Cloudflare Pages picks it up automatically.

### 1.2 Verify the og-image actually renders

After deploy, paste your URL into each of these and confirm the image loads:

| Validator | URL |
|-----------|-----|
| LinkedIn Post Inspector | https://www.linkedin.com/post-inspector/ |
| Twitter/X Card Validator | https://cards-dev.twitter.com/validator (only works while logged-in) |
| Facebook / OG Debugger | https://developers.facebook.com/tools/debug/ |
| Generic OG check | https://www.opengraph.xyz/ |

If any shows the old result, click **Re-scrape** / **Refresh** on that tool — they cache aggressively.

### 1.3 Google Search Console

1. Open https://search.google.com/search-console.
2. Click **Add property** → **URL prefix** → paste `https://evtx-inspector.apurvashelar303.workers.dev/`.
3. Choose **HTML tag** verification.
4. Copy the `content="…"` value Google gives you.
5. Open `index.html`, find this line:

   ```html
   <!-- <meta name="google-site-verification" content="REPLACE_WITH_YOUR_GSC_VERIFICATION_CODE" /> -->
   ```

   Uncomment it and paste the code. Commit + push.

6. Wait ~2 minutes after Cloudflare deploys, click **Verify** in Search Console.
7. Once verified: in Search Console → **Sitemaps** → submit `sitemap.xml`.

### 1.4 Bing Webmaster Tools

1. https://www.bing.com/webmasters → **Add a site** → paste your URL.
2. The fastest verification is **Import from Google Search Console** — one click after §1.3 is done.
3. Submit the same sitemap URL.

### 1.5 Cloudflare Web Analytics (privacy-friendly, no cookie banner needed)

1. Cloudflare dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site**.
2. Choose **Free / Standalone**, paste your URL.
3. Cloudflare gives you a `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"…"}'></script>` snippet — copy the token (the value between the curly braces).
4. In `index.html` find this block:

   ```html
   <!-- <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "REPLACE_WITH_YOUR_CF_ANALYTICS_TOKEN"}'></script> -->
   ```

   Uncomment and replace `REPLACE_WITH_YOUR_CF_ANALYTICS_TOKEN`. Commit + push.

---

## 2. GitHub repo hardening (15 minutes)

### 2.1 Repo metadata

1. Open https://github.com/Apurvashelar/EVTX-Inspector → click the **gear icon** next to **About** on the right sidebar.
2. **Description**: `Browser-based Windows Event Log (.evtx) viewer and DFIR analyzer for macOS, Linux, and Windows. Zero install, zero upload.`
3. **Website**: `https://evtx-inspector.apurvashelar303.workers.dev/`
4. **Topics** (all of these — GitHub topic search is a real traffic source):
   ```
   evtx
   evtx-parser
   evtx-viewer
   windows-event-log
   event-log-viewer
   dfir
   incident-response
   forensics
   blue-team
   soc
   security-tools
   threat-hunting
   webassembly
   react
   typescript
   ```
5. Tick **Releases** and **Packages**.

### 2.2 Pin the repo

GitHub profile → **Customize your pins** → pin EVTX-Inspector. Visitors to your profile see it first.

### 2.3 First release

Releases create a `<release>` event in everyone's feed who watches the repo, and Google indexes them.

```bash
git tag -a v1.0.0 -m "First public release"
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0 — first public release" --notes-file - <<'EOF'
First public release of EVTX Inspector.

Browser-based Windows Event Log analyzer for DFIR analysts on macOS, Linux, or any OS without native EVTX tooling.

**Highlights**
- Native `.evtx` and CSV file parsing in Web Workers
- Per-column filters, global search, time-range picker
- Row flagging (Suspicious / Reviewed / Noteworthy) persisted across sessions
- Multi-file investigation, virtual scroll for 100k+ events
- Zero telemetry, zero uploads — everything runs locally

**Try it:** https://evtx-inspector.apurvashelar303.workers.dev/

See the full feature list in [CHANGELOG.md](https://github.com/Apurvashelar/EVTX-Inspector/blob/main/CHANGELOG.md).
EOF
```

### 2.4 Issue templates (3 minutes, helps when traffic comes in)

Create `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md`. GitHub has a UI: repo → **Issues** → **New issue** → **Get started** under each template type.

---

## 3. Backlinks from `awesome-*` lists (highest-leverage discovery channel)

Each of these is a single PR. Lead time ~1–7 days. Turn-down rate is low if you target topical lists.

For each one below:

1. Fork the listed repo on GitHub.
2. Add the entry to the right section.
3. Open a PR with the title and body provided.

### 3.1 awesome-incident-response

Repo: https://github.com/meirwah/awesome-incident-response

**Section to add it under:** *Log Analysis* (search the README for that heading)

**Entry to add (alphabetical order within section):**

```markdown
* [EVTX Inspector](https://github.com/Apurvashelar/EVTX-Inspector) - Browser-based Windows Event Log (.evtx) viewer and CSV analyzer with per-column filtering, row flagging, and multi-file investigation — runs entirely in-browser on macOS, Linux, or Windows. Zero install, zero upload.
```

**PR title:** `Add EVTX Inspector to Log Analysis`

**PR body:**

```
Adds EVTX Inspector — a browser-based Windows Event Log analyzer for DFIR.

It fills a specific gap: Eric Zimmerman's Timeline Explorer is Windows-only, and CLI tools like Hayabusa/Chainsaw are headless. Analysts on macOS or Linux currently spin up a Windows VM just to open .evtx files in a usable GUI. EVTX Inspector parses .evtx and CSV exports entirely client-side via WebAssembly, with per-column filters, row flagging, multi-file support, and CSV export.

Live demo: https://evtx-inspector.apurvashelar303.workers.dev/
Repo: https://github.com/Apurvashelar/EVTX-Inspector
License: MIT
```

### 3.2 Awesome-Cybersecurity-Blue-Team

Repo: https://github.com/fabacab/awesome-cybersecurity-blueteam

**Section:** *Forensics* → *Windows-specific* (or just *Forensics*)

**Entry:**

```markdown
* [EVTX Inspector](https://github.com/Apurvashelar/EVTX-Inspector) — Browser-based Windows Event Log (.evtx) viewer and CSV analyzer for macOS, Linux, and Windows. Per-column filters, row flagging, multi-file investigation. Zero install, fully client-side.
```

**PR title:** `Add EVTX Inspector under Forensics`

**PR body:** (same as 3.1)

### 3.3 awesome-forensics

Repo: https://github.com/cugu/awesome-forensics

**Section:** *Tools* → *Other Tools* (or wherever EVTX-related tools live — search for "evtx" in the README to find peers)

**Entry:**

```markdown
- [EVTX Inspector](https://github.com/Apurvashelar/EVTX-Inspector) - Browser-based Windows EVTX and CSV log viewer with column filters, row flagging, and multi-file investigation. Runs in-browser on any OS.
```

**PR title:** `Add EVTX Inspector`

### 3.4 awesome-malware-analysis

Repo: https://github.com/rshipp/awesome-malware-analysis

**Section:** *Online Tools and Services* or *Other Resources*

Same entry/body. Frame it as "useful for triaging EVTX logs from compromised hosts" in the PR body.

### 3.5 awesome-threat-detection

Repo: https://github.com/0x4D31/awesome-threat-detection

**Section:** *Tools*

Same entry.

---

## 4. Forum / community submissions (do AFTER §1 + §2)

> **Tone:** lead with the problem, not the tool. The DFIR community has very low tolerance for "look what I built" posts. The post should read like "I had this problem; I built this; would love feedback" — not a press release.

### 4.1 r/computerforensics

URL: https://www.reddit.com/r/computerforensics/submit

**Title:**
```
I built a browser-based EVTX viewer because I was tired of spinning up Windows VMs on my Mac
```

**Body (post as-is):**
```
A few weeks ago I had to triage a few hundred EVTX files on a Mac. Eric Zimmerman's Timeline Explorer is the gold standard but it's Windows-only. omerbenamram's online viewer is great for parsing but doesn't do per-column filtering or row flagging. Hayabusa and Chainsaw are CLI-only and produce output files rather than an interactive triage environment. So I'd been bouncing between Excel and a Windows VM, which is exhausting.

I ended up building EVTX Inspector — a fully static, in-browser EVTX and CSV viewer with the investigation features I actually needed:

- Per-column filtering with OR logic (`4624, 4625` filters to either)
- Right-click any cell → "Add to filter" — appends with OR
- Row flagging: Suspicious / Reviewed / Noteworthy, persists across reloads
- Time-range picker
- Multi-file workspace — drop multiple logs, switch via sidebar
- Export flagged rows to CSV
- Virtual scroll handles 100k+ rows without choking
- Loads CSV exports from EvtxECmd, Hayabusa, Chainsaw, Get-WinEvent

Everything runs in a Web Worker. Zero upload, zero telemetry, zero accounts. The whole thing is a single static site.

Live: https://evtx-inspector.apurvashelar303.workers.dev/
Source (MIT): https://github.com/Apurvashelar/EVTX-Inspector

Genuinely keen for feedback — workflows I missed, EventID quirks, files that break it. Especially interested in hearing from anyone else doing DFIR off Windows.
```

**Flair:** *Tool* (if available)

**After posting:** monitor for ~6 hours. Reply to every comment within an hour for the first day. Reddit's algorithm rewards engagement velocity.

### 4.2 r/blueteamsec

URL: https://www.reddit.com/r/blueteamsec/submit

**Title:**
```
EVTX Inspector — browser-based Windows Event Log triage tool (CSV + EVTX, runs offline)
```

**Body:** same as 4.1 (the audience overlaps; don't bother rewording).

### 4.3 r/AskNetsec

Skip. AskNetsec wants questions, not tool announcements. Mods will remove it.

### 4.4 r/cybersecurity

URL: https://www.reddit.com/r/cybersecurity/submit

Mods are aggressive about self-promotion. Don't post unless you've hit 4.1 + 4.2 first and have engagement to point to. If you do post:

**Title:**
```
Built a free browser-based EVTX viewer for DFIR analysts working off macOS/Linux
```

Body: same.

### 4.5 Hacker News — Show HN

Wait until the site has been live for ≥ 7 days and you've fixed any issues from §4.1/§4.2 feedback. HN visibility is one shot — don't burn it on a half-tested launch.

URL: https://news.ycombinator.com/submit

**Title:**
```
Show HN: EVTX Inspector – browser-based Windows Event Log analyzer (no upload)
```

**URL field:** `https://evtx-inspector.apurvashelar303.workers.dev/`

**Text field (HN style — short, factual):**
```
Hi HN — I built this because I work DFIR off a Mac and there's no decent browser-based EVTX viewer with investigation features (filtering, flagging, multi-file). Existing options are either Windows-only (Timeline Explorer), CLI-only (Hayabusa, Chainsaw), or parse-only (omerbenamram's viewer).

EVTX Inspector parses .evtx files via the Rust evtx crate compiled to WebAssembly, plus CSV exports via PapaParse. Everything runs in a Web Worker — no server, no upload, no tracking. Per-column filters, row flagging, multi-file workspace, virtual scroll for large files.

Source on GitHub: https://github.com/Apurvashelar/EVTX-Inspector

Happy to answer technical questions on the parsing pipeline or the Web Worker architecture.
```

**Time it for a Tuesday/Wednesday at 8am PST** — empirically the highest-traffic HN window.

### 4.6 DFIR Discord

If you're a member of the DFIR Discord (https://www.dfir.training/dfir-discord) — post in `#tools` (read pinned rules first; some channels require mod approval).

**Message:**
```
Hi all — built a browser-based EVTX/CSV viewer for triage off macOS/Linux: https://evtx-inspector.apurvashelar303.workers.dev/

Features per-column filters, row flagging (Suspicious/Reviewed/Noteworthy), multi-file workspace, time-range filter, export. All client-side, MIT licensed, source: https://github.com/Apurvashelar/EVTX-Inspector

Would love feedback if any of you triage Windows logs from non-Windows workstations.
```

### 4.7 SANS ISC contact

URL: https://isc.sans.edu/contact.html

Subject: `Free DFIR tool submission — EVTX Inspector`

Body:
```
Hi ISC team,

I've released a free, MIT-licensed browser-based Windows Event Log analyzer aimed at DFIR analysts working off macOS or Linux: https://evtx-inspector.apurvashelar303.workers.dev/. Source: https://github.com/Apurvashelar/EVTX-Inspector.

It fills a specific gap — Timeline Explorer is Windows-only, and existing browser viewers don't support CSV exports or row flagging. Mine does both, with per-column filters, multi-file investigation, and zero-upload privacy.

Happy to write a guest diary if you'd like, or just leave a pointer here in case any handler finds it useful.

Atharav Hedage
```

### 4.8 AlternativeTo

URL: https://alternativeto.net/software/timeline-explorer/about/ (or search for *Event Log Explorer* / *EvtxECmd* and add it as an alternative there too)

Click **Add a like** → "I know an alternative" → fill in:
- **Name:** EVTX Inspector
- **Description:** (paste the README short description)
- **Platforms:** Web → Mac, Linux, Windows
- **Pricing:** Free, Open Source

Repeat for each existing tool listing in the same problem space.

---

## 5. Long-form / long-tail SEO content

These take an evening each but compound for years. Skip if traffic from §1–4 is enough.

### 5.1 `/about` or `/why` page

Adds a static HTML page with 600–900 words on the problem statement. Targets long-tail queries like *"how to open evtx file on mac"*, *"windows event log viewer for linux"*, *"alternative to timeline explorer mac"*.

I'd need to add a route to the SPA (or a separate static HTML at `public/why.html`). Tell me when you want this and I'll draft the page.

### 5.2 Comparison pages

`/vs/timeline-explorer`, `/vs/event-log-explorer`. Captures users searching by competitor name. Same plan as 5.1 — say the word and I'll write the copy + add the routes.

### 5.3 HowTo schema

After §5.1 is up, I'll add a `HowTo` JSON-LD block to the FAQ entries. That's what makes Google show step-by-step rich results in search.

---

## 6. LinkedIn launch post

Post **once your repo has a ⭐ count > 5** and §3.1/§3.2 PRs have merged — you want at least one signal of credibility before the LinkedIn algorithm decides whether to suppress or amplify.

Post **the GIF as a native upload** (don't link out — LinkedIn deboosts external links). Keep the live-demo URL and GitHub link in the *first comment*, not the post body.

**Post body (paste as-is):**

```
For two years, every time I had to triage a Windows Event Log on my Mac, I'd boot a Windows VM. That's 30 seconds of latency per investigation, multiplied across hundreds of incidents.

Eric Zimmerman's Timeline Explorer is the gold standard for EVTX triage. It runs on Windows only.

CLI tools like Hayabusa and Chainsaw are excellent — but headless. They produce output files, not investigation environments.

Browser-based viewers exist, but none of them support CSV exports from EvtxECmd, none of them let me flag rows mid-investigation, and none of them support per-column filtering the way Timeline Explorer does.

So I built one.

EVTX Inspector is a free, browser-based Windows Event Log analyzer for macOS, Linux, and Windows.
- Native .evtx + CSV file support (EvtxECmd, Hayabusa, Chainsaw, Get-WinEvent)
- Per-column filters with OR logic, time-range picker, global search
- Row flagging — Suspicious / Reviewed / Noteworthy — persists across reloads
- Multi-file workspace
- Zero upload, zero telemetry, zero accounts
- 100% client-side via WebAssembly + Web Workers
- MIT-licensed

If you do DFIR off a non-Windows machine, this is for you.

Live demo and source in the first comment.

#DFIR #IncidentResponse #BlueTeam #Cybersecurity #InfoSec #ThreatHunting
```

**First comment (paste as a reply to your own post):**

```
Live demo: https://evtx-inspector.apurvashelar303.workers.dev/
Source (MIT): https://github.com/Apurvashelar/EVTX-Inspector

Genuine feedback welcome — particularly around EVTX edge cases, CSV column-mapping quirks from tools I haven't tested, and workflows you'd want next.
```

**Hashtag note:** keep it to ~5–6 hashtags. LinkedIn deboosts hashtag-stuffed posts.

**Engagement protocol:**
- Reply to every comment within 30 minutes for the first 4 hours.
- Don't argue with anyone in public. If someone's wrong, say "good point, I'll dig in" and move on.
- Re-share to relevant LinkedIn groups (DFIR, Blue Team, SANS Alumni) one at a time, with a 6-hour gap.

---

## 7. Lighthouse audit (after deploy)

```bash
npx lighthouse https://evtx-inspector.apurvashelar303.workers.dev/ \
  --output=html --output-path=./lighthouse-report.html \
  --chrome-flags="--headless"
open lighthouse-report.html
```

Targets after the §1.1 changes:
- Performance: **95+** (currently ≥ 95 expected; the 374 KB JS is fine because it's a tool, not a content site)
- Accessibility: **100** (the `<h1>` change should get you there)
- Best Practices: **100**
- SEO: **100** (after `<h1>` + prerendered content)

If anything's below target, post the report and I'll fix.

---

## 8. Tracking what's working

Once Cloudflare Web Analytics + Search Console are live, check weekly:

| Source | Metric | Threshold for "working" |
|--------|--------|------------------------|
| Cloudflare Analytics | Daily uniques | > 50/day after week 2 = decent traction |
| Search Console | Impressions for `evtx mac`, `evtx linux`, `windows event log viewer mac` | > 100 impressions/week by week 4 |
| GitHub | Stars, traffic-tab clones | > 25 stars by month 1 = above-average for a niche security tool |
| Referrers | Reddit, LinkedIn, awesome-list domains | If a list-driven referral compounds (returns of new users from awesome-* over weeks), the SEO is working |

**Rule of thumb you'd specifically asked about:** if you cross **500 weekly uniques** sustainably and **2× that growing**, the custom domain investment is justified. Below that, the workers.dev URL is fine.

---

## 9. What you don't need to do

Saving you the rabbit holes:

- ❌ **ProductHunt** — not the right audience for niche security tooling. The DFIR community lives on Reddit/Twitter/Discord, not PH.
- ❌ **Mobile layout optimization** — your PRD explicitly excludes it. Don't bother unless analysts ask.
- ❌ **Image compression** — your assets are already lean (favicon 1KB, og-image 147KB).
- ❌ **AMP / static prerendering frameworks** — overkill. The prerendered `<header>` + `<main>` block in §1.1 covers the SEO need.
- ❌ **Submitting to AddictiveTips, Lifehacker, etc.** — they want consumer software. You'll get crickets.

---

## 10. Checklist (tick as you go)

```
[ ] §1.1 deploy current changes
[ ] §1.2 verify og-image renders on LinkedIn / Twitter / FB validators
[ ] §1.3 Google Search Console verified + sitemap submitted
[ ] §1.4 Bing Webmaster Tools verified + sitemap submitted
[ ] §1.5 Cloudflare Web Analytics enabled
[ ] §2.1 GitHub repo description + topics + website set
[ ] §2.2 repo pinned to profile
[ ] §2.3 v1.0.0 release published
[ ] §2.4 issue templates created
[ ] §3.1 awesome-incident-response PR opened
[ ] §3.2 awesome-cybersecurity-blueteam PR opened
[ ] §3.3 awesome-forensics PR opened
[ ] §3.4 awesome-malware-analysis PR opened
[ ] §3.5 awesome-threat-detection PR opened
[ ] §4.1 r/computerforensics post
[ ] §4.2 r/blueteamsec post
[ ] §4.5 Show HN (timed Tue/Wed 8am PST, ≥ 7 days after launch)
[ ] §4.6 DFIR Discord post
[ ] §4.7 SANS ISC email
[ ] §4.8 AlternativeTo entry
[ ] §6 LinkedIn post (after ⭐ > 5)
[ ] §7 Lighthouse audit run + targets met
[ ] §8 weekly metrics review scheduled
```

---

*Last updated: 2026-05-04*
