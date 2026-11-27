import { MAX_SCAN_POINTS } from "./readLocalPly.js";

// LAS / LAZ public header block (ASPRS LAS 1.0 → 1.4). A .laz is a LAS file
// whose point records are compressed: same header, bit 7 of the point format.

const HEADER_PROBE_BYTES = 375; // LAS 1.4 header size
const MIN_HEADER_BYTES = 227; // LAS 1.0 → 1.2 header size

// The file is read and decompressed chunk by chunk (convertLasToPly): its
// size only costs time. The converted PLY obeys the cap of the scan decoder:
// a larger cloud is decimated (one point out of `skip`).
export const MAX_LAZ_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_LAZ_POINTS = MAX_SCAN_POINTS;
// LASzip formats the chunk decoder (laz-perf) reads; the waveform formats
// (4, 5, 9, 10) are not supported compressed.
const LAZ_POINT_FORMATS = [0, 1, 2, 3, 6, 7, 8];
// Beyond this distance from the origin (m) the Float32 of the stored PLY no
// longer holds the millimetre: the cloud is recentred on a recorded origin.
export const LAZ_RECENTER_DISTANCE = 10_000;

const fail = (code, message) => Object.assign(new Error(message), { code });

// → {version: "1.4", versionMinor, pointFormat, isCompressed, pointCount,
//    headerSize, pointDataOffset, vlrCount, recordLength, scale, offset,
//    min, max}
export async function readLasHeader(file) {
  const buffer = await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer();
  const view = new DataView(buffer);
  const signature =
    buffer.byteLength >= 4
      ? String.fromCharCode(...new Uint8Array(buffer, 0, 4))
      : "";
  if (signature !== "LASF" || buffer.byteLength < MIN_HEADER_BYTES)
    throw fail("LAS_INVALID", "Le fichier n'est pas un LAS / LAZ valide.");

  const versionMajor = view.getUint8(24);
  const versionMinor = view.getUint8(25);
  if (versionMajor !== 1 || versionMinor > 4)
    throw fail(
      "LAS_VERSION",
      `Version LAS ${versionMajor}.${versionMinor} non prise en charge.`
    );
  const formatByte = view.getUint8(104);
  const pointFormat = formatByte & 0x3f;
  if (pointFormat > 10)
    throw fail(
      "LAS_POINT_FORMAT",
      `Format de point LAS ${pointFormat} non pris en charge.`
    );

  const triple = (start) =>
    [0, 1, 2].map((i) => view.getFloat64(start + i * 8, true));
  const bounds = [0, 1, 2, 3, 4, 5].map((i) =>
    view.getFloat64(179 + i * 8, true)
  );

  // LAS 1.4 holds the count as 64 bits; the legacy 32-bit field is then 0
  // for the point formats 6 → 10.
  let pointCount = view.getUint32(107, true);
  if (versionMinor >= 4 && buffer.byteLength >= 255) {
    const count64 = Number(view.getBigUint64(247, true));
    if (count64 > 0) pointCount = count64;
  }
  if (!Number.isSafeInteger(pointCount) || pointCount < 1)
    throw fail("LAS_EMPTY", "Le fichier LAS / LAZ ne contient aucun point.");

  return {
    version: `${versionMajor}.${versionMinor}`,
    versionMinor,
    pointFormat,
    isCompressed: (formatByte & 0x80) !== 0,
    pointCount,
    headerSize: view.getUint16(94, true),
    pointDataOffset: view.getUint32(96, true),
    vlrCount: view.getUint32(100, true),
    recordLength: view.getUint16(105, true),
    scale: triple(131),
    offset: triple(155),
    max: [bounds[0], bounds[2], bounds[4]],
    min: [bounds[1], bounds[3], bounds[5]],
  };
}

// How a file is converted: decimation step and decoded point count.
export function getLazConversionPlan(header, fileSize) {
  if (fileSize > MAX_LAZ_BYTES)
    throw fail(
      "LAS_TOO_LARGE",
      "Le fichier LAS / LAZ dépasse 4 Gio. Exportez une zone plus petite."
    );
  if (header.isCompressed && !LAZ_POINT_FORMATS.includes(header.pointFormat))
    throw fail(
      "LAS_POINT_FORMAT",
      `Format de point LAZ ${header.pointFormat} non pris en charge (formes d'onde).`
    );
  const skip = Math.max(1, Math.ceil(header.pointCount / MAX_LAZ_POINTS));
  return { skip, decodedCount: Math.ceil(header.pointCount / skip) };
}

// Origin subtracted from the coordinates before they are written as Float32:
// [0, 0, 0] for a cloud already in a local frame, else the bbox centre in
// plan (rounded to the metre) and the lowest point (rounded down).
export function getLazOrigin(min, max) {
  const reach = Math.max(...min.map(Math.abs), ...max.map(Math.abs));
  if (!(reach > LAZ_RECENTER_DISTANCE)) return [0, 0, 0];
  return [
    Math.round((min[0] + max[0]) / 2),
    Math.round((min[1] + max[1]) / 2),
    Math.floor(min[2]),
  ];
}
