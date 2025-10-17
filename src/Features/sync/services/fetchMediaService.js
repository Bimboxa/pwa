export default async function fetchMediaService({ path, onProgress }) {
  const API = "https://public.media.bimboxa.com";

  // This only fetches the HTTP headers, NOT the file body yet!
  // At this point, we have the status code, Content-Length, etc., but the file content is still on the server
  const response = await fetch(`${API}${path}`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch media: ${response.status} ${response.statusText}`
    );
  }

  // Get the total size from the Content-Length header (the file is NOT downloaded yet)
  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : null;

  let receivedBytes = 0;
  const chunks = [];

  // IMPORTANT: This streams data in REAL-TIME as it arrives from the network
  // Each reader.read() call waits for the next chunk from the server
  const reader = response.body.getReader();

  while (true) {
    // This await blocks until a chunk arrives from the network (REAL-TIME)
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    // Call onProgress with real-time progress (0 to 1)
    if (onProgress && total) {
      const progress = receivedBytes / total;
      onProgress(progress);
    }
  }

  // Final progress callback at 100%
  if (onProgress) {
    onProgress(1);
  }

  // Combine all chunks into a single Blob
  const blob = new Blob(chunks);

  return blob;
}
