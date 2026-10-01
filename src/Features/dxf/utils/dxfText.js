import {
  commonEntity,
  groupValue,
  groupPoint,
  readEntityGroups,
} from "./dxfEntityGroups.js";
import { transform } from "./dxfGeometry.js";

export function plainDxfText(value = "") {
  // Retain content, paragraphs, Unicode and stacked fractions. CAD inline
  // fonts/colors/decorations are intentionally flattened to one text style.
  return String(value)
    .replace(/\\U\+([0-9a-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/%%d/gi, "°")
    .replace(/%%p/gi, "±")
    .replace(/%%c/gi, "Ø")
    .replace(/%%[ou]/gi, "")
    .replace(
      /\\([\\{}])/g,
      (_, char) => ({ "\\": "\ue000", "{": "\ue001", "}": "\ue002" })[char]
    )
    .replace(/\\[PX]/g, "\n")
    .replace(/\\~/g, " ")
    .replace(/\\S([^;]*);/gi, (_, fraction) => fraction.replace(/[\^#]/g, "/"))
    .replace(/\\[ACcFfHhQqTtWwpa][^;]*;/g, "")
    .replace(/\\[LlOoKk]/g, "")
    .replace(/[{}]/g, "")
    .replace(/\ue000/g, "\\")
    .replace(/\ue001/g, "{")
    .replace(/\ue002/g, "}");
}

function readText(scanner, type) {
  const groups = readEntityGroups(scanner);
  const isMtext = type === "MTEXT";
  let angle = 0;
  // DXF MTEXT rotation is in radians; TEXT uses degrees. Last direction wins.
  for (const group of groups) {
    if (group.code === 50) angle = group.value * (isMtext ? 1 : Math.PI / 180);
    if (isMtext && group.code === 11) {
      const direction = groupPoint(groups, 11);
      angle = Math.atan2(direction.y, direction.x);
    }
  }
  const halign = groupValue(groups, 72, 0),
    valign = groupValue(groups, 73, 0);
  return {
    ...commonEntity(groups, type),
    text: groups
      .filter((group) => group.code === 1 || (isMtext && group.code === 3))
      .map((group) => group.value)
      .join(""),
    position: groupPoint(groups, !isMtext && (halign || valign) ? 11 : 10),
    textHeight: groupValue(groups, 40, 1),
    textWidth: isMtext ? groupValue(groups, 41, 0) : 0,
    widthFactor: isMtext ? 1 : groupValue(groups, 41, 1),
    attachment: isMtext ? groupValue(groups, 71, 1) : null,
    halign,
    valign,
    angle,
    unsupportedText:
      !isMtext && ([3, 5].includes(halign) || groupValue(groups, 71, 0) !== 0),
  };
}

export class DxfMtextHandler {
  ForEntityName = "MTEXT";
  parseEntity(scanner) {
    return readText(scanner, "MTEXT");
  }
}

export class DxfTextHandler {
  ForEntityName = "TEXT";
  parseEntity(scanner) {
    return readText(scanner, "TEXT");
  }
}

// Fixed wrapping shared by the canvas and the editable FREE_TEXT annotation.
// Workers can measure with OffscreenCanvas; the fallback is for older browsers.
let measureContext;
function measure(text, height) {
  if (measureContext === undefined) {
    measureContext =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1).getContext("2d")
        : null;
  }
  if (!measureContext) return text.length * height * 0.6;
  measureContext.font = "100px Arial";
  return (measureContext.measureText(text).width * height) / 100;
}

export function makeDxfText(entity, matrix) {
  const text = plainDxfText(entity.text);
  const height = entity.textHeight;
  if (!text.trim() || !(height > 0) || entity.unsupportedText) return null;
  const widthFactor = entity.widthFactor ?? 1;
  if (!(widthFactor > 0)) return null;
  const lines = [];
  const maxWidth = entity.textWidth;
  for (const paragraph of text.split(/\r?\n/)) {
    if (!(maxWidth > 0)) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (line && word.trim() && measure(line + word, height) > maxWidth) {
        lines.push(line.trimEnd());
        line = word;
      } else line += word;
    }
    lines.push(line.trimEnd());
  }
  const width = Math.max(
    height * 0.1,
    maxWidth ||
      Math.max(...lines.map((line) => measure(line, height))) * widthFactor
  );
  const boxHeight = lines.length * height * 1.2;
  const angle = entity.angle ?? 0;
  const xAxis = { x: Math.cos(angle), y: Math.sin(angle) };
  const up = { x: -xAxis.y, y: xAxis.x };
  let h = 0,
    v = 0;
  if (entity.attachment != null) {
    const attachment = Math.max(1, Math.min(9, entity.attachment)) - 1;
    h = (attachment % 3) / 2;
    v = Math.floor(attachment / 3) / 2;
  } else {
    h = [1, 4].includes(entity.halign) ? 0.5 : entity.halign === 2 ? 1 : 0;
    v =
      entity.valign === 3
        ? 0
        : entity.valign === 2 || entity.halign === 4
          ? 0.5
          : 1;
  }
  const p = entity.position;
  const center = {
    x: p.x + xAxis.x * width * (0.5 - h) + up.x * boxHeight * (v - 0.5),
    y: p.y + xAxis.y * width * (0.5 - h) + up.y * boxHeight * (v - 0.5),
  };
  const worldCenter = transform(center, matrix);
  const tx = {
    x: matrix[0] * xAxis.x + matrix[2] * xAxis.y,
    y: matrix[1] * xAxis.x + matrix[3] * xAxis.y,
  };
  const ty = {
    x: matrix[0] * up.x + matrix[2] * up.y,
    y: matrix[1] * up.x + matrix[3] * up.y,
  };
  const sx = Math.hypot(tx.x, tx.y),
    sy = Math.hypot(ty.x, ty.y);
  if (!(sx > 0 && sy > 0)) return null;
  // FREE_TEXT supports rotation, not mirrored or skewed glyphs.
  const approximated =
    matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0 ||
    Math.abs(sx - sy) > 1e-8 ||
    widthFactor !== 1;
  const worldWidth = width * sx,
    worldHeight = boxHeight * sy;
  const rotation = Math.atan2(tx.y, tx.x);
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const points = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: worldCenter.x + (c * x * worldWidth) / 2 - (s * y * worldHeight) / 2,
    y: worldCenter.y + (s * x * worldWidth) / 2 + (c * y * worldHeight) / 2,
  }));
  return {
    kind: "TEXT",
    points,
    center: worldCenter,
    text: lines.join("\n"),
    textHeight: height * sy,
    textWidth: worldWidth,
    rotation,
    textAlign: h === 0.5 ? "CENTER" : h === 1 ? "RIGHT" : "LEFT",
    approximated,
  };
}
