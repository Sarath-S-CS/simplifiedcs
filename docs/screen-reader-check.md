# Screen-reader check (NVDA, about 30 minutes)

Automated checking (`npm run a11y`, which runs axe-core on every page in both themes) finds
problems like low contrast, missing labels and broken ARIA. It can't tell whether the site *makes
sense* when it's read aloud. This is a short manual pass to answer that, written so it can be
done without development experience. Do it after changes to navigation, the assessment or the
report, and at least once per release.

## Set up (once)

1. Install **NVDA**, the free Windows screen reader, from <https://www.nvaccess.org/download/>.
   Use it with Chrome, Edge or Firefox.
2. The keys you need. **NVDA key** means the Insert key (or Caps Lock if you choose that in NVDA's
   settings).

   | Key | What it does |
   |---|---|
   | Ctrl | Stop speaking |
   | Tab / Shift+Tab | Next / previous control (link, button, field) |
   | H / Shift+H | Next / previous heading |
   | 1 … 4 | Next heading of that level |
   | D | Next landmark (banner, navigation, main, footer) |
   | Down arrow | Read the next line |
   | Enter / Space | Activate a link or button; tick a checkbox |
   | Arrow keys in a group of options | Move between radio buttons |
   | NVDA+F7 | List of all headings, links and landmarks on the page |
   | NVDA+Space | Switch between reading the page and typing into a field |

3. Turn the speech rate down if it's too fast: NVDA menu (NVDA+N) → Preferences → Settings →
   Speech → Rate.

Open <https://simplifiedcs.net> (or the local copy: `npm run build`, `npm run prerender`,
`node scripts/serve.js`, then <http://localhost:5173>). Use fictional answers in the assessment -
never your company's real details.

## Checklist

For each step, note **Pass** or **Fail** and, for a fail, what NVDA actually said. "Expected" is
what should happen today.

### 1. Getting around

| # | Do this | Expected |
|---|---|---|
| 1.1 | Load the home page, press **Tab** once. | "Skip to main content, link" - and the link appears at the top left of the screen. |
| 1.2 | Press **Enter** on it. | NVDA reads the page's main heading. Pressing Tab again moves into the page, not the menu. |
| 1.3 | Press **NVDA+F7**, choose "Landmarks". | Banner, Main navigation, Main, Content info (the footer). |
| 1.4 | In the same dialog, choose "Headings". | One level-1 heading (SimplifiedCS), then the page title at level 2, and sections below it in a sensible order. |
| 1.5 | Tab to "Framework" in the menu and follow a link to another page (e.g. Methodology). | NVDA reads the new page's title (e.g. "Methodology, heading level 2"). You shouldn't have to hunt for where the new page starts. |
| 1.6 | Tab to the theme switch at the top right and press **Space**. | "Light mode, switch, off" before; "on" after. The page changes theme. |

### 2. Content pages with expandable sections

| # | Do this | Expected |
|---|---|---|
| 2.1 | Go to **Playbooks**. Press **H** until you reach "Broken Access Control". | "Broken Access Control OWASP WEB, heading level 4" - the section titles are headings you can jump between. |
| 2.2 | Press **Tab** to reach it as a control. | "Broken Access Control OWASP WEB, button, collapsed". |
| 2.3 | Press **Enter**. Then **Down arrow**. | "Expanded". Reading on continues into the section's content. |
| 2.4 | Press **Enter** again. | "Collapsed". |
| 2.5 | Repeat 2.1-2.3 on **Starter Guide** and **Runbooks**. | Same behaviour. |

### 3. Assessment (Quick screening)

| # | Do this | Expected |
|---|---|---|
| 3.1 | Go to **Assessment**. Tab to "Quick screening". | A button whose name includes "14 questions" and "Quick screening". |
| 3.2 | Press **Enter**. | NVDA reads the new step's heading. |
| 3.3 | Tab to the industry choices. | The group is announced as "Industry, required", then the option, e.g. "SaaS / Technology, radio button, not checked". Arrow keys move between options. |
| 3.4 | Choose one, Tab to "Start", press **Enter**. | NVDA reads the next screen's heading. Before an industry is chosen the button says "Choose an industry to start" and is announced as unavailable. |
| 3.5 | Answer each question with the arrow keys. | Each question is read as the group's name, before its options. Your place (focus) isn't lost after answering. |
| 3.6 | On the last question, "See the report" or "Continue". | NVDA reads the report's heading. |

### 4. The report

| # | Do this | Expected |
|---|---|---|
| 4.1 | Press **H** repeatedly through the report. | Headings for the reading (the verdict), "Critical gaps", "Action plan", "Combined findings" and so on. Each action in the plan is a heading too. |
| 4.2 | Tab to the first action. | "…, button, collapsed". **Enter** opens it and reveals the tracking fields. |
| 4.3 | Change the action's status field. | NVDA says "Saved". Focus stays on the field you changed. |
| 4.4 | Find "AI-enhanced insights". | A checkbox "I agree to send these assessment details…", not ticked. The request button can't send anything until it is ticked. Don't send a request during this check. |
| 4.5 | Find "Download PDF" and the export buttons. | Each is announced as a button with a clear name ("Download PDF", "Action plan (JSON)", …). |

### 5. Privacy and the cookie banner

| # | Do this | Expected |
|---|---|---|
| 5.1 | In a private window, load the home page. | The cookie banner appears and focus is on "No thanks". NVDA reads the button; Down arrow / Shift+Tab reads the banner text. |
| 5.2 | Press **Enter** on "No thanks". | The banner closes. |
| 5.3 | Go to **Privacy** (footer). Press **H** through the page. | Section headings: Your assessment answers, What's stored in this browser, Analytics, Live feeds, Hosting, Questions. |
| 5.4 | Activate "Clear all data stored by this site", confirm. | NVDA reads the result, e.g. "Removed 3 stored items". |

## Reporting what you find

Copy this into a message for Claude (or a GitHub issue), one line per failure:

```
Step 2.2 on /playbooks - expected "button, collapsed", NVDA said "clickable Broken Access Control".
Browser: Chrome 1xx, NVDA 2026.x
```

Include the page address, the step number, and what NVDA said word for word. That's enough to
reproduce and fix it.

## What was verified automatically

- axe-core 4.13 (WCAG 2.2 A and AA rules): every page and assessment state in `scripts/a11y-audit.js`,
  in both themes, with no violations.
- Keyboard, in headless Chrome: skip link, focus after navigating, Enter/Space on accordions,
  visible focus ring.
- The accessibility tree (what screen readers receive): landmarks, one heading per accordion with a
  button inside that reports expanded/collapsed.

What still needs a person: whether the reading order and announcements make sense end to end, and
anything NVDA says that sounds wrong or confusing. That's this checklist.
