// Pure geometry + content engine for title blocks (cartouches).
// Resolves a manifest against a target rect into absolute-coordinate
// primitives, in SVG coordinates (top-left origin, 1 unit == 1 PDF pt).
// Consumed by TitleBlockSvg (screen) and drawTitleBlockOnPdfPage (export)
// so both renderers do zero geometry and stay in sync by construction.
//
// Cell model: every cell is a value cell carrying its own `label`, rendered
// as a small uppercase caption band at the top of the cell, with the value
// vertically centered in the remaining band below.

// Text paddings, shared by both renderers (px == pt).
export const PAD_VALUE_LEFT = 8;
export const PAD_VALUE_RIGHT = 4;
export const PAD_LABEL_RIGHT = 6;

function resolveColumnWidths(columns, rectWidth, isNarrow) {
  const widths = new Array(columns.length).fill(0);

  // 1. fixed columns (narrowWidth { ratio, max } is proportional to the FULL width)
  columns.forEach((col, i) => {
    if (col.flex) return;
    if (isNarrow && col.narrowWidth != null) {
      const nw = col.narrowWidth;
      widths[i] =
        typeof nw === "number"
          ? nw
          : Math.min(
              nw.max ?? Infinity,
              Math.round(rectWidth * (nw.ratio ?? 0))
            );
    } else if (col.width != null) {
      widths[i] = col.width;
    }
  });

  // 2. ratio columns, proportional to the width remaining after fixed columns
  const fixedTotal = widths.reduce((sum, w) => sum + w, 0);
  const remaining = rectWidth - fixedTotal;
  columns.forEach((col, i) => {
    if (col.flex || widths[i]) return;
    if (col.ratio != null) {
      widths[i] = Math.max(col.min ?? 0, Math.round(remaining * col.ratio));
    }
  });

  // 3. flex column absorbs the remainder
  const usedTotal = widths.reduce((sum, w) => sum + w, 0);
  columns.forEach((col, i) => {
    if (col.flex) widths[i] = rectWidth - usedTotal;
  });

  return widths;
}

function resolveCellValue(cell, { values, bindings }) {
  const bind = cell.bind;
  if (!bind) return cell.text || "";
  if (bind.startsWith("field:")) {
    // fallbackBind: live default when the field has no stored value
    // (e.g. chantier falling back to project.name until overridden).
    return (
      values?.[bind.slice(6)] ||
      (cell.fallbackBind ? bindings?.[cell.fallbackBind] : "") ||
      ""
    );
  }
  return bindings?.[bind] || "";
}

/**
 * @returns {{
 *   frame: {x, y, width, height},
 *   lines: Array<{x1, y1, x2, y2}>,
 *   texts: Array<{x, y, width, height, text, spans, kind, bold, align,
 *     fontSize, isPageNum}>, // `spans` ([{text, bold}]) replaces `text`
 *   imageSlots: Array<{key, x, y, width, height}>,
 *   svgPaths: Array<{d, x, y, scale, fill, stroke, strokeWidth}>,
 *   pageNumCell: {x, y, width, height} | null,
 * }}
 */
