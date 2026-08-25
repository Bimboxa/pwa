// Fetch a bearer-protected remote image (e.g. /api/PovPreviews/Image/<id>)
// as a Blob. Such urls can't be used directly in an <img src> / href since
// the request must carry the Authorization header.
// Returns null when no url; throws on HTTP error.
export default async function fetchRemoteImageBlob({ url, jwt }) {
  if (!url) return null;

  const response = await fetch(url, {
    headers: {
      ...(jwt && { Authorization: `Bearer ${jwt}` }),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for url ${url}`);
  }

  return await response.blob();
}
