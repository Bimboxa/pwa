// Pure geometry + content engine for title blocks (cartouches).
// Resolves a manifest against a target rect into absolute-coordinate
// primitives, in SVG coordinates (top-left origin, 1 unit == 1 PDF pt).
// Consumed by TitleBlockSvg (screen) and drawTitleBlockOnPdfPage (export)
// so both renderers do zero geometry and stay in sync by construction.

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

function resolveCellText(cell, { values, bindings, labelOverrides }) {
  if (cell.kind === "label") {
    return (
      (cell.legacyLabelKey && labelOverrides?.[cell.legacyLabelKey]) ||
      cell.text ||
      ""
    );
  }
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
 *   texts: Array<{x, y, width, height, text, kind, bold, align, fontSize, isPageNum}>,
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

  // logo slot spans all rows of its column
  const logoColIdx =
    manifest.logoSlot != null ? colIndexByKey[manifest.logoSlot.col] : null;
  if (logoColIdx != null) {
    const padding = manifest.logoSlot.padding ?? 4;
    imageSlots.push({
      key: manifest.logoSlot.col,
      x: colX[logoColIdx] + padding,
      y: rect.y + padding,
      width: colWidths[logoColIdx] - 2 * padding,
      height: rect.height - 2 * padding,
    });
  }

  // vertical separators at each interior column boundary, full height
  for (let i = 1; i < columns.length; i++) {
    lines.push({ x1: colX[i], y1: rect.y, x2: colX[i], y2: rectBottom });
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

  // cells
  const textCtx = { values, bindings, labelOverrides };
  for (const cell of manifest.cells || []) {
    const colIdx = colIndexByKey[cell.col];
    if (colIdx == null || cell.row == null || rowY[cell.row] == null) continue;

    const cellY = rowY[cell.row];
    const cellH = rowHeights[cell.row];
    const cellX = colX[colIdx];
    let cellW = colWidths[colIdx];

    const isLabel = cell.kind === "label";
    const base = {
      y: cellY,
      height: cellH,
      kind: cell.kind,
      fontSize: isLabel
        ? (style.labelFontSize ?? 8)
        : (style.valueFontSize ?? 10),
    };

    if (cell.trailing) {
      const trailing = cell.trailing;
      const trailingW = trailing.width ?? 50;
      cellW -= trailingW;
      const trailingX = cellX + cellW;

      // sub-cell separator, within the row only
      lines.push({
        x1: trailingX,
        y1: cellY,
        x2: trailingX,
        y2: cellY + cellH,
      });

      const trailingCell = {
        ...base,
        x: trailingX,
        width: trailingW,
        text: resolveCellText(
          { kind: "value", bind: trailing.bind, text: trailing.text },
          textCtx
        ),
        bold: !!trailing.bold,
        align: trailing.center ? "center" : "left",
        isPageNum: trailing.bind === "pageNum",
      };
      texts.push(trailingCell);
      if (trailingCell.isPageNum) {
        pageNumCell = {
          x: trailingX,
          y: cellY,
          width: trailingW,
          height: cellH,
        };
      }
    }

    const mainCell = {
      ...base,
      x: cellX,
      width: cellW,
      text: resolveCellText(cell, textCtx),
      bold: !!cell.bold,
      align: isLabel ? "right" : cell.center ? "center" : "left",
      isPageNum: cell.bind === "pageNum",
    };
    texts.push(mainCell);
    if (mainCell.isPageNum) {
      pageNumCell = { x: cellX, y: cellY, width: cellW, height: cellH };
    }
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
