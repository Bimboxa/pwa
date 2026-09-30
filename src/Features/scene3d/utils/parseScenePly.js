// Streaming parser of a scan mesh in PLY format (DJI Terra export: per-face
// `texcoord` + `texnumber`, one texture atlas per `comment TextureFile` line).
//
// Pure module (no DOM, no three.js): runs in the import worker and in node
// tests. The file is never loaded at once — it is read slice by slice through
// `source.read`, and the mesh is emitted as GPU-ready CHUNKS:
//   - faces are grouped by atlas (texnumber),
//   - corners sharing (vertex, u, v) are welded,
//   - positions are quantized to Uint16 on ONE grid for the whole scene (the
//     scene bbox), so a vertex shared by two chunks lands on the same value
//     (no cracks),
//   - a chunk holds at most 65 535 vertices (Uint16 index).
// The three.js stock PLYLoader is not used: it ignores `texnumber`, drops the
// header comments, de-indexes the mesh and works on the whole buffer.

const TYPES = {
  char: { size: 1, read: "getInt8" },
  int8: { size: 1, read: "getInt8" },
  uchar: { size: 1, read: "getUint8" },
  uint8: { size: 1, read: "getUint8" },
  short: { size: 2, read: "getInt16" },
  int16: { size: 2, read: "getInt16" },
  ushort: { size: 2, read: "getUint16" },
  uint16: { size: 2, read: "getUint16" },
  int: { size: 4, read: "getInt32" },
  int32: { size: 4, read: "getInt32" },
  uint: { size: 4, read: "getUint32" },
  uint32: { size: 4, read: "getUint32" },
  float: { size: 4, read: "getFloat32" },
  float32: { size: 4, read: "getFloat32" },
  double: { size: 8, read: "getFloat64" },
  float64: { size: 8, read: "getFloat64" },
};

const HEADER_PROBE_BYTES = [1 << 16, 1 << 20];
const DEFAULT_SLICE_BYTES = 16 * 1024 * 1024;
const MAX_CHUNK_VERTICES = 65535;
const MAX_ATLASES = 4096;
const QUANT_MAX = 65535;

export function createPlyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// bytes: the first bytes of the file. Returns null when `end_header` is not
// inside them (caller retries with a larger probe).
export function parseScenePlyHeader(bytes) {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith("ply")) {
    throw createPlyError("PLY_INVALID", "Not a PLY file.");
  }
  const marker = text.indexOf("end_header");
  if (marker === -1) return null;
  const eol = text.indexOf("\n", marker);
  if (eol === -1) return null;

  const header = {
    format: null,
    headerLength: eol + 1,
    textureNames: [],
    elements: [],
  };
  const lines = text.slice(0, marker).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === "format") {
      header.format = parts[1];
    } else if (parts[0] === "comment") {
      const match = /^comment\s+TextureFile\s+(.+)$/i.exec(line);
      if (match) header.textureNames.push(match[1].trim());
    } else if (parts[0] === "element") {
      header.elements.push({
        name: parts[1],
        count: Number(parts[2]),
        properties: [],
      });
    } else if (parts[0] === "property") {
      const element = header.elements[header.elements.length - 1];
      if (!element) continue;
      if (parts[1] === "list") {
        element.properties.push({
          name: parts[4],
          isList: true,
          countType: parts[2],
          itemType: parts[3],
        });
      } else {
        element.properties.push({
          name: parts[2],
          isList: false,
          type: parts[1],
        });
      }
    }
  }
  return header;
}

export async function readScenePlyHeader(source) {
  for (const probe of HEADER_PROBE_BYTES) {
    const end = Math.min(source.size, probe);
    const header = parseScenePlyHeader(
      new Uint8Array(await source.read(0, end))
    );
    if (header) return header;
    if (end === source.size) break;
  }
  throw createPlyError("PLY_INVALID", "PLY header not found.");
}

function getType(name) {
  const type = TYPES[name];
  if (!type) {
    throw createPlyError(
      "PLY_UNSUPPORTED_LAYOUT",
      `Unknown PLY property type "${name}".`
    );
  }
  return type;
}

