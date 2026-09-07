import { StandardFonts, rgb } from "pdf-lib";

import sanitizeWinAnsiText from "Features/titleBlocks/utils/sanitizeWinAnsiText";

// Vector redraw of FREE_TEXT items (collectFreeTextVectorItems) with pdf-lib:
// background + border rect, optional connector (leader line + target dot),
// then one drawText per visual line. Items are in page points, SVG top-left
// coords; pdf-lib is bottom-left.

const STANDARD_FONT_BY_KEY = {
  "helvetica::": StandardFonts.Helvetica,
  "helvetica:b:": StandardFonts.HelveticaBold,
  "helvetica::i": StandardFonts.HelveticaOblique,
  "helvetica:b:i": StandardFonts.HelveticaBoldOblique,
  "times::": StandardFonts.TimesRoman,
  "times:b:": StandardFonts.TimesRomanBold,
  "times::i": StandardFonts.TimesRomanItalic,
  "times:b:i": StandardFonts.TimesRomanBoldItalic,
  "courier::": StandardFonts.Courier,
  "courier:b:": StandardFonts.CourierBold,
  "courier::i": StandardFonts.CourierOblique,
  "courier:b:i": StandardFonts.CourierBoldOblique,
};

// Ascent ratio (baseline below the top of the text content area) of the
// screen fonts behind each standard family — Roboto/Arial ≈ 0.92, Times New
// Roman ≈ 0.89, Courier New ≈ 0.83.
const ASCENT_BY_FAMILY = { helvetica: 0.92, times: 0.89, courier: 0.83 };

const LEADER_COLOR = rgb(0, 0, 0);
const LEADER_OPACITY = 0.7;
const LEADER_WIDTH = 1.5;
const DOT_RADIUS = 2;

function fontKey(font) {
  return `${font.family}:${font.bold ? "b" : ""}:${font.italic ? "i" : ""}`;
}

function toRgb(c) {
  return rgb(c.r, c.g, c.b);
}

// Lazily embeds the standard fonts used by the items (async), then serves
// them synchronously to drawFreeTextItemsOnPdfPage.
export function createFreeTextFontProvider(pdfDoc) {
  const fonts = new Map();
  const charSets = new Map(); // font → Set of encodable code points
  return {
    async ensure(items) {
      for (const item of items ?? []) {
        const key = fontKey(item.font);
        if (fonts.has(key)) continue;
        const std = STANDARD_FONT_BY_KEY[key] ?? StandardFonts.Helvetica;
        fonts.set(key, await pdfDoc.embedFont(std));
      }
    },
    get(font) {
      return fonts.get(fontKey(font)) ?? fonts.get("helvetica::") ?? null;
    },
    // Keeps only the characters the standard font can encode (WinAnsi:
    // accents, em dash, curly quotes, €… are fine; CJK, emoji, ✓ are not —
    // drawText would throw on them). Falls back to the shared sanitizer.
    sanitize(font, text) {
      let set = charSets.get(font);
      if (!set) {
        try {
          set = new Set(font.getCharacterSet());
        } catch {
          set = null;
        }
        charSets.set(font, set);
      }
      if (!set) return sanitizeWinAnsiText(text);
      let out = "";
      for (const ch of String(text ?? "")) {
        if (set.has(ch.codePointAt(0))) out += ch;
      }
      return out;
    },
  };
}

export default function drawFreeTextItemsOnPdfPage(
  pdfPage,
  items,
  fontProvider
) {
  if (!items?.length) return;
  const pageHeight = pdfPage.getSize().height;
  const flipY = (y) => pageHeight - y;

  for (const item of items) {
    const font = fontProvider.get(item.font);
    if (!font) continue;
    const { rect, innerRect, fontSize } = item;

    // connector under the box
    if (item.connector) {
      const pts = item.connector.points;
      for (let i = 1; i < pts.length; i++) {
        pdfPage.drawLine({
          start: { x: pts[i - 1].x, y: flipY(pts[i - 1].y) },
          end: { x: pts[i].x, y: flipY(pts[i].y) },
          thickness: LEADER_WIDTH,
          color: LEADER_COLOR,
          opacity: LEADER_OPACITY,
        });
      }
      const dot = item.connector.dot;
      if (dot) {
        pdfPage.drawCircle({
          x: dot.x,
          y: flipY(dot.y),
          size: DOT_RADIUS,
          color: LEADER_COLOR,
          borderColor: rgb(1, 1, 1),
          borderWidth: 0.5,
        });
      }
    }

    // box: background and/or border
    if (item.background || item.border) {
      pdfPage.drawRectangle({
        x: rect.x,
        y: flipY(rect.y + rect.height),
        width: rect.width,
        height: rect.height,
        ...(item.background && { color: toRgb(item.background) }),
        ...(item.border && {
          borderColor: toRgb(item.border.color),
          borderWidth: item.border.width,
        }),
      });
    }

    // text lines
    const ascent = ASCENT_BY_FAMILY[item.font.family] ?? 0.92;
    const color = toRgb(item.textColor);
    for (const line of item.lines) {
      const text = fontProvider.sanitize(font, line.text).replace(/\s+$/, "");
      if (!text) continue;
      const width = font.widthOfTextAtSize(text, fontSize);
      let x = line.rect.x;
      if (item.textAlign === "center") {
        x = innerRect.x + (innerRect.width - width) / 2;
      } else if (item.textAlign === "right") {
        x = innerRect.x + innerRect.width - width;
      }
      const baseline = line.rect.y + ascent * fontSize;
      pdfPage.drawText(text, {
        x,
        y: flipY(baseline),
        size: fontSize,
        font,
        color,
      });
      if (item.font.underline) {
        const uy = flipY(baseline + fontSize * 0.12);
        pdfPage.drawLine({
          start: { x, y: uy },
          end: { x: x + width, y: uy },
          thickness: Math.max(0.4, fontSize * 0.06),
          color,
        });
      }
    }
  }
}
