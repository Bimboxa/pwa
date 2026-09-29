// Client rects of the TEXT covered by a selection range inside `rootEl` (the
// pdfjs text layer). Range.getClientRects() alone also returns the boxes of
// the elements fully inside the range (line breaks, the layer itself…):
// walking the text nodes keeps the glyph boxes only.
export default function getSelectionClientRects(range, rootEl) {
  const rects = [];
  if (!range || !rootEl) return rects;

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (range.intersectsNode(node)) {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      if (node === range.startContainer) {
        nodeRange.setStart(node, range.startOffset);
      }
      if (node === range.endContainer) {
        nodeRange.setEnd(node, range.endOffset);
      }
      if (!nodeRange.collapsed) rects.push(...nodeRange.getClientRects());
    }
    node = walker.nextNode();
  }
  return rects;
}
