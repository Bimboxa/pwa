import { hexToRgb01 } from "Features/titleBlocks/utils/drawTitleBlockOnPdfPage";

// pdf-lib drawer of the double page border frame (computePageFrame output,
// SVG coordinates). Drawn before the cartouche so the white-filled cartouche
// sits on top of the inner line at the shared corner.
export default function drawPageFrameOnPdfPage(page, frame) {
  if (!frame) return;
  const pageHeight = page.getSize().height;
  const borderColor = hexToRgb01(frame.color);

  for (const rect of [frame.outer, frame.inner]) {
    page.drawRectangle({
      x: rect.x,
      y: pageHeight - rect.y - rect.height,
      width: rect.width,
      height: rect.height,
      borderColor,
      borderWidth: rect.strokeWidth,
    });
  }
}
