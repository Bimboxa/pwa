// Locates a text (a title of a CCTP…) in the text items of a PDF page and
// returns its highlight rects, normalized [0..1] (top-left origin) in the
// frame of the viewport the items are projected with.
//
// items: pdfjs `getTextContent().items` ({str, transform, width, height});
// viewport: {width, height, transform} (pdfjs `page.getViewport`). With the
// viewport of the page's own rotation, the rects are in the INTRINSIC frame
// db.relsBusinessObjectResource expects.

const DESCENT_RATIO = 0.2;

// Lowercase, no accent, no punctuation, no space: titles are often typeset
// with their own spacing ("4 . 1 . 3  Dépose") and split over several items.
export function normalizeSearchText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const multiply = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

// Bounding box of a text item in the viewport, in px.
function getItemBox(item, viewport) {
  const tx = multiply(viewport.transform, item.transform);
  const viewportScale = Math.hypot(
    viewport.transform[0],
    viewport.transform[1]
  );
  const along = Math.hypot(tx[0], tx[1]) || 1;
  const up = Math.hypot(tx[2], tx[3]) || 1;
  const dir = { x: tx[0] / along, y: tx[1] / along };
  const normal = { x: tx[2] / up, y: tx[3] / up };
  const width = (item.width ?? 0) * viewportScale;
  const height = (item.height || up / viewportScale) * viewportScale;

  // baseline origin, moved under the descenders
  const origin = {
    x: tx[4] - normal.x * height * DESCENT_RATIO,
    y: tx[5] - normal.y * height * DESCENT_RATIO,
  };
  const rise = height * (1 + DESCENT_RATIO);
  const corners = [
    origin,
    { x: origin.x + dir.x * width, y: origin.y + dir.y * width },
    { x: origin.x + normal.x * rise, y: origin.y + normal.y * rise },
    {
      x: origin.x + dir.x * width + normal.x * rise,
      y: origin.y + dir.y * width + normal.y * rise,
    },
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

// Same rule as getHighlightRectsFromClientRects: one band per line.
function mergeBoxesByLine(boxes) {
  const lines = [];
  for (const box of boxes) {
    const center = (box.top + box.bottom) / 2;
    const height = box.bottom - box.top;
    const line = lines.find((l) => {
      const lCenter = (l.top + l.bottom) / 2;
      return (
        Math.abs(center - lCenter) < Math.min(height, l.bottom - l.top) / 2
      );
    });
    if (line) {
      line.left = Math.min(line.left, box.left);
      line.right = Math.max(line.right, box.right);
      line.top = Math.min(line.top, box.top);
      line.bottom = Math.max(line.bottom, box.bottom);
    } else lines.push({ ...box });
  }
  return lines;
}

const clamp = (v) => Math.min(Math.max(v, 0), 1);

/**
 * @returns {{rects: Array<{x, y, width, height}>, text: string} | null}
 *   null when the text is not on the page.
 */
export default function findTextRectsInPdfTextItems({ items, viewport, text }) {
  const needle = normalizeSearchText(text);
  if (!needle || !viewport?.width || !viewport?.height) return null;

  // haystack of the normalized items, with the item of every character
  let haystack = "";
  const owners = [];
  const textItems = (items ?? []).filter(
    (item) => typeof item?.str === "string" && Array.isArray(item.transform)
  );
  textItems.forEach((item, index) => {
    const normalized = normalizeSearchText(item.str);
    haystack += normalized;
    for (let i = 0; i < normalized.length; i++) owners.push(index);
  });

  const start = haystack.indexOf(needle);
  if (start < 0) return null;
  const matched = [...new Set(owners.slice(start, start + needle.length))].map(
    (index) => textItems[index]
  );

  const rects = mergeBoxesByLine(
    matched.map((item) => getItemBox(item, viewport))
  )
    .map((box) => {
      const x = clamp(box.left / viewport.width);
      const y = clamp(box.top / viewport.height);
      return {
        x,
        y,
        width: clamp(box.right / viewport.width) - x,
        height: clamp(box.bottom / viewport.height) - y,
      };
    })
    .filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;

  return {
    rects,
    text: matched
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}
