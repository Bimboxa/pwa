// Hex SHA-256 of an ArrayBuffer (content identity key, e.g. to dedup the
// PDF pages extracted for base maps). Falls back to a name/size/mtime key
// when WebCrypto is unavailable (non-secure contexts): pass `fallbackFile`.
export default async function getArrayBufferSha256(arrayBuffer, fallbackFile) {
  try {
    if (globalThis.crypto?.subtle && arrayBuffer) {
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        arrayBuffer
      );
      return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (e) {
    console.warn("[files] sha256 failed, using fallback key", e);
  }
  const name = fallbackFile?.name ?? "file";
  const size = fallbackFile?.size ?? arrayBuffer?.byteLength ?? 0;
  const mtime = fallbackFile?.lastModified ?? 0;
  return `${name}:${size}:${mtime}`;
}
