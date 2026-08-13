# SimplifiedCS — Project Brief for Claude Code

This file is read automatically by Claude Code when working in this repository. It exists so you (Claude Code) have full context without the project owner needing to re-explain history each session. Read this in full before making changes.

---

## 1. What this project is

SimplifiedCS is a cybersecurity self-assessment and compliance-readiness platform for small and medium-sized businesses, built by Sarath as a personal portfolio project (not commercial). The mission, in his own words: making cybersecurity accessible to everyone, minimizing risk with existing tools and minimal cost — not a replacement for a real security program, but a genuinely useful, low-friction starting point. It's explicitly a work in progress; the "About" page invites feedback.

**Live site:** https://simplifiedcs.net (and www variant)
**Repo:** `Sarath-S-CS/simplifiedcs` on GitHub
**Hosting:** Netlify, auto-deploys on every push to `main`
**Current entry point:** `index.html` at the repo root — this is the *entire* site right now (see §2).

---

## 2. How we got here (read this before judging the current code)

This site was built entirely inside a Claude.ai chat conversation, iteratively, over many sessions — no local dev environment, no git workflow, no build tools. Every change was made by having Claude directly edit one growing HTML file and hand the updated file back for manual upload to GitHub. That's why the current state is:

- **One single `index.html` file, ~4,000+ lines** — HTML structure, all CSS, and all JavaScript (the entire assessment engine, scoring logic, tab routing, everything) inline in one file. No modules, no bundler, no `package.json`.
- **No automated CI** — testing was done ad hoc via Node.js + jsdom scripts run in the sandbox, not committed to the repo.
- **This was a deliberate, reasonable choice at the time** — it kept the project simple enough for Sarath (no coding background) to deploy by literally copy-pasting a file into GitHub's web UI. It is not a mistake or technical debt from ignorance; it's the natural result of the tool used to build it.

**Why we're moving to Claude Code now:** the assessment logic itself is about to get significantly more complex — deep conditional branching, cross-question memory, vendor-specific dropdowns everywhere, framework-specific question injection. That's a genuine software-engineering problem, and continuing to do it via find-and-replace edits on a single 4,000-line file was starting to produce real bugs (duplicate event listeners, orphaned code from partial edits) even before this rewrite. Sarath has approved introducing `package.json` and a real build step to support a properly structured, multi-file codebase going forward.

**Also already built and working, separately from this rewrite:**
- A Supabase project exists (name `simplifiedcs`, region `eu-west-1`, free tier) — created but **not yet wired into the code**. See §7.
- A GitHub Actions workflow (`.github/workflows/keep-supabase-alive.yml`) pings it twice a week to prevent free-tier auto-pause.
- Netlify Forms powers the feedback form on the site (a hidden static form for build-time detection, a real JS-rendered form that submits via `fetch`) — this pattern works and should be preserved as-is if touched.

---

## 3. Your mandate for this phase

**Primary goal:** rebuild the assessment questionnaire into a properly architected, deeply adaptive decision engine, replacing the current flat/lightly-conditional question list — while preserving every other part of the site (visual design, all reference pages, animations, theming, hosting setup) exactly as it is unless a change is explicitly required to support the new assessment logic.

**You have latitude to restructure the codebase** (split into modules, add a build step, introduce `package.json`) but the **visual output and UX of every non-assessment page must remain identical** — same design tokens, same layout, same content — unless the assessment rework specifically requires touching something (e.g., the results screen, since new question categories feed it).

**Run autonomously.** This applies to this phase and every phase after it (see §9 for the exact, narrow list of what actually requires stopping — payment, private data/systems, or legal/ToS issues, nothing broader than that). Proceed through implementation, testing, debugging, and iteration without pausing for anything not on that list.

---

## 4. Non-negotiable engineering ground rules

These come from how this project has been run so far, and matter to Sarath:

