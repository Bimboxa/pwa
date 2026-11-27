import {
  getLazConversionPlan,
  getLazOrigin,
  readLasHeader,
} from "./readLasHeader.js";
import readLazChunkTable from "./readLazChunkTable.js";
import createPointsPlyWriter from "./createPointsPlyWriter.js";

// Bytes read from the file per round (several chunks / many records).
const READ_WINDOW_BYTES = 32 * 1024 * 1024;
const DEFAULT_GREY = 180; // same fallback as readLocalPly

// Byte offset of the RGB triple (3 × uint16) in a point record, per format.
const COLOR_OFFSETS = { 2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30 };

const fail = (code, message) => Object.assign(new Error(message), { code });

const toPlyName = (name) =>
  `${String(name ?? "scan").replace(/\.(laz|las)$/i, "")}.ply`;

const isBox = (min, max) =>
  [...min, ...max].every(Number.isFinite) &&
  min.every((value, axis) => value <= max[axis]);

// Takes the kept point records, turns them into local coordinates + 8-bit
// colours and feeds the PLY writer.
function createPointSink({ header, writer }) {
  const { scale, offset } = header;
  const colorOffset = COLOR_OFFSETS[header.pointFormat] ?? null;
  // origin: from the header bounds, else (unusable bounds) the first point
  let origin = isBox(header.min, header.max)
    ? getLazOrigin(header.min, header.max)
    : null;
  // LAS colours are 16-bit by the book, 8-bit in many files: settled on the
  // first block that holds a non-black colour.
  let colorShift = null;
  const capacity = 65536;
  const xyz = new Float64Array(capacity * 3);
  const rgb = new Uint16Array(capacity * 3);
  let pending = 0;

  const flush = () => {
    if (!pending) return;
    if (colorOffset !== null && colorShift === null) {
      let highest = 0;
      for (let i = 0; i < pending * 3; i++)
        if (rgb[i] > highest) highest = rgb[i];
      if (highest > 0) colorShift = highest > 255 ? 8 : 0;
    }
    const shift = colorShift ?? 0;
    for (let i = 0; i < pending; i++) {
      const k = i * 3;
      if (colorOffset === null)
        writer.push(
          xyz[k],
          xyz[k + 1],
          xyz[k + 2],
          DEFAULT_GREY,
          DEFAULT_GREY,
          DEFAULT_GREY
        );
      else
        writer.push(
          xyz[k],
          xyz[k + 1],
          xyz[k + 2],
          rgb[k] >> shift,
          rgb[k + 1] >> shift,
          rgb[k + 2] >> shift
        );
    }
    pending = 0;
  };

  return {
    // view: DataView holding the record at `byte`
    add(view, byte) {
      const x = view.getInt32(byte, true) * scale[0] + offset[0];
      const y = view.getInt32(byte + 4, true) * scale[1] + offset[1];
      const z = view.getInt32(byte + 8, true) * scale[2] + offset[2];
      if (!origin) origin = getLazOrigin([x, y, z], [x, y, z]);
      const k = pending * 3;
      // double precision until the origin is subtracted
      xyz[k] = x - origin[0];
      xyz[k + 1] = y - origin[1];
      xyz[k + 2] = z - origin[2];
      if (colorOffset !== null) {
        rgb[k] = view.getUint16(byte + colorOffset, true);
        rgb[k + 1] = view.getUint16(byte + colorOffset + 2, true);
        rgb[k + 2] = view.getUint16(byte + colorOffset + 4, true);
      }
      if (++pending === capacity) flush();
    },
    flush,
    getOrigin: () => origin ?? [0, 0, 0],
  };
}

// Uncompressed LAS: fixed-size records, read by windows.
async function readLasRecords(file, header, skip, sink, onProgress) {
  const { recordLength, pointDataOffset, pointCount } = header;
  const perWindow = Math.max(1, Math.floor(READ_WINDOW_BYTES / recordLength));
  for (let start = 0; start < pointCount; start += perWindow) {
    const length = Math.min(perWindow, pointCount - start);
    const from = pointDataOffset + start * recordLength;
    const buffer = await file
      .slice(from, from + length * recordLength)
      .arrayBuffer();
    if (buffer.byteLength < length * recordLength)
      throw fail("LAS_TRUNCATED", "Le fichier LAS est incomplet.");
    const view = new DataView(buffer);
    for (let i = (skip - (start % skip)) % skip; i < length; i += skip)
      sink.add(view, i * recordLength);
    onProgress((start + length) / pointCount);
  }
}

