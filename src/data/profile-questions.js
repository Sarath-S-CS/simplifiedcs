// Org profile, infra/vendor, and OT fields. Ported from the original
// PROFILE_STEP/INFRA_STEP/OT_STEP with these deliberate changes:
//  - §5.3: every vendor/product field is now a real dropdown+"Other" picker
//    (see vendors.js for the option lists), and antivirus is split into its
//    own question asked before EDR, rather than one combined free-text field.
//  - §5.4: externalWebsite/webDb wording broadened beyond "website" to cover
//    customer-facing web apps, payment gateways, APIs, and portals.
//  - containerUse/orchestration/virtualization/imageRegistry removed from
//    here - they now live in containerization.js as an independent
//    top-level question (§5.5). devsecopsMaturity/secretsManagement stay
//    gated on developsSoftware only, per CLAUDE.md: that conditional was
//    correct and should stay.
import { INDUSTRIES } from "./industries.js";
import {
  ANTIVIRUS_VENDORS,
  EDR_VENDORS,
  EMAIL_SECURITY_VENDORS,
  DLP_VENDORS,
  SDWAN_VENDORS,
  EDGE_DEVICE_VENDORS,
  HOSTING_PROVIDERS,
  CLOUD_PROVIDERS,
  AWARENESS_LMS_VENDORS,
  OT_ICS_VENDORS,
} from "./vendors.js";

export const ORG_PROFILE_ORDER = ["employeeCount"];

export const ORG_PROFILE_NODES = [
  {
    id: "employeeCount",
    kind: "profile",
    category: "team",
    type: "select",
    text: "How many employees/users are in the organization?",
    options: ["1–10", "11–50", "51–200", "201–1,000", "1,000+"],
    required: true,
  },
];

export const INFRA_ORDER = [
  "hasAntivirus",
  "antivirusVendor",
  "edrVendor",
  "emailSecurityVendor",
  "awarenessLms",
  "dlpUsed",
  "dlpVendor",
  "deployModel",
  "cloudProvider",
  "sdwanUsed",
  "sdwanVendor",
  "networkArch",
  "externalDevices",
  "edgeDeviceVendor",
  "externalWebsite",
  "webDb",
  "hostingProvider",
  "webServerStack",
];

function text(id, category, label, placeholder, extra) {
  return { id, kind: "profile", category, type: "text", text: label, placeholder, required: false, ...extra };
}
function select(id, category, label, options, extra) {
  return { id, kind: "profile", category, type: "select", text: label, options, ...extra };
}
function vendor(id, category, label, vendorOptions, extra) {
  return { id, kind: "profile", category, type: "vendor", text: label, vendorOptions, required: false, ...extra };
}

export const INFRA_NODES = [
  // §5.3: antivirus asked as its own step, before EDR.
  select("hasAntivirus", "infra", "Do you have an antivirus solution?", ["Yes", "No", "Not sure"], { required: true }),
  vendor("antivirusVendor", "infra", "Which antivirus product?", ANTIVIRUS_VENDORS, {
    visibleIf: (answers) => answers.hasAntivirus === "Yes",
    quickSkip: true,
  }),
  vendor("edrVendor", "infra", "What EDR (Endpoint Detection & Response) product is deployed, if any?", EDR_VENDORS, { quickSkip: true }),
  vendor("emailSecurityVendor", "infra", "What email security / anti-phishing gateway do you use, if any?", EMAIL_SECURITY_VENDORS, { quickSkip: true }),
  vendor("awarenessLms", "infra", "What security awareness / LMS platform do you use for training, if any?", AWARENESS_LMS_VENDORS, { quickSkip: true }),
  select("dlpUsed", "infra", "Do you use a DLP (data loss prevention) solution?", ["Yes", "No", "Not sure"], { required: true }),
  vendor("dlpVendor", "infra", "Which DLP product?", DLP_VENDORS, {
    visibleIf: (answers) => answers.dlpUsed === "Yes",
    quickSkip: true,
  }),
  select("deployModel", "infra", "Is your infrastructure on-premises, cloud-only, or hybrid?", ["On-premises only", "Cloud-only", "Hybrid (on-prem + cloud)"], { required: true }),
  vendor("cloudProvider", "infra", "Which cloud provider(s)?", CLOUD_PROVIDERS, {
    visibleIf: (answers) => answers.deployModel && answers.deployModel !== "On-premises only",
    quickSkip: true,
  }),
  // sdwanUsed/sdwanVendor: SD-WAN presence isn't itself a scored gap the way
  // missing antivirus/DLP is (no computeFlags rule references it either) -
  // its only downstream purpose is gating a pure vendor-name follow-up, so
  // the whole pair is Quick-mode detail rather than a mixed sequence.
  select("sdwanUsed", "infra", "Do you use SD-WAN?", ["Yes", "No", "Not sure"], { required: true, quickSkip: true }),
  vendor("sdwanVendor", "infra", "Which SD-WAN vendor?", SDWAN_VENDORS, {
    visibleIf: (answers) => answers.sdwanUsed === "Yes",
    quickSkip: true,
  }),
  select("networkArch", "infra", "How would you describe your network architecture?", ["Flat / mostly unsegmented", "Segmented (VLANs / zones)", "Zero-trust / microsegmented"], {
    required: true,
    allowOther: true,
    otherPlaceholder: "e.g. hub-and-spoke across multiple sites, SD-WAN overlay",
  }),
  select("externalDevices", "infra", "Do you have external-facing devices (VPN gateways, remote-access appliances, firewalls with public IPs)?", ["Yes", "No"], { required: true }),
  vendor("edgeDeviceVendor", "infra", "What firewall / VPN gateway appliance handles that external access?", EDGE_DEVICE_VENDORS, {
    visibleIf: (answers) => answers.externalDevices === "Yes",
    quickSkip: true,
  }),
  select(
    "externalWebsite",
    "infra",
    "Do you operate any externally-reachable, customer-facing services - websites or web apps that accept user input (forms, logins, uploads), payment gateways, APIs, or portals?",
    ["Yes", "No"],
    { required: true }
  ),
  select("webDb", "infra", "Does that service connect to a backend database?", ["Yes", "No", "Not sure"], {
    required: false,
    visibleIf: (answers) => answers.externalWebsite === "Yes",
  }),
  vendor("hostingProvider", "infra", "Who hosts your web server(s)?", HOSTING_PROVIDERS, { quickSkip: true }),
  // webServerStack: free-text specificity that only ever feeds vendor-note
  // matching (see vendors.js/VENDOR_NOTES), not scoring - Quick-mode skip.
  text("webServerStack", "infra", "What web server software / OS runs it, if known?", "e.g. Nginx on Ubuntu 22.04, IIS on Windows Server", { quickSkip: true }),
];

