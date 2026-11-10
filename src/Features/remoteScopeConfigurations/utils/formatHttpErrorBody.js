/**
 * Turn the body of a failed HTTP response into a short, readable message.
 *
 * Handles the ASP.NET problem-details shape first (`errors` map of field →
 * messages, then `detail` / `title`), falls back to a generic `message` key,
 * then to the raw text. Returns "" when the body is empty or unusable, so the
 * caller can skip the suffix.
 */
const MAX_LENGTH = 300;

export default function formatHttpErrorBody(text) {
  if (!text) return "";
  const trimmed = String(text).trim();
  if (!trimmed) return "";

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return truncate(trimmed);
  }

  if (!parsed || typeof parsed !== "object") return truncate(trimmed);

  if (parsed.errors && typeof parsed.errors === "object") {
    const parts = Object.entries(parsed.errors).map(([field, messages]) => {
      const list = Array.isArray(messages) ? messages : [messages];
      return `${field}: ${list.join(" ")}`;
    });
    if (parts.length > 0) return truncate(parts.join(" | "));
  }

  const message = parsed.detail || parsed.title || parsed.message;
  if (typeof message === "string" && message.trim())
    return truncate(message.trim());

  return truncate(trimmed);
}

function truncate(s) {
  return s.length > MAX_LENGTH ? `${s.slice(0, MAX_LENGTH)}…` : s;
}
