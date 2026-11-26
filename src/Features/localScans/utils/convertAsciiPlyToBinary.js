import { MAX_SCAN_POINTS, PLY_TYPES } from "./readLocalPly.js";

const HEADER_PROBE_BYTES = 65536;
const DEFAULT_SLICE_BYTES = 8 * 1024 * 1024;
const BLOCK_VERTICES = 65536;
const FLOAT_SETTERS = ["setFloat32", "setFloat64"];
const NON_FINITE = { nan: NaN, inf: Infinity, "+inf": Infinity };
const INCONSISTENT = "Taille du PLY incohérente avec son en-tête.";

async function readHeaderText(file) {
  const bytes = new Uint8Array(
    await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer()
  );
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith("ply\n") && !text.startsWith("ply\r\n"))
    throw new Error("Le fichier n'est pas un PLY.");
  const end = /(?:^|\n)end_header\r?\n/.exec(text);
  if (!end) throw new Error("En-tête PLY absent ou trop long.");
  return text.slice(0, end.index + end[0].length);
}

// → true when the PLY header declares `format ascii`.
export async function isAsciiPly(file) {
  const header = await readHeaderText(file);
  return /(?:^|\n)format\s+ascii\b/.test(header);
}

function parseAsciiHeader(headerText) {
  const lines = headerText.split(/\r?\n/);
  let element = null;
  let count = 0;
  let stride = 0;
  let isAscii = false;
  const properties = [];
  const kept = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "format") isAscii = parts[1] === "ascii";
    if (parts[0] === "comment" || parts[0] === "obj_info")
      kept.push(line.trim());
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
      const type = PLY_TYPES[parts[1]];
      if (!type)
        throw new Error("Structure de propriétés PLY non prise en charge.");
      properties.push({
        line: line.trim(),
        offset: stride,
        write: type[1].replace("get", "set"),
      });
      stride += type[0];
    }
  }
  if (!isAscii) throw new Error("Le PLY n'est pas au format ASCII.");
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_SCAN_POINTS)
    throw new Error(
      "Nombre de points invalide ou supérieur à la limite de 40 millions."
    );
  if (!properties.length)
    throw new Error("Structure de propriétés PLY non prise en charge.");
  const header = [
    "ply",
    "format binary_little_endian 1.0",
    ...kept,
    `element vertex ${count}`,
    ...properties.map((p) => p.line),
    "end_header",
    "",
  ].join("\n");
  return { count, stride, properties, header };
}

function parseValue(token, isFloat) {
  const value = Number(token);
  if (Number.isFinite(value)) return value;
  if (isFloat) {
    const lower = token.toLowerCase();
    if (lower in NON_FINITE) return NON_FINITE[lower];
    if (lower === "-inf") return -Infinity;
  }
  throw new Error(`Valeur PLY invalide : « ${token.slice(0, 24)} ».`);
}

// Rewrites an ASCII point-cloud PLY as binary_little_endian, keeping the
// vertex properties and their types, so the binary-only decoder
// (readLocalPly) and the stored resource work on a fixed-stride file.
// The source is read in bounded slices: no full copy is held in memory.
// → File (same name as the source)
export default async function convertAsciiPlyToBinary(
  file,
  onProgress = () => {},
  { sliceBytes = DEFAULT_SLICE_BYTES } = {}
) {
  const headerText = await readHeaderText(file);
  const { count, stride, properties, header } = parseAsciiHeader(headerText);
  const propertyCount = properties.length;
  const isFloat = properties.map((p) => FLOAT_SETTERS.includes(p.write));
  const decoder = new TextDecoder("latin1");
  const parts = [header];

  let blockLength = Math.min(BLOCK_VERTICES, count);
  let view = new DataView(new ArrayBuffer(blockLength * stride));
  let blockVertex = 0; // vertices completed in the current block
  let written = 0; // vertices completed in previous blocks
  let property = 0; // next property of the current vertex

  let position = headerText.length;
  let length = sliceBytes;
  while (position < file.size) {
    const end = Math.min(file.size, position + length);
    const bytes = new Uint8Array(await file.slice(position, end).arrayBuffer());
    // a value cut by the slice end is left for the next slice
    let usable = bytes.length;
    if (end < file.size) {
      while (usable > 0 && bytes[usable - 1] > 32) usable--;
      if (usable === 0) {
        length *= 2;
        continue;
      }
    }
    const text = decoder.decode(bytes.subarray(0, usable));
    let i = 0;
    while (i < usable) {
      if (bytes[i] <= 32) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < usable && bytes[j] > 32) j++;
      if (written + blockVertex >= count) throw new Error(INCONSISTENT);
      const p = properties[property];
      view[p.write](
        blockVertex * stride + p.offset,
        parseValue(text.slice(i, j), isFloat[property]),
        true
      );
      if (++property === propertyCount) {
        property = 0;
        if (++blockVertex === blockLength) {
          parts.push(view.buffer);
          written += blockLength;
          blockVertex = 0;
          blockLength = Math.min(BLOCK_VERTICES, count - written);
          if (blockLength)
            view = new DataView(new ArrayBuffer(blockLength * stride));
        }
      }
      i = j;
    }
    position += usable;
    length = sliceBytes;
    onProgress(position / file.size);
  }
  if (written !== count || property !== 0) throw new Error(INCONSISTENT);
  return new File(parts, file.name ?? "scan.ply", {
    type: file.type,
    lastModified: file.lastModified,
  });
}
