export default function testIsPdf(file) {
  if (!file || !file.type) return false;
  // Check MIME type
  if (file.type === "application/pdf") return true;
  // Fallback: check file extension if name exists
  if (file.name && file.name.toLowerCase().endsWith(".pdf")) return true;
  return false;
}
