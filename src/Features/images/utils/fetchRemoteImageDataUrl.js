import fetchRemoteImageBlob from "./fetchRemoteImageBlob";

// Data URL (data:image/...) for a bearer-protected remote image, directly
// embeddable in a href / src / SVG / PDF export without any auth header.
// Returns null when no url; throws on HTTP error.
export default async function fetchRemoteImageDataUrl({ url, jwt }) {
  const blob = await fetchRemoteImageBlob({ url, jwt });
  if (!blob) return null;

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
