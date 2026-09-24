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
// How each of these answers is used in the report (scored control, context,
// vendor, informational) is recorded in controls.js's PROFILE_DESIGNATIONS.
// `quick: true` marks the only setup questions Quick screening asks.
import { INDUSTRIES } from "./industries.js";
import {
  ANTIVIRUS_VENDORS,
  EDR_VENDORS,
  EMAIL_SECURITY_VENDORS,
  DLP_VENDORS,
  SDWAN_VENDORS,
  EDGE_DEVICE_VENDORS,
  EDGE_VERSION_EXAMPLES,
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
    quick: true,
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
  "endpointOs",
  "sdwanUsed",
  "sdwanVendor",
  "networkArch",
  "externalDevices",
  "edgeDeviceVendor",
  "edgeDeviceVersion",
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
  }),
  vendor("edrVendor", "infra", "What EDR (Endpoint Detection & Response) product is deployed, if any?", EDR_VENDORS),
  vendor("emailSecurityVendor", "infra", "What email security / anti-phishing gateway do you use, if any?", EMAIL_SECURITY_VENDORS),
  vendor("awarenessLms", "infra", "What security awareness / LMS platform do you use for training, if any?", AWARENESS_LMS_VENDORS),
  select("dlpUsed", "infra", "Do you use a DLP (data loss prevention) solution?", ["Yes", "No", "Not sure"], { required: true }),
  vendor("dlpVendor", "infra", "Which DLP product?", DLP_VENDORS, {
    visibleIf: (answers) => answers.dlpUsed === "Yes",
  }),
  select("deployModel", "infra", "Is your infrastructure on-premises, cloud-only, or hybrid?", ["On-premises only", "Cloud-only", "Hybrid (on-prem + cloud)"], { required: true, quick: true }),
  vendor("cloudProvider", "infra", "Which cloud provider(s)?", CLOUD_PROVIDERS, {
    visibleIf: (answers) => answers.deployModel && answers.deployModel !== "On-premises only",
  }),
  // Optional context for the AI vulnerability check: lets it tell whether a
  // CVE for a product on one platform can apply here (see
  // netlify/lib/evidence.ts). Never scored.
  {
    id: "endpointOs",
    kind: "profile",
    category: "infra",
    type: "multiselect",
    text: "Which operating systems run on your organization's computers and servers? (select all that apply)",
    options: ["Windows", "macOS", "Linux", "iOS", "Android"].map((os) => ({ id: os, label: os })),
    required: false,
  },
  // sdwanUsed/sdwanVendor: context only - SD-WAN presence isn't itself a
  // control; its only downstream purpose is gating a vendor-name follow-up.
  select("sdwanUsed", "infra", "Do you use SD-WAN?", ["Yes", "No", "Not sure"], { required: true }),
  vendor("sdwanVendor", "infra", "Which SD-WAN vendor?", SDWAN_VENDORS, {
    visibleIf: (answers) => answers.sdwanUsed === "Yes",
  }),
  select("networkArch", "infra", "How would you describe your network architecture?", ["Flat / mostly unsegmented", "Segmented (VLANs / zones)", "Zero-trust / microsegmented", "Not sure"], {
    required: true,
    allowOther: true,
    otherPlaceholder: "e.g. hub-and-spoke across multiple sites, SD-WAN overlay",
  }),
  select("externalDevices", "infra", "Do you have external-facing devices (VPN gateways, remote-access appliances, firewalls with public IPs)?", ["Yes", "No"], { required: true }),
  vendor("edgeDeviceVendor", "infra", "What firewall / VPN gateway appliance handles that external access?", EDGE_DEVICE_VENDORS, {
    visibleIf: (answers) => answers.externalDevices === "Yes",
    // A version typed for one vendor means nothing for another.
    resets: ["edgeDeviceVersion"],
  }),
  // edgeDeviceVersion: never scored. Only sent with the optional AI check,
  // where the server looks it up exactly in NVD for supported products
  // (netlify/lib/product-catalog.ts) - see AI-2 in the status doc.
  text("edgeDeviceVersion", "infra", "Which software version is it running?", (answers) => EDGE_VERSION_EXAMPLES[answers.edgeDeviceVendor] || "e.g. 7.4.3", {
    visibleIf: (answers) => answers.externalDevices === "Yes" && Boolean(answers.edgeDeviceVendor || answers.edgeDeviceVendor__isOther),
    hint: "Shown on the device's admin dashboard or 'System information' page. Only used if you ask for the optional AI vulnerability check. Leave blank if you're not sure.",
    maxLength: 40,
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
  vendor("hostingProvider", "infra", "Who hosts your web server(s)?", HOSTING_PROVIDERS),
  // webServerStack: free-text specificity that only ever feeds vendor-note
  // matching (see vendors.js/VENDOR_NOTES) and the AI product check, never
  // scoring.
  text("webServerStack", "infra", "What web server software runs it, and which version, if known?", "e.g. nginx 1.24.0 on Ubuntu 22.04, or IIS 10.0 on Windows Server 2019"),
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
      "Not sure",
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
      "Not sure",
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
  select("otSegregation", "infra", "Is the OT network segregated from the corporate IT network (e.g. dedicated firewalls, DMZ, air-gap)?", ["No - flat/shared network", "Partially segregated", "Yes, fully segregated", "Not sure"], {
    visibleIf: otFollowUpsVisible,
  }),
  select("otRemoteAccess", "infra", "Is remote access to OT systems possible, and if so, how is it controlled?", ["No remote access exists", "Yes, but not via a dedicated secure gateway", "Yes, via a monitored jump host / secure gateway", "Not sure"], {
    visibleIf: otFollowUpsVisible,
  }),
  select("otPatching", "infra", "How are OT/ICS devices patched, given many can't be updated like standard IT?", ["Rarely or never patched (legacy/vendor-locked)", "Patched during scheduled maintenance windows", "Actively managed patch program", "Not sure"], {
    visibleIf: otFollowUpsVisible,
  }),
  select("otMonitoring", "infra", "Do you have monitoring specific to OT/ICS traffic (e.g. an OT-aware IDS)?", ["No", "Partial coverage", "Yes", "Not sure"], {
    visibleIf: otFollowUpsVisible,
  }),
  vendor("otVendor", "infra", "What ICS/SCADA platform or vendor is primarily in use, if known?", OT_ICS_VENDORS, {
    visibleIf: (answers) => answers.hasOT === "Yes",
  }),
];

// OT follow-ups apply when OT is confirmed - and also when the answer is
// "Not sure" in an industry where OT is common, because "we don't know if
// we have OT" there is itself a finding worth grading rather than skipping.
// Elsewhere an unsure answer is reported as an informational note instead.
export function otFollowUpsVisible(answers) {
  if (answers.hasOT === "Yes") return true;
  if (answers.hasOT !== "Not sure") return false;
  const ind = INDUSTRIES.find((i) => i.id === answers.industry);
  return Boolean(ind && ind.otDefault === "likely");
}

// Whether the OT section should be skipped by default for the selected
// industry (still overridable by scope.otOverride) - ported verbatim from
// the original OT_STEP.skipIf.
export function otSectionSkipped(answers) {
  const ind = INDUSTRIES.find((i) => i.id === answers.industry);
  return Boolean(ind && ind.otDefault === "skip" && !answers.otOverride);
}
