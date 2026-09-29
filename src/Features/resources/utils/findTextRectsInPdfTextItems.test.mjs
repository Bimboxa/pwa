import { test } from "node:test";
import assert from "node:assert/strict";

import findTextRectsInPdfTextItems, {
  normalizeSearchText,
} from "./findTextRectsInPdfTextItems.js";

// A4 portrait, scale 1, no rotation: y flipped
const viewport = { width: 595, height: 842, transform: [1, 0, 0, -1, 0, 842] };

const item = (str, x, y, width, size = 12) => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width,
  height: size,
});

const items = [
  item("4.1.3", 50, 700, 30),
  item(" ", 80, 700, 4),
  item("Dépose de la membrane", 84, 700, 130),
  item("d'étanchéité PVC", 50, 684, 95),
  item("Le présent article décrit…", 50, 660, 150),
];

test("normalizeSearchText drops accents, case, spaces and punctuation", () => {
  assert.equal(normalizeSearchText(" 4.1.3  Dépose "), "413depose");
});

test("finds a title split over several items, one rect per line", () => {
  const found = findTextRectsInPdfTextItems({
    items,
    viewport,
    text: "4.1.3 DEPOSE DE LA MEMBRANE D'ETANCHEITE PVC",
  });
  assert.equal(found.rects.length, 2);
  const [first, second] = found.rects;
  assert.ok(Math.abs(first.x - 50 / 595) < 1e-6);
  assert.ok(Math.abs(first.width - 164 / 595) < 1e-6);
  // top of the first line: baseline 700 + height 12 → 842 - 712
  assert.ok(Math.abs(first.y - 130 / 842) < 1e-6);
  assert.ok(second.y > first.y);
  assert.equal(found.text, "4.1.3 Dépose de la membrane d'étanchéité PVC");
});

test("returns null when the text is not on the page", () => {
  assert.equal(
    findTextRectsInPdfTextItems({ items, viewport, text: "Garde-corps" }),
    null
  );
  assert.equal(
    findTextRectsInPdfTextItems({ items, viewport, text: "" }),
    null
  );
});

test("handles a rotated page viewport", () => {
  // /Rotate 90: viewport 842 x 595, transform [0, 1, 1, 0, 0, 0]
  const rotated = { width: 842, height: 595, transform: [0, 1, 1, 0, 0, 0] };
  const found = findTextRectsInPdfTextItems({
    items: [item("Titre", 100, 200, 40)],
    viewport: rotated,
    text: "titre",
  });
  assert.equal(found.rects.length, 1);
  const [rect] = found.rects;
  // the text runs along the viewport's y axis
  assert.ok(rect.height > rect.width);
  assert.ok(Math.abs(rect.height - 40 / 595) < 1e-6);
});
