import db from "App/db/db";

import { parseCssColor, getStandardFontFamily } from "./freeTextVectorStyle";

// FREE_TEXT annotations are exported as VECTOR text on the portfolio PDF
// (plan pages and folio pages) instead of being flattened in the page PNG.
// Everything is read from the on-screen page svg — what you see is what you
// export: the box / text geometry through the screen→page matrices (so
// container placement, viewBox, containerK and the page-pt scale of the box
// are all absorbed), the visual line breaks through DOM ranges, the styles
// through the inline styles authored by NodeFreeTextStatic.
//
// Output: one item per FREE_TEXT node, in page points (SVG top-left coords):
// { rect, innerRect, background, border, font: {family, bold, italic,
//   underline}, fontSize, textColor, textAlign, lines: [{text, rect}],
//   connector: {points, dot} | null }

export const FREE_TEXT_NODE_SELECTOR = '[data-annotation-type="FREE_TEXT"]';

// Visual lines of the sizing span: manual "\n" breaks plus browser wraps,
// detected by the vertical jump of successive character rects.
function getVisualLines(span, rectToPage) {
  const node = span.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  const text = node.data ?? "";
  const range = document.createRange();
  const lines = [];
  let start = 0;
  let top = null;
  let union = null;

  const push = (end) => {
    lines.push({
      text: text.slice(start, end).replace(/\s+$/, ""),
      rect: union ? rectToPage(union) : null,
    });
  };
  const extend = (r) => {
    if (!union) {
      union = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      return;
    }
    union.left = Math.min(union.left, r.left);
    union.top = Math.min(union.top, r.top);
    union.right = Math.max(union.right, r.right);
    union.bottom = Math.max(union.bottom, r.bottom);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      push(i);
      start = i + 1;
      top = null;
      union = null;
      continue;
    }
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) continue;
    if (top === null) {
      top = r.top;
      extend(r);
    } else if (Math.abs(r.top - top) > r.height * 0.5) {
      // wrapped: the previous line ends before this character
      push(i);
      start = i;
      top = r.top;
      union = null;
      extend(r);
    } else {
      extend(r);
    }
  }
  push(text.length);
  range.detach?.();
  return lines
    .filter((l) => l.text && l.rect)
    .map((l) => ({
      ...l,
      rect: { ...l.rect, width: l.rect.right - l.rect.left },
    }));
}

export default async function collectFreeTextVectorItems(svgEl) {
  const screenCtm = svgEl?.getScreenCTM?.();
  if (!screenCtm) return [];
  const screenToPage = screenCtm.inverse();
  const toPage = (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(screenToPage);
    return { x: p.x, y: p.y };
  };
  const rectToPage = (r) => {
    const a = toPage(r.left, r.top);
    const b = toPage(r.right, r.bottom);
    return {
      x: a.x,
      y: a.y,
      width: b.x - a.x,
      height: b.y - a.y,
      left: a.x,
      top: a.y,
      right: b.x,
      bottom: b.y,
    };
  };

  const items = [];
  const groups = Array.from(svgEl.querySelectorAll(FREE_TEXT_NODE_SELECTOR));
  for (const group of groups) {
    const box = group.querySelector('[data-part-type="LABEL_BOX"]');
    const span = box?.querySelector("span");
    const fo = group.querySelector("foreignObject");
    if (!box || !span || !fo) continue;

    // text: the live textarea while editing, else the persisted textContent
    // (the span shows a placeholder when empty — never exported)
    const textarea = box.querySelector("textarea");
    let text;
    if (textarea) {
      text = textarea.value;
    } else {
      const id = group.getAttribute("data-node-id");
      const record = id ? await db.annotations.get(id) : null;
      text = record?.textContent ?? "";
    }
    if (!text?.trim()) continue;

    // page points per CSS px inside the box (page-pt scale × containerK …)
    const foCtm = fo.getScreenCTM?.();
    if (!foCtm) continue;
    const scale = screenToPage.multiply(foCtm).a;
    if (!(scale > 0)) continue;

    const fontSizeCss = parseFloat(span.style.fontSize) || 14;
    const weight = String(span.style.fontWeight || "normal");
    const decoration = `${span.style.textDecoration || ""} ${
      span.style.textDecorationLine || ""
    }`;
    const borderWidthCss =
      parseFloat(box.style.borderWidth || box.style.borderTopWidth) || 0;
    const borderColor = parseCssColor(
      box.style.borderColor || box.style.borderTopColor
    );

    const lines = getVisualLines(span, rectToPage);
    if (lines.length === 0) continue;

    let connector = null;
    const polyline = group.querySelector("polyline");
    const dotEl = group.querySelector('circle[data-part-type="TARGET"]');
    if (polyline) {
      const ctm = polyline.getScreenCTM?.();
      const pts = ctm
        ? Array.from(polyline.points).map((p) => {
            const s = new DOMPoint(p.x, p.y).matrixTransform(ctm);
            return toPage(s.x, s.y);
          })
        : [];
      let dot = null;
      if (dotEl) {
        const r = dotEl.getBoundingClientRect();
        dot = toPage(r.left + r.width / 2, r.top + r.height / 2);
      }
      if (pts.length >= 2) connector = { points: pts, dot };
    }

    items.push({
      rect: rectToPage(box.getBoundingClientRect()),
      innerRect: rectToPage(span.getBoundingClientRect()),
      background: parseCssColor(box.style.backgroundColor),
      border:
        borderColor && borderWidthCss > 0
          ? { color: borderColor, width: borderWidthCss * scale }
          : null,
      font: {
        family: getStandardFontFamily(span.style.fontFamily),
        bold: weight === "bold" || parseInt(weight, 10) >= 600,
        italic: span.style.fontStyle === "italic",
        underline: decoration.includes("underline"),
      },
      fontSize: fontSizeCss * scale,
      textColor: parseCssColor(
        textarea ? textarea.style.color : span.style.color
      ) ?? { r: 0, g: 0, b: 0 },
      textAlign: String(span.style.textAlign || "left").toLowerCase(),
      lines,
      connector,
    });
  }
  return items;
}