1. **Test before you ship.** Every prior session in this project ran a real regression suite (jsdom-based, headless browser simulation) before any file was considered "done." Continue that discipline — write and run real tests for every new branch of assessment logic, not just a manual click-through.
2. **Never silently drop functionality.** This codebase has a specific history of bugs caused by partial edits (a duplicate accordion handler that canceled itself out, an orphaned data structure declaration). When refactoring, verify old behavior is fully replaced, not partially overwritten.
3. **No fabricated data.** Vendor dropdown lists, framework mappings, and any factual claims must be real. If you're not confident a vendor name or fact is accurate, say so rather than inventing one.
4. **Preserve the design system.** CSS custom properties like `--tile-bg`, `--accent-signal`, `--accent-secure`, the glass/blur tile treatment, the dark/light theme switching mechanism, and the existing icon system (`icon()` function with named SVG icons) should be reused, not reinvented, when the new assessment UI needs styling.
5. **Do not touch hosting, DNS, or domain configuration.** That's fully working and out of scope for this phase.
6. **One commit, one PR, not incremental commits.** This supersedes earlier guidance in this file that said the opposite — the reasoning has changed since that was written. Every push (including to a branch with an open PR, if Deploy Previews are on) can trigger a Netlify build, and this project has already hit real build-minute usage pressure on the free tier. Do all implementation, testing, self-review, and debugging locally/in your own working process, and land the result as a single, clean commit inside a single PR — not a visible trail of iterative commits each triggering their own build. Fix your own mistakes before they become a commit, not with a follow-up commit.

---

## 5. The assessment rebuild — full requirements

This is the complete, disambiguated spec. Where Sarath's original wording had ambiguity, the resolution is stated explicitly — implement it as written here.

### 5.1 Region / geography question
- Regions become: **European Union, United Kingdom, North America** (renamed from "United States"), **South America, Middle East, Africa**, plus a top-level **Global** option.
- **Global is a distinct standalone option**, visually separated from the rest — not a checkbox living among individual countries.
- Below/alongside it, a **dropdown listing every country alphabetically, each with its own checkbox**, for granular multi-country selection.
- This is a **multi-select** overall (a company can operate in several regions and/or several specific countries at once).
- **Framework-recommendation logic per region stays exactly as currently implemented** — do not change which frameworks map to which regions, only the region *input* mechanism.

### 5.2 Team structure — restructured as a real sequence, not one flat question

**Step 1 — new first question:** "Do you have a dedicated IT or cybersecurity team?" with exactly these options:
  - Yes, only a dedicated IT team maintaining infrastructure
  - Yes, dedicated IT and cybersecurity team
  - Our IT team takes care of both IT and cybersecurity
  - IT services outsourced with no internal IT team

**Step 2 — headcount, conditionally shaped by Step 1's answer:**
  - If IT and cybersecurity are separate dedicated teams → ask headcount for **each** separately.
  - If one team covers both → ask **one combined** headcount question.
  - If outsourced with no internal team → **skip headcount entirely**, move to Step 3.

**Step 3 — "How is cybersecurity managed day to day?"**
Expand the option set to include, in addition to whatever already exists in the current build:
  - In-house team manages everything, no services outsourced
  - Some services managed in-house, some outsourced
  - Completely outsourced to MSP
  - Some services managed in-house, some by MSP, some by other outsourced providers
  - MDR service and dedicated MSP
  - MSSP

**Implementation note — read this carefully:** these options have real overlap (an org can have an MSP *and* a separate MDR vendor *and* describe their overall posture as MSSP-like). Sarath was informed of this ambiguity and given the choice between a flat single-select list (as literally specified above) or converting this into a **multi-select** so downstream granular follow-ups can trigger correctly per selected service. **Confirm with Sarath which structure he wants before building this specific question** if it wasn't already resolved in your onboarding conversation with him — this is the one piece of §5 genuinely worth a clarifying question, everything else in this document should be built without asking.

**Step 4 — conditional follow-ups per Step 3 answer**, for example:
  - "Everything managed in-house" → follow up: "Does this include a dedicated SOC, incident response, and forensics/recovery capability?"
  - "No dedicated IT/cybersecurity team" (from Step 1) → the day-to-day question should adapt to ask specifically whether all services are handled by one dedicated MSP or by different providers per service type, then branch further: is SOC managed by a third party? Is there a cyber insurance provider? Who owns post-incident recovery?

This last example is illustrative, not exhaustive — **design the full branching tree for every realistic combination** of Step 1–3 answers, not just the one example given. Think through: what does a company with an MSSP need to be asked next that's different from a company with pure in-house? What does "some in-house, some outsourced" need to clarify (which specific functions are outsourced)?

### 5.3 Vendor fields — dropdown + "Other" pattern, applied everywhere

Every field asking for a specific vendor/product name (this list is a floor, not a ceiling — apply the pattern to every such field in the questionnaire, including ones not listed here if you find them):
- **New question**: "Do you have an antivirus solution?" — asked **before** the existing EDR question, as its own step.
- EDR vendor
- Email security vendor
- DLP vendor
- SD-WAN vendor
- Edge device vendor
- Hosting provider
- Cloud provider
- Security awareness/LMS platform
- MSP/MDR/MSSP provider name(s)

