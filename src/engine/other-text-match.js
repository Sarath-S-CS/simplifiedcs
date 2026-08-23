// ASSESSMENT-REPORT-DEPTH-BRIEF.md §5: "Other" free-text handling -
// keyword-match first, AI only as a genuine fallback. This module is the
// deterministic, zero-cost first pass: if what someone typed into an
// "Other" field substantively matches an option that already exists in
// structured form (e.g. typing "SOC monitoring" when a "SOC / monitoring"
// checkbox already exists elsewhere), resolve it as that option instead of
// treating it as unstructured text an AI call would need to interpret.
//
// Deliberately simple word-overlap matching, not fuzzy/edit-distance
// matching - the failure mode to avoid is a false positive that silently
// misclassifies what someone actually meant, so this only matches when the
// free text's own significant words are genuinely a subset of (or clearly
// overlap with) a candidate's words, never a loose "sounds similar" guess.
const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "our", "we", "is", "are", "it", "its"]);

function normalizeWords(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .split(/[\s/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Returns the best-matching candidate whose own significant words are
// entirely covered by the free text's words (or vice versa for a short
// candidate label), or null if nothing clears that bar. `candidates` is an
// array of { id, label } - label is what gets word-compared, id is what's
// returned so callers can resolve to the structured option.
export function matchOtherText(freeText, candidates) {
  const inputWords = new Set(normalizeWords(freeText));
  if (inputWords.size === 0) return null;

  let best = null;
  for (const candidate of candidates) {
    const candWords = normalizeWords(candidate.label);
    if (candWords.length === 0) continue;
    const overlap = candWords.filter((w) => inputWords.has(w));
    // Every one of the candidate's significant words must appear in the
    // free text - a partial match ("monitoring" alone matching "SOC /
    // monitoring") is exactly the false-positive this guards against.
    if (overlap.length !== candWords.length) continue;
    // Among qualifying candidates, prefer the one whose words make up the
    // largest share of what was actually typed - the most specific match,
    // not just the first one that happens to qualify.
    const specificity = candWords.length / inputWords.size;
    if (!best || specificity > best.specificity) {
      best = { id: candidate.id, label: candidate.label, specificity };
    }
  }
  return best ? { id: best.id, label: best.label } : null;
}