export default function computeTitleBlockLayout(
  manifest,
  rect,
  { variant, values, bindings, labelOverrides } = {}
) {
  const isNarrow = variant === "BOTTOM_RIGHT";
  const style = manifest.style || {};
  const rowHeights = manifest.rowHeights || [];
  const columns = manifest.columns || [];
  const cells = manifest.cells || [];
  const labelBandH = style.labelBandHeight ?? 13;

  const colWidths = resolveColumnWidths(columns, rect.width, isNarrow);

  // column x positions + index by key
  const colX = [];
  let x = rect.x;
  columns.forEach((col, i) => {
    colX.push(x);
    x += colWidths[i];
  });
  const colIndexByKey = Object.fromEntries(columns.map((c, i) => [c.key, i]));

  // row y positions
  const rowY = [];
  let y = rect.y;
  rowHeights.forEach((h) => {
    rowY.push(y);
    y += h;
  });
  const rectBottom = rect.y + rect.height;

  const frame = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
  const lines = [];
  const texts = [];
  const imageSlots = [];
  const svgPaths = [];
  let pageNumCell = null;

  // logo slot spans all rows of its column, minus the optional footer band
  const logoColIdx =
    manifest.logoSlot != null ? colIndexByKey[manifest.logoSlot.col] : null;
  const footer = manifest.logoSlot?.footer;
  const footerH = footer?.height ?? 0;
  if (logoColIdx != null) {
    const padding = manifest.logoSlot.padding ?? 4;
    imageSlots.push({
      key: manifest.logoSlot.col,
      x: colX[logoColIdx] + padding,
      y: rect.y + padding,
      width: colWidths[logoColIdx] - 2 * padding,
      height: rect.height - 2 * padding - footerH,
    });
  }

  // vertical separators: full height at the logo right edge (the logo spans
  // all rows), per-row segments elsewhere so a colSpan cell can suppress the
  // boundaries it crosses on its row
  const suppressedBoundaries = new Set(); // `${row}:${boundaryIdx}`
  for (const cell of cells) {
    const colIdx = colIndexByKey[cell.col];
    if (colIdx == null || cell.row == null) continue;
    const span = cell.colSpan ?? 1;
    for (let b = colIdx + 1; b < colIdx + span; b++) {
      suppressedBoundaries.add(`${cell.row}:${b}`);
    }
  }
  for (let i = 1; i < columns.length; i++) {
    if (logoColIdx != null && i === logoColIdx + 1) {
      lines.push({ x1: colX[i], y1: rect.y, x2: colX[i], y2: rectBottom });
      continue;
    }
    rowY.forEach((ry, r) => {
      if (suppressedBoundaries.has(`${r}:${i}`)) return;
      lines.push({ x1: colX[i], y1: ry, x2: colX[i], y2: ry + rowHeights[r] });
    });
  }

  // horizontal separators at each interior row boundary, starting after the
  // logo column (the logo spans all rows)
  const hLineStartX =
    logoColIdx != null ? colX[logoColIdx] + colWidths[logoColIdx] : rect.x;
  for (let i = 1; i < rowY.length; i++) {
    lines.push({
      x1: hLineStartX,
      y1: rowY[i],
      x2: rect.x + rect.width,
      y2: rowY[i],
    });
  }

  // cells: uppercase label band on top + value band below
  const textCtx = { values, bindings };
  for (const cell of cells) {
    const colIdx = colIndexByKey[cell.col];
    if (colIdx == null || cell.row == null || rowY[cell.row] == null) continue;

    const cellY = rowY[cell.row];
    const cellH = rowHeights[cell.row];
    const cellX = colX[colIdx];
    const span = cell.colSpan ?? 1;
    let cellW = 0;
    for (let c = colIdx; c < Math.min(colIdx + span, columns.length); c++) {
      cellW += colWidths[c];
    }

    const align = cell.align ?? (cell.center ? "center" : "left");
    const labelText = (
      labelOverrides?.[cell.legacyLabelKey] ||
      cell.label ||
      ""
    ).toUpperCase();

    if (labelText) {
      texts.push({
        x: cellX,
        y: cellY,
        width: cellW,
        height: labelBandH,
        kind: "label",
        align: align === "right" ? "right" : "left",
        fontSize: style.labelFontSize ?? 6.5,
        text: labelText,
      });
    }

    const valueY = labelText ? cellY + labelBandH : cellY;
    const valueH = labelText ? cellH - labelBandH : cellH;
    const valueCell = {
      x: cellX,
      y: valueY,
      width: cellW,
      height: valueH,
      kind: "value",
      text: resolveCellValue(cell, textCtx),
      bold: !!cell.bold,
      align,
      fontSize: style.valueFontSize ?? 10,
      isPageNum: cell.bind === "pageNum",
    };
    texts.push(valueCell);
    if (valueCell.isPageNum) {
      pageNumCell = { x: cellX, y: valueY, width: cellW, height: valueH };
    }
  }

  // logo column footer (e.g. "CRÉÉ AVEC Krto ®"), mixed-weight spans
  if (logoColIdx != null && footer?.spans?.length) {
    texts.push({
      x: colX[logoColIdx],
      y: rectBottom - footerH,
      width: colWidths[logoColIdx],
      height: footerH,
      kind: "label",
      align: "left",
      fontSize: footer.fontSize ?? 6,
      spans: footer.spans,
    });
  }

  // decorations (vector art), relative to the rect top-left
  for (const dec of manifest.decorations || []) {
    if (dec.type !== "svgPath" || !dec.d) continue;
    svgPaths.push({
      d: dec.d,
      x: rect.x + (dec.x ?? 0),
      y: rect.y + (dec.y ?? 0),
      scale: dec.scale ?? 1,
      fill: dec.fill ?? null,
      stroke: dec.stroke ?? null,
      strokeWidth: dec.strokeWidth ?? 1,
    });
  }

  return { frame, lines, texts, imageSlots, svgPaths, pageNumCell };
}
