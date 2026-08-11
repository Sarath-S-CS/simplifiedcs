// Ported verbatim from the original index.html FRAMEWORKS array. Framework-
// specific injected questions and recommendations (§5.6) are layered on top
// in nist-questions.js / scoring.js in a later increment - this file is
// just the selection catalog, unchanged.
export const FRAMEWORKS = [
  { id: "iso27001", name: "ISO 27001", desc: "International standard for an Information Security Management System - common where clients or partners require certification." },
  { id: "nis2", name: "NIS2", desc: "EU directive for essential/important-sector entities - incident notification duties and management accountability." },
  { id: "soc2", name: "SOC 2", desc: "Common for SaaS/vendors selling to enterprise customers who require an independent audit of controls." },
  { id: "hipaa", name: "HIPAA", desc: "U.S. law governing protection of health information - relevant if you handle patient or health data in the US." },
  { id: "gdpr", name: "GDPR", desc: "EU regulation governing personal data protection and privacy - relevant if you handle EU residents' data, regardless of where you're based." },
  { id: "sox", name: "SOX", desc: "U.S. Sarbanes-Oxley Act requiring financial reporting controls - relevant if you're a US public company, or a vendor/auditor to one." },
  { id: "cyberessentials", name: "Cyber Essentials", desc: "UK government-backed baseline certification - relevant for UK organizations, especially those bidding on UK government contracts." },
  { id: "pcidss", name: "PCI DSS", desc: "Payment Card Industry Data Security Standard - relevant if you store, process, or transmit credit or debit card data." },
];
