// Parse the segment-length constraint buffer typed while drawing.
//
// Dependency free so it can be replayed in node.
//
// A single value keeps the historical meaning ("6" → lock the next segment to
// 6 m). A ";"-separated list means "place that many collinear segments in one
// click": "6;0.2;2;0.2" → four segments of 6 / 0.2 / 2 / 0.2 m.
//
// Returns `{ lengths, total }` or `null` when the buffer holds no usable
// constraint. `null` — rather than a partial result — matters: `parseFloat`
// stops at the first invalid character, so it would silently read "6;abc" as 6
// and lock a length the user never asked for.

// Characters accepted into the buffer. Single source of truth: the keydown
// filter in InteractionLayer imports this instead of re-declaring a regex.
export const CONSTRAINT_BUFFER_CHAR_RE = /^[0-9.,;]$/;

export default function parseConstraintLengths(buffer) {
  if (!buffer) return null;

  const lengths = [];
  for (const raw of String(buffer).split(";")) {
    const token = raw.trim();
    // Empty token: a trailing ";" mid-typing ("6;0.2;"), or a doubled ";".
    // Skipping it is NOT "ignore the last value" — every value the user
    // actually typed still counts.
    if (token === "") continue;
    // `Number` and not `parseFloat`: parseFloat stops at the first invalid
    // character, so it reads "2x" as 2 and would accept a buffer the user
    // cannot actually have meant.
    const value = Number(token.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    lengths.push(value);
  }

  if (lengths.length === 0) return null;

  return {
    lengths,
    total: lengths.reduce((sum, v) => sum + v, 0),
  };
}
