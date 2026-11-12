// Url of a LINK block as typed by the user -> an absolute http(s) url, or
// null when it cannot be one (other schemes are refused: the link opens in
// the viewer of a shared Krto).
export default function normalizeLinkUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    return parsed.href;
  } catch {
    return null;
  }
}
