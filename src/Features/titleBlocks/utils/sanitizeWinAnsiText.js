// pdf-lib StandardFonts (Helvetica...) use WinAnsi encoding: any code point
// above 0xFF throws at drawText time. Strip unsupported characters.
// Extracted from generateItemsGridPdfVariantH so all PDF text drawing shares it.
export default function sanitizeWinAnsiText(text) {
  if (!text) return "";
  const str = String(text);
  let result = "";
  for (const char of str) {
    const code = char.codePointAt(0);
    if (code != null && code <= 0xff) {
      result += char;
    }
  }
  return result;
}
