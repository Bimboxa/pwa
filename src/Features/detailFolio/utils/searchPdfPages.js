const SNIPPET_CONTEXT = 40;
const MAX_RESULTS = 50;

// Length-preserving accent/case fold: each char maps to exactly one char, so
// match offsets found in the folded string index directly into the original
// text (French accents fold 1:1; rare ligatures like œ are an accepted miss).
export function foldForSearch(s) {
  return Array.from(s, (ch) =>
    (ch.normalize("NFD")[0] || ch).toLowerCase()
  ).join("");
}

// pagesText: Array<string|null> (null = page not extracted yet), 0-based.
// Returns [{pageNumber, snippet, matchStart, matchEnd, count}] in page order,
// capped at MAX_RESULTS. matchStart/matchEnd are offsets within the snippet.
export default function searchPdfPages(pagesText, query) {
  const q = foldForSearch(query?.trim() ?? "");
  if (q.length < 2 || !Array.isArray(pagesText)) return [];

  const results = [];
  for (let i = 0; i < pagesText.length; i++) {
    const text = pagesText[i];
    if (!text) continue;

    const folded = foldForSearch(text);
    const firstIndex = folded.indexOf(q);
    if (firstIndex === -1) continue;

    let count = 0;
    for (
      let at = firstIndex;
      at !== -1;
      at = folded.indexOf(q, at + q.length)
    ) {
      count += 1;
    }

    const start = Math.max(0, firstIndex - SNIPPET_CONTEXT);
    const end = Math.min(text.length, firstIndex + q.length + SNIPPET_CONTEXT);
    const snippet =
      (start > 0 ? "…" : "") +
      text.slice(start, end) +
      (end < text.length ? "…" : "");
    const prefixLength = start > 0 ? 1 : 0;

    results.push({
      pageNumber: i + 1,
      snippet,
      matchStart: firstIndex - start + prefixLength,
      matchEnd: firstIndex - start + prefixLength + q.length,
      count,
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}
