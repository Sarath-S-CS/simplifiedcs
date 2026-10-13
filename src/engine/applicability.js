// How sure a vulnerability match is, in words - derived from the server's
// evidence (never from the model). Shared by the on-screen AI panel
// (src/ui/ai-panel.js) and the PDF export (src/engine/pdf-report.js) so the
// two never disagree about what an applicability value means. The version
// labels quote the version the visitor typed, so a typo is visible right
// where it matters.
export function applicabilityText(a) {
  const v = a.version ? ` (${a.version})` : "";
  switch (a.applicability) {
    case "affects-stated-version":
      return `Listed by NVD as affecting your version${v}`;
    case "version-not-listed":
      return `NVD doesn't list your version${v} as affected - confirm with the vendor`;
    case "potential-match":
      return "Potential match - confirm your version";
    case "platform-not-indicated":
      return "Potential match - platform not stated in the record";
    case "vendor-only":
      return "Vendor match only - this product isn't confirmed";
    default:
      return a.applicability;
  }
}
