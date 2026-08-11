// Ported verbatim from the original index.html INDUSTRIES array - unchanged
// by this rebuild.
export const INDUSTRIES = [
  { id: "finance", label: "Financial Services", topPriority: "iso27001", alsoRelevant: ["pcidss", "sox"], otDefault: "ask" },
  { id: "health", label: "Healthcare", topPriority: "hipaa", alsoRelevant: ["iso27001"], otDefault: "likely" },
  { id: "pharma", label: "Pharmaceuticals", topPriority: "iso27001", alsoRelevant: ["gdpr"], otDefault: "likely" },
  { id: "energy", label: "Energy / Critical Infrastructure", topPriority: "nis2", alsoRelevant: ["iso27001"], otDefault: "likely" },
  { id: "manufacturing", label: "Manufacturing / Industrial", topPriority: "iso27001", alsoRelevant: ["nis2"], otDefault: "likely" },
  { id: "retail", label: "Retail / E-commerce", topPriority: "pcidss", alsoRelevant: ["gdpr"], otDefault: "ask" },
  { id: "saas", label: "SaaS / Technology", topPriority: "soc2", alsoRelevant: ["iso27001"], otDefault: "skip" },
  { id: "itservices", label: "IT Services / Software Consulting", topPriority: "soc2", alsoRelevant: ["iso27001"], otDefault: "skip" },
  { id: "marketing", label: "Digital Marketing / Marketing Agency", topPriority: "gdpr", alsoRelevant: ["soc2"], otDefault: "skip" },
  { id: "public", label: "Public Sector / Government", topPriority: "nis2", alsoRelevant: ["iso27001"], otDefault: "ask" },
  { id: "other", label: "Other / Not listed", topPriority: null, alsoRelevant: [], otDefault: "ask" },
];
