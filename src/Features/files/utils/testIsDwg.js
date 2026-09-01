export default function testIsDwg(file) {
  if (!file) return false;
  // DWG files usually come with an empty MIME type, so check the extension first.
  if (file.name && file.name.toLowerCase().endsWith(".dwg")) return true;
  if (file.type && file.type.includes("dwg")) return true;
  return false;
}
