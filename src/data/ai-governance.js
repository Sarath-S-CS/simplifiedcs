// AI-READINESS-GOVERNANCE-BRIEF.md §2 — the branching/scoping half of the
// "AI Readiness & Governance" track, following EC-Council's ADG (Adopt/
// Defend/Govern) framework's three-pillar structure. Unscored ("profile")
// nodes - they determine WHICH downstream AI questions apply, the same
// role team-structure.js's gate/multi-select plays for that section.
//
// Deliberately small: just the gate, the usage-scoping multi-select, and
// the one branch-defining follow-up (does a custom app retrieve internal
// data). The actual scored security-posture questions this gates -
// aiRagPermissions, aiCodeReviewParity, aiDeepfakeTraining,
// aiVerificationStep, aiRiskOwnership - live as real NIST_QUESTIONS
// entries in nist-questions.js instead, so they carry real scoring
// weight, MITRE mapping, and gap/priority visibility the way every other
// scored question does, including a "Not sure" option.
//
// aiToolGovernance already exists in nist-questions.js's Govern section
// (asked unless AI use was ruled out, "Is the use of AI tools tracked and
// governed?") and covers both of the brief's two "general
// questions" (a written policy, and visibility into unsanctioned tool use)
// in one blended 0/1/2 scale - so those two aren't duplicated here. §5.10's
// own principle ("detect real duplicates, don't re-prompt") argues against
// adding them a second time in more granular form, even though the brief's
// own wording didn't know that question already existed.
export const AI_GOVERNANCE_ORDER = ["aiUsage", "aiUsageTypes", "aiCustomAppRAG"];

// Exported so nist-questions.js's downstream scored questions and
// scoring.js's compounding-risk flag can gate on the exact same option ids
// without a second, driftable copy of the list.
export const AI_USAGE_TYPE_OPTIONS = [
  { id: "enterprise-ai", label: "Enterprise/licensed AI platforms (e.g. ChatGPT Enterprise, Microsoft Copilot, Claude for Enterprise)" },
  { id: "free-personal-ai", label: "Free or personal-tier AI tools used informally by employees" },
  {
    id: "embedded-ai",
    label:
      "AI features already built into other software you use - collaboration tools (e.g. Atlassian Rovo), CRM (Salesforce Einstein/Agentforce), ITSM (ServiceNow Now Assist), your security stack itself (Microsoft Security Copilot, CrowdStrike Charlotte AI, SentinelOne Purple AI), or industry-specific systems (e.g. Epic's ambient AI scribe in healthcare) - often auto-enabled by the vendor, not a decision anyone in your organization actively made",
  },
  { id: "ai-dev-tools", label: "AI-assisted software development tools (e.g. GitHub Copilot, IDE-integrated AI plugins, coding assistants)" },
  { id: "ai-cicd", label: "AI used within CI/CD pipelines or DevSecOps tooling" },
  { id: "custom-ai-app", label: "A custom-built AI application (an internal chatbot, a RAG system, an internal agent)" },
];

function aiUsageIsYes(answers) {
  return answers.aiUsage === "Yes, broadly across the organization" || answers.aiUsage === "Yes, limited to specific teams or tools";
}
function usesType(answers, id) {
  return (answers.aiUsageTypes || []).includes(id);
}
// Exported for nist-questions.js's visibleIf conditions, so "is AI-assisted
// dev tooling in use" is defined once, not re-typed at each call site.
export function usesAiDevOrCicd(answers) {
  return usesType(answers, "ai-dev-tools") || usesType(answers, "ai-cicd");
}
export function usesCustomAiApp(answers) {
  return usesType(answers, "custom-ai-app");
}

export const AI_GOVERNANCE_NODES = [
  {
    id: "aiUsage",
    kind: "profile",
    category: "ai",
    type: "select",
    text: "Do you currently use AI tools in your environment?",
    options: ["Yes, broadly across the organization", "Yes, limited to specific teams or tools", "No, not currently", "Not sure"],
    required: true,
  },
  {
    id: "aiUsageTypes",
    kind: "profile",
    category: "ai",
    type: "multiselect",
    text: "Which of the following describes how AI is used in your environment? (select all that apply)",
    options: AI_USAGE_TYPE_OPTIONS,
    allowOther: true,
    otherPlaceholder: "e.g. a vendor-specific AI feature not listed above",
    required: true,
    visibleIf: aiUsageIsYes,
  },
  {
    id: "aiCustomAppRAG",
    kind: "profile",
    category: "ai",
    type: "select",
    text: "Does this application retrieve or reference your own internal documents or data?",
    options: ["Yes", "No"],
    required: true,
    visibleIf: (answers) => usesCustomAiApp(answers),
  },
];
