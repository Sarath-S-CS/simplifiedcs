// Adapted from the original snapshotRows() - same "Infrastructure snapshot"
// table on the results screen, updated for the §5.2 team-structure fields
// (itSecStaff/secManagedBy/mdrMspName no longer exist) and §5.5's renamed
// containerization fields.
import { DAY_TO_DAY_OPTIONS } from "../data/team-structure.js";

export function snapshotRows(answers) {
  const rows = [];
  rows.push(["Organization size", answers.employeeCount || "-"]);

  let team = answers.teamDedicated || "-";
  if (answers.teamDedicated === "IT services outsourced with no internal IT team") {
    if (answers.outsourcedMspName) team += ` (${answers.outsourcedMspName})`;
  } else {
    const headcount = answers.itHeadcountSeparate || answers.combinedHeadcount || answers.itOnlyHeadcount;
    if (headcount) team += ` - ${headcount}`;
    if (answers.cybersecHeadcount) team += ` (+${answers.cybersecHeadcount} cybersecurity)`;
  }
  rows.push(["Dedicated IT/security team", team]);

  const providerNames = [answers.mspProviderName, answers.mdrProviderName, answers.msspProviderName].filter(Boolean);
  if (Array.isArray(answers.dayToDay) && answers.dayToDay.length) {
    const labels = answers.dayToDay.map((id) => DAY_TO_DAY_OPTIONS.find((o) => o.id === id)?.label || id);
    rows.push(["Security managed by", labels.join("; ") + (providerNames.length ? ` (${providerNames.join(", ")})` : "")]);
  } else if (providerNames.length) {
    rows.push(["Security managed by", providerNames.join(", ")]);
  }

  rows.push(["EDR / antivirus", answers.edrVendor || "Not specified"]);
  rows.push(["Email security gateway", answers.emailSecurityVendor || "Not specified"]);
  rows.push(["Awareness / LMS platform", answers.awarenessLms || "Not specified"]);

  let dlp = answers.dlpUsed || "-";
  if (answers.dlpVendor) dlp += ` - ${answers.dlpVendor}`;
  rows.push(["DLP solution", dlp]);

  let deploy = answers.deployModel || "-";
  if (answers.cloudProvider) deploy += ` - ${answers.cloudProvider}`;
  rows.push(["Deployment model", deploy]);

  rows.push(["Network architecture", answers.networkArch || "-"]);

  let sdwan = answers.sdwanUsed || "-";
  if (answers.sdwanVendor) sdwan += ` - ${answers.sdwanVendor}`;
  rows.push(["SD-WAN", sdwan]);

  rows.push(["External-facing devices", answers.externalDevices || "-"]);
  if (answers.edgeDeviceVendor) rows.push(["Firewall / VPN appliance", answers.edgeDeviceVendor]);

  let webExp = answers.externalWebsite || "-";
  if (answers.webDb) webExp += `, DB-connected: ${answers.webDb}`;
  rows.push(["External-facing services", webExp]);

  let hosting = answers.hostingProvider || "Not specified";
  if (answers.webServerStack) hosting += ` - ${answers.webServerStack}`;
  rows.push(["Hosting / web stack", hosting]);

  if (answers.usesContainers) rows.push(["Containerization", answers.usesContainers]);
  if (answers.usesVirtualization) rows.push(["Virtualization", answers.usesVirtualization]);

  if (answers.developsSoftware) {
    rows.push(["Develops custom software", answers.developsSoftware]);
    if (answers.developsSoftware === "Yes") {
      if (answers.devsecopsMaturity) rows.push(["DevSecOps maturity", answers.devsecopsMaturity]);
      if (answers.secretsManagement) rows.push(["Secrets management", answers.secretsManagement]);
    }
  }

  if (answers.hasOT) {
    let ot = answers.hasOT;
    if (answers.hasOT === "Yes" && answers.otSegregation) ot += ` - segregation: ${answers.otSegregation}`;
    rows.push(["OT / ICS environment", ot]);
    if (answers.otVendor) rows.push(["ICS/SCADA platform", answers.otVendor]);
  }
  return rows;
}
