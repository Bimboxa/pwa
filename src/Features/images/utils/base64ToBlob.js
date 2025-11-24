export default function base64ToBlob(base64, mimeType = "image/png") {
  if (!base64) return null;

  const parts = base64.split(",");
  const base64Data = parts.length > 1 ? parts.pop() : base64;

  try {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error("[base64ToBlob] Failed to convert base64 to Blob", error);
    return null;
  }
}
