// REDUNDANCY-AUDIT-BRIEF.md §3: a local, deterministic (no external API,
// no LLM call - matches this project's no-LLM-in-the-pipeline constraint)
// approximation of "do these two questions ask about the same real-world
// fact, worded differently." Exact-string matching would have missed every
// instance found in this audit - they're all worded differently while
// asking the same thing. Word-overlap similarity is a real, if imperfect,
// stand-in for that: two questions sharing most of their distinctive
// vocabulary (SOC, monitoring, vulnerability, scans, ...) are asking about
// the same thing far more often than not.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "did", "you", "your", "yours",
  "of", "to", "and", "or", "in", "on", "for", "at", "by", "with", "as", "if",
  "that", "this", "these", "those", "have", "has", "had", "would", "could",
  "should", "any", "all", "each", "per", "from", "into", "regarding", "about",
  "be", "been", "being", "it", "its", "which", "who", "whom", "what", "when",
  "where", "how", "there", "their", "than", "then", "so", "but", "not",
  "no", "yes", "e.g", "eg", "i.e", "ie", "etc", "vs", "or", "such",
  // Generic question-template boilerplate that recurs across many
  // genuinely-unrelated questions (vendor fields all ask "do you use X, if
  // any", multi-selects all say "select all that apply") - left in, these
  // would inflate similarity between otherwise-unrelated questions purely
  // from shared UI phrasing rather than shared subject matter.
  "use", "used", "using", "select", "apply", "describe", "known", "primarily", "if",
]);

// Splits on non-alphanumeric runs (so hyphens/slashes count as boundaries -
// "network-segmented" and "SOC/monitoring" tokenize the same as spaced-out
// phrasing would), lowercases, drops stopwords and anything too short to be
// meaningful on its own.
export function significantWords(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// Jaccard similarity (intersection / union) of two questions' significant
// vocabulary - 0 for no shared meaningful words, 1 for identical vocabulary.
export function textSimilarity(textA, textB) {
  const a = significantWords(textA);
  const b = significantWords(textB);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Given a list of {id, text} questions actually visible together on some
// real walked path, returns every pair scoring at or above threshold -
// candidates for "these might be asking the same real-world fact twice."
// Order-independent, no self-pairs, no duplicate pairs.
export function findSimilarPairs(questions, threshold = 0.2) {
  const pairs = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const score = textSimilarity(questions[i].text, questions[j].text);
      if (score >= threshold) {
        pairs.push({ a: questions[i].id, b: questions[j].id, score, textA: questions[i].text, textB: questions[j].text });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
