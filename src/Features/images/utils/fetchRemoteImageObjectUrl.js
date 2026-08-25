import fetchRemoteImageBlob from "./fetchRemoteImageBlob";

// Object URL (blob:) for a bearer-protected remote image, usable in an
// <img src>. The caller owns the url and must URL.revokeObjectURL it when
// done. Returns null when no url; throws on HTTP error.
export default async function fetchRemoteImageObjectUrl({ url, jwt }) {
  const blob = await fetchRemoteImageBlob({ url, jwt });
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