**Pattern for all of these:** a dropdown of real, well-known vendors in that category, plus an **"Other"** option. Selecting "Other" reveals a text input labeled "Please specify." Do not fabricate vendor names — use genuinely known, real products for each category.

### 5.4 External-facing scope, broadened
Wherever the questionnaire currently asks about "external website" or similar, broaden the scope to explicitly include: any customer-facing web application, payment gateways, and any other type of externally-reachable online service (APIs, portals, etc.) — not just a marketing website.

### 5.5 Containerization/virtualization — decoupled from DevSecOps
**Currently wrong, must be fixed:** containerization/virtualization questions only appear if the user answers "yes" to developing custom software. This is incorrect — an organization can run containers or hypervisors for file servers, intranet sites, or other infrastructure with zero custom development happening.

**Fix:** ask "Do you use containerization or virtualization solutions?" as its **own independent top-level question**, regardless of the custom-software answer. Build appropriate follow-ups based on the response (which technologies, how they're secured, etc.) — improvise reasonable, genuinely useful follow-up questions here, matching the depth of the rest of the assessment.

DevSecOps/Infrastructure-as-Code/pipeline-tooling questions remain conditional on **custom software development** specifically (this part of the current logic is correct and should stay conditional the way it already is) — just no longer entangled with the containerization question.

### 5.6 Compliance frameworks must actually do something
Currently, selecting a compliance framework (ISO 27001, GDPR, HIPAA, SOC 2, PCI DSS, SOX, Cyber Essentials, NIS2) has no downstream effect — no framework-specific questions, no framework-specific recommendations. **Fix this**: each selected framework should inject a small, genuinely relevant set of framework-specific questions into the assessment, and the results/recommendations should reflect compliance-specific guidance tied to what was actually selected. Keep each framework's injected question set focused (a handful of high-value questions, not an exhaustive audit) — this should feel like a natural extension of the existing question flow, not a bolted-on separate section.

### 5.7 Security awareness — go deeper
If the user indicates they run security awareness training, follow up with:
- What is the actual policy/cadence for security awareness training (ad hoc, annual, ongoing/continuous)?
- Do they run phishing simulation tests? (Note: a phishing-simulation question already exists in the current build under the Protect function — integrate with it rather than duplicating.)

### 5.8 New depth questions — defense in depth, least privilege, people/process/technology
Add genuinely useful questions covering:
- How are privileged accounts managed — domain admins, database admins, local/server administrators?
- What is the organization's password policy (length, complexity, rotation, MFA enforcement)?
- Do administrators use the same account for daily work and admin activity, or do they have dedicated admin accounts with just-in-time privileged access?
- Do they use a password management tool?
- Are AI tools used within the organization? If so, how is usage tracked, and is there a governance policy for AI tool use?

These should be woven into the existing NIST-function scoring (see §5.9) at the functions where they naturally belong (Protect, Govern, Identify), not dumped into an unrelated new section.

### 5.9 Stop exposing NIST function names as the primary navigation/grouping
Currently, questions are grouped and visibly labeled by their NIST CSF function (Govern, Identify, Protect, Detect, Respond, Recover) as the user-facing category structure. **Change this**: group and label questions under natural, intuitive category headings that make sense to a business owner (e.g., "Your Team & Vendors," "Access & Identity," "Data & Systems," "Detection & Monitoring," "Incident Readiness," "Recovery & Continuity" — these are suggestions, design better ones if you have them). **Scoring must still map internally to the correct NIST CSF function per question** — this is a presentation-layer change only, the underlying scoring model and function-based percentage breakdown on the results page must be preserved exactly.

### 5.10 No redundant questions, ever, across any branch
Build and maintain a session-scoped "already answered" memory as the user progresses through the adaptive tree. If two different branches would otherwise ask a question that's functionally the same (e.g., a follow-up under "day-to-day management" asks about MSP details, and a later section would normally also ask about MSP relationship) — **detect this and skip the duplicate**, carrying the already-provided answer forward into scoring/results instead of re-prompting.

At the end of the assessment, all collected data — regardless of which branch it came from — must be correctly collated into the existing results/scoring pipeline (the six NIST function scores, the compounding-risk flag detection, the vendor-mitigation-notes matching, and now the new framework-specific recommendations from §5.6).

---

## 6. Suggested technical approach (your call on specifics)

You have discretion on exact implementation, but here's a reasonable direction given the requirements above:

- Model the questionnaire as an explicit **directed graph / decision tree data structure** (not ad hoc `if` chains scattered through render functions) — something like a `questions.js` module defining nodes with `id`, `prompt`, `type`, `options`, `nextNode(answers)` (a function of everything answered so far, not just the immediately preceding question), and `scoresTo` (which NIST function + weight this question contributes to).
- A separate **session state module** tracking: answers given so far, which question IDs have been "asked" (for de-duplication per §5.10), current position in the tree, and computed running scores.
- Keep the **existing visual rendering system** (the `.question`, `.option`, `.fw-card` CSS patterns, the wizard nav/rail) and adapt it to render from the new data-driven tree, rather than rebuilding the UI layer from scratch.
- A real test suite (Node + jsdom, matching the existing project convention) that walks multiple realistic branch combinations end-to-end and asserts no duplicate questions, correct scoring, and correct final recommendations.

---

## 7. Context for later — not this phase's job, but you should know it's coming

Sarath's eventual goal for this site (explicitly **not** part of this rebuild — flagging so you don't accidentally scope-creep into it) includes:
- **Wiring the existing Supabase project** in as the real backend, replacing the current session-only storage for History/resume-progress.
- **A real AI-generated report**, replacing the current rules-engine-based recommendations with an actual Claude API call at results time.
- **A RAG (retrieval-augmented generation) layer** feeding that report call — retrieving current vendor advisories/CVE data rather than the current static, illustrative vendor-notes matching.

