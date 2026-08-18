// §5.2 — team structure as a real branching sequence, replacing the old
// flat itSecStaff/secManagedBy/mdrMspName fields. Unscored ("profile")
// nodes - they feed computeFlags()/snapshotRows() the same way the fields
// they replace did, not the six NIST function scores.
//
// Multi-select confirmed with Sarath for the day-to-day question (2026-08-11):
// an org can simultaneously have an MSP, a separate MDR vendor, and describe
// its posture as MSSP-like, so downstream follow-ups need to fire per
// selected option rather than off one flat answer.
//
// Provider-name fields use the §5.3 dropdown+"Other" pattern, same as the
// infra vendor fields.
import { MSP_VENDORS, MDR_VENDORS, MSSP_VENDORS, OTHER } from "./vendors.js";

const HEADCOUNT_OPTIONS = ["1–2", "3–10", "10+"];

function profile(id, text, extra) {
  return { id, kind: "profile", category: "team", type: "select", text, ...extra };
}
function vendorField(id, text, vendorOptions, extra) {
  return { id, kind: "profile", category: "team", type: "vendor", text, vendorOptions, required: false, ...extra };
}

export const TEAM_STRUCTURE_ORDER = [
  "teamDedicated",
  "itOnlyHeadcount",
  "itHeadcountSeparate",
  "cybersecHeadcount",
  "combinedHeadcount",
  "outsourcedStructure",
  "outsourcedMspName",
  "outsourcedFunctionBreakdown",
  "dayToDay",
  "inhouseSocCapability",
  "partialOutsourceFunctions",
  "fullMspProviderName",
  "mspSocOwner",
  "mixedMspProviderName",
  "mixedOtherProviderDetail",
  "mdrProviderName",
  "mdrMspProviderName",
  "msspProviderName",
  "socOwnership",
  "cyberInsurance",
  "incidentRecoveryOwner",
];

const a = (answers) => answers; // readability alias

// Exported separately (rather than only inline on the dayToDay node) so
// snapshot.js can map the stored option ids back to display labels without
// reaching into TEAM_STRUCTURE_NODES.
export const DAY_TO_DAY_OPTIONS = [
  { id: "inhouse-all", label: "In-house team manages everything, no services outsourced" },
  { id: "partial-outsource", label: "Some services managed in-house, some outsourced" },
  { id: "full-msp", label: "Completely outsourced to MSP" },
  { id: "mixed-msp-other", label: "Some services managed in-house, some by MSP, some by other outsourced providers" },
  { id: "mdr-msp", label: "MDR service and dedicated MSP" },
  { id: "mssp", label: "MSSP" },
];

// REDUNDANCY-AUDIT-BRIEF.md §1: shared across every "which functions are
// outsourced" question below (previously three separate free-text fields -
// partialOutsourceFunctions, outsourcedFunctionBreakdown,
// mixedOtherProviderDetail - each a case where a later question, socOwnership,
// needed to reliably know whether SOC/monitoring specifically was already
// covered. Free text can't be cross-referenced; a shared checkbox list can.
export const OUTSOURCED_FUNCTION_OPTIONS = [
  { id: "soc-monitoring", label: "SOC / monitoring" },
  { id: "incident-response", label: "Incident response" },
  { id: "patch-management", label: "Patch management" },
  { id: "backup-dr", label: "Backup / DR" },
  { id: "firewall-management", label: "Firewall management" },
  { id: "email-security", label: "Email security" },
];

// Maps a selected-functions answer to socOwnership's own vocabulary, only
// when SOC/monitoring specifically was selected - returning undefined for
// every other case leaves socOwnership's dedupeKey unset, so it's still
// asked normally when this answer doesn't actually resolve it. "Hybrid" is
// the correct mapping regardless of which node this fires from: all three
// reuse this same helper, and in every one of their branches the user has
// already told us *some* functions are in-house and others are outsourced
// (that's what put them on this branch in the first place) - so SOC being
// among the outsourced ones is a hybrid arrangement by definition, not a
// guess at what "Same MSP"-style wording would map to.
function outsourcedFunctionsDedupeValue(selected) {
  const ids = Array.isArray(selected) ? selected : [];
  return ids.includes("soc-monitoring") ? "Hybrid - some in-house, some third-party" : undefined;
}

