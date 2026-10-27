import { createScanZoneFilter } from "./localScanZone.js";

const TYPES = {
  float: [4, "getFloat32"],
  float32: [4, "getFloat32"],
  double: [8, "getFloat64"],
  float64: [8, "getFloat64"],
  uchar: [1, "getUint8"],
  uint8: [1, "getUint8"],
  char: [1, "getInt8"],
  int8: [1, "getInt8"],
  ushort: [2, "getUint16"],
  uint16: [2, "getUint16"],
  short: [2, "getInt16"],
  int16: [2, "getInt16"],
  uint: [4, "getUint32"],
  uint32: [4, "getUint32"],
  int: [4, "getInt32"],
  int32: [4, "getInt32"],
};
export const MAX_SCAN_POINTS = 40_000_000;
export const MAX_SPLAT_POINTS = 5_000_000;
export const MAX_SCAN_BYTES = 2 * 1024 * 1024 * 1024;

export async function readLocalPlyHeader(file) {
  if (file.size > MAX_SCAN_BYTES)
    throw new Error(
      "Ce prototype accepte les fichiers jusqu'à 2 Gio. Exportez une zone plus petite."
    );
  const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  const end = /(?:^|\n)end_header\r?\n/.exec(text);
  if (!text.startsWith("ply\n") && !text.startsWith("ply\r\n"))
    throw new Error("Le fichier n'est pas un PLY.");
  if (!end) throw new Error("En-tête PLY absent ou trop long.");
  const headerLength = end.index + end[0].length;
  const lines = text.slice(0, headerLength).split(/\r?\n/);
  let element = null;
  let count = 0;
  let stride = 0;
  let littleEndian;
  const properties = {};
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "format") {
      if (!["binary_little_endian", "binary_big_endian"].includes(parts[1]))
        throw new Error(
          "Exportez le PLY en format binaire (ASCII non pris en charge)."
        );
      littleEndian = parts[1] === "binary_little_endian";
    }
    if (parts[0] === "element") {
      element = parts[1];
      const size = Number(parts[2]);
      if (element !== "vertex" && size !== 0)
        throw new Error(
          "Ce panneau accepte les points et splats uniquement. Utilisez l'import Scène 3D pour un maillage."
        );
      if (element === "vertex") count = size;
    }
    if (parts[0] === "property" && element === "vertex") {
      const type = TYPES[parts[1]];
      if (!type || properties[parts[2]])
        throw new Error("Structure de propriétés PLY non prise en charge.");
      properties[parts[2]] = { offset: stride, size: type[0], read: type[1] };
      stride += type[0];
    }
  }
  if (
    littleEndian === undefined ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > MAX_SCAN_POINTS
  )
    throw new Error(
      "Nombre de points invalide ou supérieur à la limite de 40 millions."
    );
  if (!["x", "y", "z"].every((key) => properties[key]))
    throw new Error("Le PLY ne contient pas de coordonnées x, y, z.");
  if (headerLength + count * stride !== file.size)
    throw new Error("Taille du PLY incohérente avec son en-tête.");
  const splatKeys = [
    "f_dc_0",
    "f_dc_1",
    "f_dc_2",
    "opacity",
    "scale_0",
    "scale_1",
    "scale_2",
    "rot_0",
    "rot_1",
    "rot_2",
    "rot_3",
  ];
  const isSplat = splatKeys.every((key) => properties[key]);
  if (isSplat && count > MAX_SPLAT_POINTS)
    throw new Error(
      "Le rendu Gaussian Splatting reste limité à 5 millions de gaussiennes."
    );
  if (!isSplat && splatKeys.some((key) => properties[key]))
    throw new Error("Les propriétés Gaussian Splatting sont incomplètes.");
  return {
    count,
    stride,
    headerLength,
    properties,
    littleEndian,
    kind: isSplat ? "SPLAT" : "POINTS",
  };
}

const clampByte = (value) => Math.round(Math.max(0, Math.min(255, value)));

// Bounded reads avoid retaining a second full copy of the source file.
// options:
//   maxPoints  keep one vertex out of ceil(count / maxPoints) (preview sample)
//   zone       keep only the vertices of a load zone (createScanZoneFilter);
//              the decoded arrays then hold the zone only.
export async function readLocalPly(
  file,
  onProgress = () => {},
  { maxPoints, zone } = {}
) {
  const header = await readLocalPlyHeader(file);
  const { count, stride, headerLength, properties, littleEndian, kind } =
    header;
  const step = maxPoints > 0 ? Math.max(1, Math.ceil(count / maxPoints)) : 1;
  const keep = createScanZoneFilter(zone);
  // Without a zone the kept count is known: fill one allocation. With a zone
  // it is not: collect per-slice buffers and join them at the end.
  const capacity = Math.ceil(count / step);
  let positions = keep ? null : new Float32Array(capacity * 3);
  let colors = keep ? null : new Uint8Array(capacity * 3);
  const parts = [];
  let kept = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const point = [0, 0, 0],
    color = [0, 0, 0];
  for (let start = 0; start < count; start += 65536) {
    const length = Math.min(65536, count - start);
    const view = new DataView(
      await file
        .slice(
          headerLength + start * stride,
          headerLength + (start + length) * stride
        )
        .arrayBuffer()
    );
    const read = (i, key, fallback = 0) => {
      const p = properties[key];
      return p ? view[p.read](i * stride + p.offset, littleEndian) : fallback;
    };
    const slicePositions = keep ? new Float32Array(length * 3) : positions;
    const sliceColors = keep ? new Uint8Array(length * 3) : colors;
    let sliceKept = keep ? 0 : kept;
    for (let i = (step - (start % step)) % step; i < length; i += step) {
      for (let axis = 0; axis < 3; axis++) {
        const value = read(i, ["x", "y", "z"][axis]);
        if (!Number.isFinite(value) || Math.abs(value) > 1e7)
          throw new Error(
            "Coordonnées invalides ou trop éloignées de l'origine. Exportez dans un repère local."
          );
        point[axis] = value;
      }
      if (keep && !keep(point[0], point[1], point[2])) continue;
      for (let axis = 0; axis < 3; axis++) {
        const key = ["red", "green", "blue"][axis];
        const value =
          kind === "SPLAT"
            ? (0.5 + 0.28209479177387814 * read(i, `f_dc_${axis}`)) * 255
            : read(i, key, 180) / (properties[key]?.size === 2 ? 257 : 1);
        if (!Number.isFinite(value)) throw new Error("Couleurs PLY invalides.");
        color[axis] = clampByte(value);
      }
      const index = sliceKept * 3;
      for (let axis = 0; axis < 3; axis++) {
        slicePositions[index + axis] = point[axis];
        sliceColors[index + axis] = color[axis];
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
      sliceKept++;
    }
    if (keep) {
      if (sliceKept)
        parts.push([
          slicePositions.slice(0, sliceKept * 3),
          sliceColors.slice(0, sliceKept * 3),
        ]);
      kept += sliceKept;
    } else kept = sliceKept;
    onProgress((start + length) / count);
  }
  if (!kept) throw new Error("Aucun point dans la zone choisie.");
  if (keep) {
    positions = new Float32Array(kept * 3);
    colors = new Uint8Array(kept * 3);
    let offset = 0;
    for (const [p, c] of parts) {
      positions.set(p, offset);
      colors.set(c, offset);
      offset += p.length;
    }
  }
  return {
    positions,
    colors,
    count: kept,
    sourceCount: count,
    kind,
    bounds: { min, max },
  };
}