// Byte size of one row of an element without list property, else null.
function getFixedStride(element) {
  let stride = 0;
  for (const property of element.properties) {
    if (property.isList) return null;
    stride += getType(property.type).size;
  }
  return stride;
}

function createBuilder(atlasIndex, stamp) {
  return {
    atlasIndex,
    chunkIndex: 0,
    stamp,
    vertexCount: 0,
    indexCount: 0,
    triangleCount: 0,
    positions: new Uint16Array(MAX_CHUNK_VERTICES * 3),
    // raw (u, v) of the file; v is flipped at flush time
    u: new Float32Array(MAX_CHUNK_VERTICES),
    v: new Float32Array(MAX_CHUNK_VERTICES),
    next: new Int32Array(MAX_CHUNK_VERTICES),
    index: new Uint16Array(MAX_CHUNK_VERTICES * 3),
    qMin: [QUANT_MAX, QUANT_MAX, QUANT_MAX],
    qMax: [0, 0, 0],
  };
}

// source: {size, read(start, end) → Promise<ArrayBuffer>}
// options.onBbox({min, max}): once the vertices are read (bbox final).
// options.onChunk(chunk): may be async (awaited — back-pressure).
//   chunk = {atlasIndex, chunkIndex, positions: Uint16Array (xyz),
//            uvs: Uint16Array | Float32Array | null, index: Uint16Array,
//            vertexCount, triangleCount,
//            boundsMin, boundsMax (normalized [0..1] on the scene grid)}
// options.onProgress({phase, done, total})
// Returns {format, textureNames, vertexCount, faceCount, triangleCount,
//   skippedFaces, bbox: {min, max}, origin, hasUvs, atlases: [{atlasIndex,
//   triangleCount, chunkCount}]} — bbox in the file units, relative to
//   `origin` (non-zero only for double coordinates, e.g. georeferenced).
export default async function parseScenePly(source, options = {}) {
  const { onChunk, onProgress, onBbox } = options;
  const sliceBytes = options.sliceBytes ?? DEFAULT_SLICE_BYTES;

  const header = await readScenePlyHeader(source);
  if (header.format === "ascii") {
    throw createPlyError(
      "PLY_ASCII_UNSUPPORTED",
      "ASCII PLY files are not supported (export a binary PLY)."
    );
  }
  if (
    header.format !== "binary_little_endian" &&
    header.format !== "binary_big_endian"
  ) {
    throw createPlyError(
      "PLY_INVALID",
      `Unknown PLY format "${header.format}".`
    );
  }
  const littleEndian = header.format === "binary_little_endian";

  // --- locate the vertex and face sections

  let offset = header.headerLength;
  let vertexElement = null;
  let vertexOffset = 0;
  let faceElement = null;
  let faceOffset = 0;
  for (const element of header.elements) {
    if (element.name === "face") {
      faceElement = element;
      faceOffset = offset;
      break; // what follows the faces is ignored
    }
    const stride = getFixedStride(element);
    if (stride === null) {
      throw createPlyError(
        "PLY_UNSUPPORTED_LAYOUT",
        `PLY element "${element.name}" has list properties.`
      );
    }
    if (element.name === "vertex") {
      vertexElement = element;
      vertexOffset = offset;
    }
    offset += element.count * stride;
  }
  if (!vertexElement || !(vertexElement.count > 0)) {
    throw createPlyError("PLY_INVALID", "PLY file without vertices.");
  }
  if (!faceElement || !(faceElement.count > 0)) {
    throw createPlyError(
      "PLY_NO_FACES",
      "PLY file without faces (point clouds are not supported)."
    );
  }

  // --- vertices

  const vertexCount = vertexElement.count;
  const vertexStride = getFixedStride(vertexElement);
  const coordinate = {};
  {
    let propertyOffset = 0;
    for (const property of vertexElement.properties) {
      const type = getType(property.type);
      if (
        property.name === "x" ||
        property.name === "y" ||
        property.name === "z"
      ) {
        coordinate[property.name] = { offset: propertyOffset, type };
      }
      propertyOffset += type.size;
    }
  }
  if (!coordinate.x || !coordinate.y || !coordinate.z) {
    throw createPlyError("PLY_INVALID", "PLY vertices without x / y / z.");
  }
  if (faceOffset > source.size) {
    throw createPlyError("PLY_TRUNCATED", "PLY file is truncated.");
  }

  const isDouble = coordinate.x.type.size === 8;
  const coords = new Float32Array(vertexCount * 3);
  const origin = [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  {
    const rowsPerSlice = Math.max(1, Math.floor(sliceBytes / vertexStride));
    const xInfo = coordinate.x;
    const yInfo = coordinate.y;
    const zInfo = coordinate.z;
    for (let first = 0; first < vertexCount; first += rowsPerSlice) {
      const rows = Math.min(rowsPerSlice, vertexCount - first);
      const start = vertexOffset + first * vertexStride;
      const buffer = await source.read(start, start + rows * vertexStride);
      if (buffer.byteLength < rows * vertexStride) {
        throw createPlyError("PLY_TRUNCATED", "PLY file is truncated.");
      }
      const view = new DataView(buffer);
      for (let i = 0; i < rows; i++) {
        const base = i * vertexStride;
        let x = view[xInfo.type.read](base + xInfo.offset, littleEndian);
        let y = view[yInfo.type.read](base + yInfo.offset, littleEndian);
        let z = view[zInfo.type.read](base + zInfo.offset, littleEndian);
        if (isDouble) {
          // Georeferenced coordinates do not fit a float32: work relative
          // to the first vertex.
          if (first === 0 && i === 0) {
            origin[0] = Math.floor(x);
            origin[1] = Math.floor(y);
            origin[2] = Math.floor(z);
          }
          x -= origin[0];
          y -= origin[1];
          z -= origin[2];
        }
        const o = (first + i) * 3;
        coords[o] = x;
        coords[o + 1] = y;
        coords[o + 2] = z;
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
      onProgress?.({
        phase: "VERTICES",
        done: first + rows,
        total: vertexCount,
      });
    }
  }
  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
    throw createPlyError("PLY_INVALID", "PLY vertices hold invalid values.");
  }
  // The bbox (= the quantization grid of every chunk) is final here, before
  // the first chunk is emitted: a consumer can allocate per-scan buffers.
  onBbox?.({ min: [...min], max: [...max] });

  // One quantization grid for the whole scene.
  const quantized = new Uint16Array(vertexCount * 3);
  for (let axis = 0; axis < 3; axis++) {
    const size = Math.max(max[axis] - min[axis], 1e-6);
    const k = QUANT_MAX / size;
    const lo = min[axis];
    for (let i = axis; i < coords.length; i += 3) {
      quantized[i] = Math.round((coords[i] - lo) * k);
    }
  }

  // --- faces

  const faceProperties = faceElement.properties.map((property) => {
    if (property.isList) {
      const isIndices =
        property.name === "vertex_indices" || property.name === "vertex_index";
      const isTexcoord = property.name === "texcoord";
      return {
        kind: isIndices ? "INDICES" : isTexcoord ? "TEXCOORD" : "SKIP_LIST",
        countType: getType(property.countType),
        itemType: getType(property.itemType),
      };
    }
    return {
      kind: property.name === "texnumber" ? "TEXNUMBER" : "SKIP",
      type: getType(property.type),
    };
  });
  if (!faceProperties.some((p) => p.kind === "INDICES")) {
    throw createPlyError("PLY_INVALID", "PLY faces without vertex indices.");
  }
  const hasUvs = faceProperties.some((p) => p.kind === "TEXCOORD");

  // Welding: head[v] = first chunk-local vertex created from source vertex v
  // by the builder whose stamp is stamp[v]; builder.next chains the variants
  // (same source vertex, other uv). A vertex on an atlas seam is claimed in
  // turn by two builders: the chain is simply restarted (a duplicate, never
  // a wrong vertex).
  const head = new Int32Array(vertexCount);
  const stamp = new Uint32Array(vertexCount);
  let stampCounter = 0;
  const builders = new Map();
  const atlasStats = new Map();

  const faceIndices = new Uint32Array(255);
  const faceU = new Float32Array(255);
  const faceV = new Float32Array(255);
  const faceLocals = new Uint16Array(255);

  let triangleCount = 0;
  let skippedFaces = 0;

  async function flush(builder) {
    const vc = builder.vertexCount;
    if (vc === 0 || builder.indexCount === 0) return;
    let uvs = null;
    if (hasUvs) {
      let inRange = true;
      for (let i = 0; i < vc; i++) {
        const u = builder.u[i];
        const v = builder.v[i];
        if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) {
          inRange = false;
          break;
        }
      }
      // PLY v grows upward (bottom-left origin): flipped here because the
      // textures are uploaded unflipped (first row = top of the image).
      if (inRange) {
        uvs = new Uint16Array(vc * 2);
        for (let i = 0; i < vc; i++) {
          uvs[i * 2] = Math.round(builder.u[i] * QUANT_MAX);
          uvs[i * 2 + 1] = Math.round((1 - builder.v[i]) * QUANT_MAX);
        }
      } else {
        uvs = new Float32Array(vc * 2);
        for (let i = 0; i < vc; i++) {
          uvs[i * 2] = builder.u[i];
          uvs[i * 2 + 1] = 1 - builder.v[i];
        }
      }
    }
    const chunk = {
      atlasIndex: builder.atlasIndex,
      chunkIndex: builder.chunkIndex,
      positions: builder.positions.slice(0, vc * 3),
      uvs,
      index: builder.index.slice(0, builder.indexCount),
      vertexCount: vc,
      triangleCount: builder.triangleCount,
      boundsMin: builder.qMin.map((q) => q / QUANT_MAX),
      boundsMax: builder.qMax.map((q) => q / QUANT_MAX),
    };
    const stats = atlasStats.get(builder.atlasIndex) ?? {
      atlasIndex: builder.atlasIndex,
      triangleCount: 0,
      chunkCount: 0,
    };
    stats.triangleCount += builder.triangleCount;
    stats.chunkCount += 1;
    atlasStats.set(builder.atlasIndex, stats);

    builder.chunkIndex += 1;
    builder.stamp = ++stampCounter;
    builder.vertexCount = 0;
    builder.indexCount = 0;
    builder.triangleCount = 0;
    builder.qMin = [QUANT_MAX, QUANT_MAX, QUANT_MAX];
    builder.qMax = [0, 0, 0];

    await onChunk?.(chunk);
  }

  function addCorner(builder, source, u, v) {
    if (stamp[source] === builder.stamp) {
      let local = head[source];
      while (local !== -1) {
        if (builder.u[local] === u && builder.v[local] === v) return local;
        local = builder.next[local];
      }
    } else {
      stamp[source] = builder.stamp;
      head[source] = -1;
    }
    const local = builder.vertexCount++;
    const s = source * 3;
    const d = local * 3;
    for (let axis = 0; axis < 3; axis++) {
      const q = quantized[s + axis];
      builder.positions[d + axis] = q;
      if (q < builder.qMin[axis]) builder.qMin[axis] = q;
      if (q > builder.qMax[axis]) builder.qMax[axis] = q;
    }
    builder.u[local] = u;
    builder.v[local] = v;
    builder.next[local] = head[source];
    head[source] = local;
    return local;
  }

  const faceCount = faceElement.count;
  let facesDone = 0;
  let filePos = faceOffset;
  let carry = null;

  while (facesDone < faceCount) {
    if (filePos >= source.size && !carry) {
      throw createPlyError("PLY_TRUNCATED", "PLY file is truncated.");
    }
    const sliceEnd = Math.min(source.size, filePos + sliceBytes);
    const slice = new Uint8Array(await source.read(filePos, sliceEnd));
    const isLastSlice = sliceEnd >= source.size;
    filePos = sliceEnd;

    let bytes = slice;
    if (carry) {
      bytes = new Uint8Array(carry.length + slice.length);
      bytes.set(carry, 0);
      bytes.set(slice, carry.length);
      carry = null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = bytes.length;
    let pos = 0;

    while (facesDone < faceCount) {
      const faceStart = pos;
      let complete = true;
      let cornerCount = 0;
      let uvCount = 0;
      let atlasIndex = 0;

      for (let p = 0; p < faceProperties.length; p++) {
        const property = faceProperties[p];
        if (property.kind === "SKIP" || property.kind === "TEXNUMBER") {
          const size = property.type.size;
          if (pos + size > end) {
            complete = false;
            break;
          }
          if (property.kind === "TEXNUMBER") {
            atlasIndex = view[property.type.read](pos, littleEndian);
          }
          pos += size;
          continue;
        }
        const countSize = property.countType.size;
        if (pos + countSize > end) {
          complete = false;
          break;
        }
        const n = view[property.countType.read](pos, littleEndian);
        pos += countSize;
        const itemSize = property.itemType.size;
        if (pos + n * itemSize > end) {
          complete = false;
          break;
        }
        if (property.kind === "INDICES" && n <= 255) {
          const read = property.itemType.read;
          for (let k = 0; k < n; k++) {
            faceIndices[k] = view[read](pos + k * itemSize, littleEndian);
          }
          cornerCount = n;
        } else if (property.kind === "TEXCOORD" && n <= 510) {
          const read = property.itemType.read;
          const pairs = n >> 1;
          for (let k = 0; k < pairs; k++) {
            faceU[k] = view[read](pos + 2 * k * itemSize, littleEndian);
            faceV[k] = view[read](pos + (2 * k + 1) * itemSize, littleEndian);
          }
          uvCount = pairs;
        }
        pos += n * itemSize;
      }

      if (!complete) {
        pos = faceStart;
        break;
      }
      facesDone++;

      let valid =
        cornerCount >= 3 && atlasIndex >= 0 && atlasIndex < MAX_ATLASES;
      for (let k = 0; valid && k < cornerCount; k++) {
        if (faceIndices[k] >= vertexCount) valid = false;
      }
      if (!valid) {
        skippedFaces++;
        continue;
      }

      let builder = builders.get(atlasIndex);
      if (!builder) {
        builder = createBuilder(atlasIndex, ++stampCounter);
        builders.set(atlasIndex, builder);
      }
      if (builder.vertexCount + cornerCount > MAX_CHUNK_VERTICES) {
        await flush(builder);
      }
      const withUvs = uvCount === cornerCount;
      for (let k = 0; k < cornerCount; k++) {
        faceLocals[k] = addCorner(
          builder,
          faceIndices[k],
          withUvs ? faceU[k] : 0,
          withUvs ? faceV[k] : 0
        );
      }
      // fan triangulation (a triangle is a 1-triangle fan)
      const needed = builder.indexCount + (cornerCount - 2) * 3;
      if (needed > builder.index.length) {
        const grown = new Uint16Array(
          Math.max(needed, builder.index.length * 2)
        );
        grown.set(builder.index);
        builder.index = grown;
      }
      for (let k = 1; k < cornerCount - 1; k++) {
        builder.index[builder.indexCount++] = faceLocals[0];
        builder.index[builder.indexCount++] = faceLocals[k];
        builder.index[builder.indexCount++] = faceLocals[k + 1];
      }
      builder.triangleCount += cornerCount - 2;
      triangleCount += cornerCount - 2;
    }

    if (facesDone < faceCount) {
      if (isLastSlice) {
        throw createPlyError("PLY_TRUNCATED", "PLY file is truncated.");
      }
      carry = bytes.slice(pos);
    }
    onProgress?.({ phase: "FACES", done: facesDone, total: faceCount });
  }

  const orderedBuilders = [...builders.values()].sort(
    (a, b) => a.atlasIndex - b.atlasIndex
  );
  for (const builder of orderedBuilders) await flush(builder);

  return {
    format: header.format,
    textureNames: header.textureNames,
    vertexCount,
    faceCount,
    triangleCount,
    skippedFaces,
    bbox: { min, max },
    origin,
    hasUvs,
    atlases: [...atlasStats.values()].sort(
      (a, b) => a.atlasIndex - b.atlasIndex
    ),
  };
}
