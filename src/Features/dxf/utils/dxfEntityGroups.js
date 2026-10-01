import aciColors from "dxf-parser/dist/AutoCadColorIndex.js";

// Custom handlers follow dxf-parser's public registerEntityHandler contract:
// leave lastReadGroup on the next entity's code 0.
export function readEntityGroups(scanner) {
  const groups = [];
  while (!scanner.isEOF()) {
    const group = scanner.next();
    if (group.code === 0) break;
    groups.push(group);
  }
  return groups;
}

export const groupValue = (groups, code, fallback) =>
  groups.find((group) => group.code === code)?.value ?? fallback;

export function groupPoint(groups, code) {
  return {
    x: groupValue(groups, code, 0),
    y: groupValue(groups, code + 10, 0),
  };
}

export function commonEntity(groups, type) {
  const colorIndex = groupValue(groups, 62);
  return {
    type,
    handle: groupValue(groups, 5),
    layer: groupValue(groups, 8, "0"),
    inPaperSpace: Boolean(groupValue(groups, 67, 0)),
    visible: groupValue(groups, 60, 0) === 0,
    colorIndex,
    color: groupValue(groups, 420, aciColors[Math.abs(colorIndex)]),
    extrusionDirection: {
      x: groupValue(groups, 210, 0),
      y: groupValue(groups, 220, 0),
      z: groupValue(groups, 230, 1),
    },
  };
}