export const TEAM_STRUCTURE_NODES = [
  // ---- Step 1 ----
  {
    ...profile("teamDedicated", "Do you have a dedicated IT or cybersecurity team?"),
    options: [
      "Yes, only a dedicated IT team maintaining infrastructure",
      "Yes, dedicated IT and cybersecurity team",
      "Our IT team takes care of both IT and cybersecurity",
      "IT services outsourced with no internal IT team",
    ],
    required: true,
    next(answers) {
      switch (a(answers).teamDedicated) {
        case "Yes, only a dedicated IT team maintaining infrastructure":
          return "itOnlyHeadcount";
        case "Yes, dedicated IT and cybersecurity team":
          return "itHeadcountSeparate";
        case "Our IT team takes care of both IT and cybersecurity":
          return "combinedHeadcount";
        case "IT services outsourced with no internal IT team":
          return "outsourcedStructure";
        default:
          return null; // not yet answered - stop here rather than guessing a branch
      }
    },
  },

  // ---- Step 2: headcount (shape depends on Step 1) ----
  {
    ...profile("itOnlyHeadcount", "How many people are on your dedicated IT team?"),
    options: HEADCOUNT_OPTIONS,
    required: true,
    next: () => "dayToDay",
  },
  {
    ...profile("itHeadcountSeparate", "How many people are on your dedicated IT team (infrastructure/operations, separate from cybersecurity)?"),
    options: HEADCOUNT_OPTIONS,
    required: true,
    next: () => "cybersecHeadcount",
  },
  {
    ...profile("cybersecHeadcount", "How many people are on your dedicated cybersecurity team?"),
    options: HEADCOUNT_OPTIONS,
    required: true,
    next: () => "dayToDay",
  },
  {
    ...profile("combinedHeadcount", "How many people are on your combined IT & cybersecurity team?"),
    options: HEADCOUNT_OPTIONS,
    required: true,
    next: () => "dayToDay",
  },

  // ---- No internal team branch (Step 1 = outsourced) ----
  // CLAUDE.md's worked example for this branch: "ask specifically whether
  // all services are handled by one dedicated MSP or by different providers
  // per service type, then branch further: is SOC managed by a third party?
  // Is there a cyber insurance provider? Who owns post-incident recovery?"
  {
    ...profile("outsourcedStructure", "Are your IT and cybersecurity services handled by one dedicated provider, or by different providers per service type?"),
    options: [
      "One dedicated MSP handles everything",
      "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)",
      "No formal outsourced arrangement - handled ad hoc",
    ],
    required: true,
    next(answers) {
      switch (a(answers).outsourcedStructure) {
        case "One dedicated MSP handles everything":
          return "outsourcedMspName";
        case "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)":
          return "outsourcedFunctionBreakdown";
        case "No formal outsourced arrangement - handled ad hoc":
          return "socOwnership";
        default:
          return null; // not yet answered
      }
    },
  },
  {
    ...vendorField("outsourcedMspName", "Which MSP provides this coverage?", MSP_VENDORS),
    dedupeKey: "mspProviderName",
    next: () => "socOwnership",
  },
  {
    id: "outsourcedFunctionBreakdown",
    kind: "profile",
    category: "team",
    type: "multiselect",
    text: "Which specific functions are handled by your outsourced provider(s)? (select all that apply)",
    options: OUTSOURCED_FUNCTION_OPTIONS,
    allowOther: true,
    otherPlaceholder: "e.g. MSP: Kyndryl (infrastructure); MDR: Arctic Wolf (monitoring)",
    required: false,
    dedupeKey: "socOwnership",
    dedupeValue: outsourcedFunctionsDedupeValue,
    next: () => "socOwnership",
  },

  // ---- Step 3: day-to-day management (multi-select) ----
  {
    id: "dayToDay",
    kind: "profile",
    category: "team",
    type: "multiselect",
    text: "How is cybersecurity managed day to day? (select all that apply)",
    options: DAY_TO_DAY_OPTIONS,
    required: true,
    visibleIf: (answers) => a(answers).teamDedicated !== "IT services outsourced with no internal IT team",
    next: () => "inhouseSocCapability",
  },
  {
    id: "inhouseSocCapability",
    kind: "profile",
    category: "team",
    type: "select",
    text: "Does your in-house coverage include a dedicated SOC, incident response, and forensics/recovery capability?",
    options: ["Yes, all three in-house", "Some in-house, some gaps", "No dedicated SOC/IR/forensics capability"],
    required: true,
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("inhouse-all"),
    next: () => "partialOutsourceFunctions",
  },
  {
    id: "partialOutsourceFunctions",
    kind: "profile",
    category: "team",
    type: "multiselect",
    text: "Which specific functions are outsourced? (select all that apply)",
    options: OUTSOURCED_FUNCTION_OPTIONS,
    allowOther: true,
    required: false,
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("partial-outsource"),
    // REDUNDANCY-AUDIT-BRIEF.md §1 - the confirmed bug: this used to be
    // free text, so there was no reliable way to know whether "SOC/
    // monitoring" was already covered here before socOwnership asked again
    // below. Now that it's structured, array-membership answers that
    // reliably.
    dedupeKey: "socOwnership",
    dedupeValue: outsourcedFunctionsDedupeValue,
    next: () => "fullMspProviderName",
  },
  {
    ...vendorField("fullMspProviderName", "Which MSP is it completely outsourced to?", MSP_VENDORS),
    dedupeKey: "mspProviderName",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("full-msp"),
    next: () => "mspSocOwner",
  },
  {
    id: "mspSocOwner",
    kind: "profile",
    category: "team",
    type: "select",
    text: "Is SOC/security monitoring handled by that same MSP, or a separate third party?",
    options: ["Same MSP", "Separate third party", "No SOC/monitoring in place"],
    required: true,
    // REDUNDANCY-AUDIT-BRIEF.md §1: this is the same underlying fact as
    // socOwnership below (who handles SOC/monitoring) asked with
    // full-msp-specific framing - dedupeKey means whichever fires first
    // silently carries its answer forward instead of asking again.
    dedupeKey: "socOwnership",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("full-msp"),
    next: () => "mixedMspProviderName",
  },
  {
    ...vendorField("mixedMspProviderName", "In the mixed arrangement, which MSP is involved?", MSP_VENDORS),
    dedupeKey: "mspProviderName",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("mixed-msp-other"),
    next: () => "mixedOtherProviderDetail",
  },
  {
    id: "mixedOtherProviderDetail",
    kind: "profile",
    category: "team",
    type: "multiselect",
    text: "Which specific functions do those other outsourced providers handle? (select all that apply)",
    options: OUTSOURCED_FUNCTION_OPTIONS,
    allowOther: true,
    otherPlaceholder: "e.g. Backup/DR outsourced to a separate managed backup vendor",
    required: false,
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("mixed-msp-other"),
    dedupeKey: "socOwnership",
    dedupeValue: outsourcedFunctionsDedupeValue,
    next: () => "mdrProviderName",
  },
  {
    ...vendorField("mdrProviderName", "Which MDR service do you use?", MDR_VENDORS),
    dedupeKey: "mdrProviderName",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("mdr-msp"),
    next: () => "mdrMspProviderName",
  },
  {
    ...vendorField("mdrMspProviderName", "And which MSP handles the rest of IT alongside that MDR service?", MSP_VENDORS),
    dedupeKey: "mspProviderName",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("mdr-msp"),
    next: () => "msspProviderName",
  },
  {
    ...vendorField("msspProviderName", "Which MSSP do you use?", MSSP_VENDORS),
    dedupeKey: "msspProviderName",
    visibleIf: (answers) => (a(answers).dayToDay || []).includes("mssp"),
    next: () => "socOwnership",
  },

  // ---- Shared accountability follow-ups (fire once, regardless of which
  // branch triggered outsourcing - dedupeKey prevents any of them being
  // asked twice per §5.10) ----
  {
    id: "socOwnership",
    kind: "profile",
    category: "team",
    type: "select",
    text: "Is SOC / security monitoring managed by a third party, or in-house?",
    options: ["Fully third-party", "Hybrid - some in-house, some third-party", "Fully in-house"],
    required: true,
    dedupeKey: "socOwnership",
    visibleIf: (answers) => {
      const ans = a(answers);
      if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
      const d = ans.dayToDay || [];
      return d.some((id) => id !== "inhouse-all");
    },
    next: () => "cyberInsurance",
  },
  {
    id: "cyberInsurance",
    kind: "profile",
    category: "team",
    type: "select",
    text: "Do you have a cyber insurance policy?",
    options: ["Yes", "No", "Not sure"],
    required: true,
    dedupeKey: "cyberInsurance",
    visibleIf: (answers) => {
      const ans = a(answers);
      if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
      const d = ans.dayToDay || [];
      return d.some((id) => id !== "inhouse-all");
    },
    next: () => "incidentRecoveryOwner",
  },
  {
    id: "incidentRecoveryOwner",
    kind: "profile",
    category: "team",
    type: "select",
    text: "Who owns post-incident recovery - your internal team, your MSP/MSSP, or a separate incident-response retainer firm?",
    options: ["Internal team", "MSP/MSSP", "Dedicated IR retainer firm", "Not defined"],
    required: true,
    dedupeKey: "incidentRecoveryOwner",
    visibleIf: (answers) => {
      const ans = a(answers);
      if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
      const d = ans.dayToDay || [];
      return d.some((id) => id !== "inhouse-all");
    },
  },
];