If restructuring the codebase in a way that makes *those* future integrations easier is low-cost and doesn't compromise this phase's actual goal, prefer that structure. But do not attempt to build any of §7 now — it's out of scope for this phase.

---

## 8. Getting access — what needs to happen before you can work

Claude Code needs to authenticate against GitHub (and, if you're expected to also handle deployment verification, Netlify) using Sarath's own credentials. **These are login steps Sarath needs to run himself** — no AI agent, including this one, should ever handle account credentials or OAuth flows on a user's behalf. Prompts for Sarath to run in his terminal before starting a Claude Code session:

```bash
# Authenticate the GitHub CLI (one-time, opens a browser to log in)
gh auth login

# Clone the repo (if not already local)
gh repo clone Sarath-S-CS/simplifiedcs
cd simplifiedcs

# Optional: Netlify CLI, only needed if Claude Code should verify deploys directly
npm install -g netlify-cli
netlify login
netlify link   # links this local folder to the existing simplifiedcs Netlify site
```

Once authenticated locally, starting Claude Code in this repo folder will pick up this `CLAUDE.md` automatically.

**Supabase reference, for when §7 work actually begins** (not needed for this phase, included for completeness):
- Project name: `simplifiedcs`
- Region: `eu-west-1`
- Project URL: `https://xufqgrcxufptlptpwlfi.supabase.co`
- The project's publishable (safe-to-expose) API key is already committed in `.github/workflows/keep-supabase-alive.yml`. The secret/service-role key is **not** stored anywhere in this repo and should never be committed.

---

## 9. Autonomy boundary — read this before starting anything

**The explicit scope of what requires stopping and asking Sarath, and nothing beyond it:**

1. Anything involving **real payment** or purchasing/creating a new paid service.
2. Anything that would access **data or systems private to someone else** (not Sarath's own accounts/repos/services already granted to you).
3. Anything that would **breach a law or a platform's terms of service**.

That's the complete list. Everything else in this document — implementation decisions, refactoring choices, how deep to go on a given piece, resolving ambiguity you can reason through yourself — should proceed without a check-in. Don't pause for permission on engineering judgment calls; use the reasoning already laid out in this file and in the relevant phase brief, and make the call.

**One necessary exception to "don't stop":** the `gh auth login` / `netlify login` steps in §8 involve Sarath's real account credentials and cannot be performed by any agent, full stop — that's not a judgment call, it's a hard constraint shared by every Anthropic agent product. Everything past that authentication step should run uninterrupted.

### Pre-flight check — do this first, before writing any code

Before starting implementation, verify you actually have everything you'll need: repo access, any required CLI tools installed, and awareness of which MCP connectors, skills, or permissions (if you're running with any available) would help versus which are missing entirely. **If something is missing, ask for it once, up front, before starting** — not discovered and stalled on halfway through a task. The goal is zero mid-task interruptions for anything that could have been identified at the very start.

### Delivery — single commit, single PR (see the ground rules in §4 above)

Do not push work-in-progress commits. Debug and self-correct before committing, then land everything as one commit in one PR, and let Sarath do a final review before merge — `main` auto-deploys to production via Netlify, so treat it as live.
