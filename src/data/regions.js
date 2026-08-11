// §5.1 — region/geography selection.
//
// REGIONS[].frameworks is preserved EXACTLY as it was in the original
// index.html for eu/uk/us/apac/global (only "us" is relabeled "na" /
// "North America" per the brief - the frameworks it flags do not change).
// South America, Middle East, and Africa are new; each gets an empty
// `frameworks` array (nothing in FRAMEWORKS is specific to them) plus an
// informational note naming real, verifiable regional data-protection
// regimes - the same conservative pattern the original file already used
// for Asia-Pacific, rather than inventing a framework-flag mapping that
// isn't backed by anything in the FRAMEWORKS list.
//
// `standalone: true` marks Global as visually separate from the region
// grid (§5.1: "a distinct standalone option ... not a checkbox living
// among individual countries").
export const REGIONS = [
  {
    id: "eu",
    label: "European Union",
    frameworks: ["nis2", "gdpr"],
    note: "NIS2 and GDPR are policy frameworks that companies registered or operating in EU regions are expected to adhere to.",
  },
  {
    id: "uk",
    label: "United Kingdom",
    frameworks: ["cyberessentials"],
    note: "Cyber Essentials is a UK government-backed baseline certification - especially relevant if you bid on UK government or public-sector contracts.",
  },
  {
    id: "na",
    label: "North America",
    frameworks: ["sox", "hipaa", "pcidss"],
    note: "SOX applies to US public companies (and their vendors/auditors); HIPAA applies specifically if you handle US health data; PCI DSS applies specifically if you handle payment card data - check which condition actually applies to your business.",
  },
  {
    id: "southamerica",
    label: "South America",
    frameworks: [],
    note: "No single framework applies uniformly across South America - country-specific regimes exist instead, most notably Brazil's LGPD (closely modeled on GDPR). ISO 27001 remains the most broadly recognized starting point across the region.",
  },
  {
    id: "middleeast",
    label: "Middle East",
    frameworks: [],
    note: "No single framework applies uniformly across the Middle East - country-specific regimes exist instead (e.g., the UAE's PDPL, Saudi Arabia's PDPL). ISO 27001 remains the most broadly recognized starting point across the region.",
  },
  {
    id: "africa",
    label: "Africa",
    frameworks: [],
    note: "No single framework applies uniformly across Africa - country-specific regimes exist instead, most notably South Africa's POPIA. ISO 27001 remains the most broadly recognized starting point across the region.",
  },
  {
    id: "apac",
    label: "Asia-Pacific",
    frameworks: [],
    note: "No single framework applies uniformly across Asia-Pacific - country-specific regimes exist instead (e.g., Singapore's PDPA, Japan's APPI, Australia's Privacy Act). ISO 27001 remains the most broadly recognized starting point across the region.",
  },
  {
    id: "global",
    label: "Global",
    standalone: true,
    frameworks: [],
    note: "Without a specific regional mandate, internationally recognized certifications such as ISO 27001 or SOC 2 are the most broadly applicable starting point.",
  },
];