export const DEVSEC_ORDER = ["developsSoftware", "devsecopsMaturity", "secretsManagement"];

export const DEVSEC_NODES = [
  select("developsSoftware", "infra", "Does your organization develop or maintain custom software/applications (in-house or via contractors)?", ["Yes", "No"], { required: true }),
  select(
    "devsecopsMaturity",
    "infra",
    "How would you describe your DevSecOps practice?",
    [
      "No formal practice - security reviewed late, if at all",
      "Security scanning exists but isn't enforced in the pipeline",
      "Security gates (SAST/dependency scanning) enforced in CI/CD",
    ],
    {
      visibleIf: (answers) => answers.developsSoftware === "Yes",
      allowOther: true,
      otherPlaceholder: "e.g. manual peer code review required, no automated scanning",
    }
  ),
  select(
    "secretsManagement",
    "infra",
    "How are secrets (API keys, credentials) managed in your applications/pipelines?",
    [
      "Hardcoded or stored in plain config files",
      "Environment variables, informally managed",
      "Dedicated secrets manager (e.g. Vault, cloud KMS)",
    ],
    { visibleIf: (answers) => answers.developsSoftware === "Yes" }
  ),
];

export const OT_ORDER = ["hasOT", "otSegregation", "otRemoteAccess", "otPatching", "otMonitoring", "otVendor"];

export const OT_NODES = [
  select("hasOT", "infra", "Do you have a dedicated OT / Industrial Control Systems (ICS/SCADA) environment, separate from your office IT network?", ["Yes", "No", "Not sure"], {
    required: true,
    visibleIf: (answers) => !otSectionSkipped(answers),
  }),
  select("otSegregation", "infra", "Is the OT network segregated from the corporate IT network (e.g. dedicated firewalls, DMZ, air-gap)?", ["No - flat/shared network", "Partially segregated", "Yes, fully segregated"], {
    visibleIf: (answers) => answers.hasOT === "Yes",
  }),
  select("otRemoteAccess", "infra", "Is remote access to OT systems possible, and if so, how is it controlled?", ["No remote access exists", "Yes, but not via a dedicated secure gateway", "Yes, via a monitored jump host / secure gateway"], {
    visibleIf: (answers) => answers.hasOT === "Yes",
  }),
  select("otPatching", "infra", "How are OT/ICS devices patched, given many can't be updated like standard IT?", ["Rarely or never patched (legacy/vendor-locked)", "Patched during scheduled maintenance windows", "Actively managed patch program"], {
    visibleIf: (answers) => answers.hasOT === "Yes",
  }),
  select("otMonitoring", "infra", "Do you have monitoring specific to OT/ICS traffic (e.g. an OT-aware IDS)?", ["No", "Partial coverage", "Yes"], {
    visibleIf: (answers) => answers.hasOT === "Yes",
  }),
  vendor("otVendor", "infra", "What ICS/SCADA platform or vendor is primarily in use, if known?", OT_ICS_VENDORS, {
    visibleIf: (answers) => answers.hasOT === "Yes",
    quickSkip: true,
  }),
];

// Whether the OT section should be skipped by default for the selected
// industry (still overridable by scope.otOverride) - ported verbatim from
// the original OT_STEP.skipIf.
export function otSectionSkipped(answers) {
  const ind = INDUSTRIES.find((i) => i.id === answers.industry);
  return Boolean(ind && ind.otDefault === "skip" && !answers.otOverride);
}