// LAZ: every chunk is read from the file and decoded on its own, so the
// memory holds one read window + one chunk, whatever the file size. Every
// point of a chunk must be decoded, even when only one out of `skip` is kept.
async function readLazRecords(
  file,
  header,
  skip,
  sink,
  onProgress,
  createLazPerf
) {
  const chunks = await readLazChunkTable(file, header);
  const lazPerf = await createLazPerf();
  const { recordLength, pointFormat, pointCount } = header;
  const largest = chunks.reduce((n, c) => Math.max(n, c.byteLength), 0);
  const dataPtr = lazPerf._malloc(largest);
  const recordPtr = lazPerf._malloc(recordLength);
  let heapView = null;
  const getHeapView = () => {
    // the heap buffer is replaced when the WASM memory grows
    if (heapView?.buffer !== lazPerf.HEAPU8.buffer)
      heapView = new DataView(lazPerf.HEAPU8.buffer);
    return heapView;
  };
  let index = 0;
  try {
    for (let first = 0; first < chunks.length; ) {
      // a window of consecutive chunks, one file read
      let last = first;
      let bytes = chunks[first].byteLength;
      while (
        last + 1 < chunks.length &&
        bytes + chunks[last + 1].byteLength <= READ_WINDOW_BYTES
      )
        bytes += chunks[++last].byteLength;
      const from = chunks[first].offset;
      const buffer = new Uint8Array(
        await file.slice(from, from + bytes).arrayBuffer()
      );
      if (buffer.byteLength < bytes)
        throw fail("LAS_TRUNCATED", "Le fichier LAZ est incomplet.");
      for (let c = first; c <= last; c++) {
        const chunk = chunks[c];
        const start = chunk.offset - from;
        lazPerf.HEAPU8.set(
          buffer.subarray(start, start + chunk.byteLength),
          dataPtr
        );
        const decoder = new lazPerf.ChunkDecoder();
        try {
          decoder.open(pointFormat, recordLength, dataPtr);
          for (let i = 0; i < chunk.pointCount; i++) {
            decoder.getPoint(recordPtr);
            if (index % skip === 0) sink.add(getHeapView(), recordPtr);
            index++;
          }
        } finally {
          decoder.delete();
        }
        sink.flush();
        onProgress(index / pointCount);
      }
      first = last + 1;
    }
  } finally {
    lazPerf._free(dataPtr);
    lazPerf._free(recordPtr);
  }
}

// LAS / LAZ → binary PLY (x y z float + RGB uchar), streamed: neither the
// source nor the decoded cloud is held whole in memory, only the PLY being
// written (15 bytes per kept point).
//   createLazPerf  () => Promise<laz-perf module> (LAZ only)
// → {file: File (.ply), importedFrom: {format, fileName, lasVersion,
//    pointFormat, sourceCount, skip, origin}}
export default async function convertLasToPly(
  file,
  { createLazPerf, onProgress = () => {} } = {}
) {
  const header = await readLasHeader(file);
  const plan = getLazConversionPlan(header, file.size);
  const writer = createPointsPlyWriter({
    name: toPlyName(file.name),
    comments: [`converted from LAS ${header.version}`],
  });
  const sink = createPointSink({ header, writer });
  if (header.isCompressed)
    await readLazRecords(
      file,
      header,
      plan.skip,
      sink,
      onProgress,
      createLazPerf
    );
  else await readLasRecords(file, header, plan.skip, sink, onProgress);
  sink.flush();
  const origin = sink.getOrigin();
  return {
    file: writer.finish({ origin }),
    importedFrom: {
      format: header.isCompressed ? "LAZ" : "LAS",
      fileName: file.name,
      lasVersion: header.version,
      pointFormat: header.pointFormat,
      sourceCount: header.pointCount,
      skip: plan.skip,
      origin,
    },
  };
}
