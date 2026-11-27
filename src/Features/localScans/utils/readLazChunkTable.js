// LAZ chunk table. A .laz stores its points as independent compressed chunks;
// the table gives their byte sizes, so each chunk can be read from the file
// and decoded on its own (no whole-file buffer). The table itself is
// compressed with the LASzip arithmetic coder and its integer compressor
// (32 bits, 2 contexts): both are ported here from LASzip (arithmeticdecoder,
// arithmeticmodel, integercompressor), decoder side only.

const AC_MIN_LENGTH = 0x01000000;
const AC_MAX_LENGTH = 0xffffffff;
const BM_LENGTH_SHIFT = 13;
const BM_MAX_COUNT = 1 << BM_LENGTH_SHIFT;
const DM_LENGTH_SHIFT = 15;
const DM_MAX_COUNT = 1 << DM_LENGTH_SHIFT;

const LASZIP_USER_ID = "laszip encoded";
const LASZIP_RECORD_ID = 22204;
const VLR_HEADER_BYTES = 54;
const MAX_VLR_BYTES = 64 * 1024 * 1024;
const VARIABLE_CHUNK_SIZE = 0xffffffff;

const fail = (code, message) => Object.assign(new Error(message), { code });

function createBitModel() {
  return {
    bit0Count: 1,
    bitCount: 2,
    bit0Prob: 1 << (BM_LENGTH_SHIFT - 1),
    updateCycle: 4,
    bitsUntilUpdate: 4,
  };
}

function updateBitModel(m) {
  if ((m.bitCount += m.updateCycle) > BM_MAX_COUNT) {
    m.bitCount = (m.bitCount + 1) >>> 1;
    m.bit0Count = (m.bit0Count + 1) >>> 1;
    if (m.bit0Count === m.bitCount) m.bitCount++;
  }
  const scale = Math.floor(0x80000000 / m.bitCount);
  m.bit0Prob = Math.imul(m.bit0Count, scale) >>> (31 - BM_LENGTH_SHIFT);
  m.updateCycle = (5 * m.updateCycle) >>> 2;
  if (m.updateCycle > 64) m.updateCycle = 64;
  m.bitsUntilUpdate = m.updateCycle;
}

function updateSymbolModel(m) {
  if ((m.totalCount += m.updateCycle) > DM_MAX_COUNT) {
    m.totalCount = 0;
    for (let n = 0; n < m.symbols; n++)
      m.totalCount += m.symbolCount[n] = (m.symbolCount[n] + 1) >>> 1;
  }
  const scale = Math.floor(0x80000000 / m.totalCount);
  const shift = 31 - DM_LENGTH_SHIFT;
  let sum = 0;
  if (!m.decoderTable) {
    for (let k = 0; k < m.symbols; k++) {
      m.distribution[k] = Math.imul(scale, sum) >>> shift;
      sum += m.symbolCount[k];
    }
  } else {
    let s = 0;
    for (let k = 0; k < m.symbols; k++) {
      m.distribution[k] = Math.imul(scale, sum) >>> shift;
      sum += m.symbolCount[k];
      const w = m.distribution[k] >>> m.tableShift;
      while (s < w) m.decoderTable[++s] = k - 1;
    }
    m.decoderTable[0] = 0;
    while (s <= m.tableSize) m.decoderTable[++s] = m.symbols - 1;
  }
  m.updateCycle = (5 * m.updateCycle) >>> 2;
  const maxCycle = (m.symbols + 6) << 3;
  if (m.updateCycle > maxCycle) m.updateCycle = maxCycle;
  m.symbolsUntilUpdate = m.updateCycle;
}

function createSymbolModel(symbols) {
  const m = {
    symbols,
    lastSymbol: symbols - 1,
    distribution: new Uint32Array(symbols),
    symbolCount: new Uint32Array(symbols).fill(1),
    decoderTable: null,
    tableSize: 0,
    tableShift: 0,
    totalCount: 0,
    updateCycle: symbols,
    symbolsUntilUpdate: 0,
  };
  if (symbols > 16) {
    let tableBits = 3;
    while (symbols > 1 << (tableBits + 2)) tableBits++;
    m.tableSize = 1 << tableBits;
    m.tableShift = DM_LENGTH_SHIFT - tableBits;
    m.decoderTable = new Uint32Array(m.tableSize + 2);
  }
  updateSymbolModel(m);
  m.symbolsUntilUpdate = m.updateCycle = (symbols + 6) >>> 1;
  return m;
}

function createArithmeticDecoder(bytes) {
  let position = 0;
  const byte = () => (position < bytes.length ? bytes[position++] : 0);
  let value = ((byte() << 24) | (byte() << 16) | (byte() << 8) | byte()) >>> 0;
  let length = AC_MAX_LENGTH;

  const renorm = () => {
    do {
      value = ((value << 8) | byte()) >>> 0;
      length = (length << 8) >>> 0;
    } while (length < AC_MIN_LENGTH);
  };

  const readShort = () => {
    length >>>= 16;
    const sym = Math.floor(value / length);
    value = (value - Math.imul(length, sym)) >>> 0;
    if (length < AC_MIN_LENGTH) renorm();
    return sym;
  };

  const readBits = (bits) => {
    if (bits > 19) {
      const low = readShort();
      return readBits(bits - 16) * 65536 + low;
    }
    length >>>= bits;
    const sym = Math.floor(value / length);
    value = (value - Math.imul(length, sym)) >>> 0;
    if (length < AC_MIN_LENGTH) renorm();
    return sym;
  };

  const decodeBit = (m) => {
    const x = Math.imul(m.bit0Prob, length >>> BM_LENGTH_SHIFT) >>> 0;
    const sym = value >= x ? 1 : 0;
    if (sym === 0) {
      length = x;
      m.bit0Count++;
    } else {
      value = (value - x) >>> 0;
      length = (length - x) >>> 0;
    }
    if (length < AC_MIN_LENGTH) renorm();
    if (--m.bitsUntilUpdate === 0) updateBitModel(m);
    return sym;
  };

  const decodeSymbol = (m) => {
    let n;
    let sym;
    let x;
    let y = length;
    if (m.decoderTable) {
      length >>>= DM_LENGTH_SHIFT;
      const dv = Math.floor(value / length);
      const t = dv >>> m.tableShift;
      sym = m.decoderTable[t];
      n = m.decoderTable[t + 1] + 1;
      while (n > sym + 1) {
        const k = (sym + n) >>> 1;
        if (m.distribution[k] > dv) n = k;
        else sym = k;
      }
      x = Math.imul(m.distribution[sym], length) >>> 0;
      if (sym !== m.lastSymbol)
        y = Math.imul(m.distribution[sym + 1], length) >>> 0;
    } else {
      x = sym = 0;
      length >>>= DM_LENGTH_SHIFT;
      n = m.symbols;
      let k = n >>> 1;
      do {
        const z = Math.imul(length, m.distribution[k]) >>> 0;
        if (z > value) {
          n = k;
          y = z;
        } else {
          sym = k;
          x = z;
        }
      } while ((k = (sym + n) >>> 1) !== sym);
    }
    value = (value - x) >>> 0;
    length = (y - x) >>> 0;
    if (length < AC_MIN_LENGTH) renorm();
    m.symbolCount[sym]++;
    if (--m.symbolsUntilUpdate === 0) updateSymbolModel(m);
    return sym;
  };

  return { readBits, decodeBit, decodeSymbol };
}

// LASzip IntegerCompressor(dec, 32 bits, `contexts`), decompression side.
function createIntegerDecompressor(decoder, contexts) {
  const BITS = 32;
  const BITS_HIGH = 8;
  const bitsModels = Array.from({ length: contexts }, () =>
    createSymbolModel(BITS + 1)
  );
  const correctors = [createBitModel()];
  for (let i = 1; i <= BITS; i++)
    correctors.push(createSymbolModel(1 << Math.min(i, BITS_HIGH)));

  const readCorrector = (model) => {
    const k = decoder.decodeSymbol(model);
    if (k === 0) return decoder.decodeBit(correctors[0]);
    if (k === 32) return -2147483648;
    let c;
    if (k <= BITS_HIGH) c = decoder.decodeSymbol(correctors[k]);
    else {
      const lowBits = k - BITS_HIGH;
      c = decoder.decodeSymbol(correctors[k]);
      c = c * 2 ** lowBits + decoder.readBits(lowBits);
    }
    // back to its interval
    return c >= 2 ** (k - 1) ? c + 1 : c - (2 ** k - 1);
  };

  // → unsigned 32-bit value
  return (prediction, context) =>
    (prediction + readCorrector(bitsModels[context])) >>> 0;
}

// The LASzip VLR of a compressed file → {compressor, chunkSize}
//   compressor  1 pointwise · 2 pointwise chunked · 3 layered chunked
//   chunkSize   points per chunk (0xFFFFFFFF: variable, sizes in the table)
export async function readLaszipVlr(file, header) {
  const end = Math.min(
    file.size,
    header.pointDataOffset,
    header.headerSize + MAX_VLR_BYTES
  );
  const buffer = await file.slice(header.headerSize, end).arrayBuffer();
  const view = new DataView(buffer);
  let position = 0;
  for (let i = 0; i < header.vlrCount; i++) {
    if (position + VLR_HEADER_BYTES > buffer.byteLength) break;
    const userId = String.fromCharCode(
      ...new Uint8Array(buffer, position + 2, 16)
    ).replace(/\0.*$/, "");
    const recordId = view.getUint16(position + 18, true);
    const length = view.getUint16(position + 20, true);
    const data = position + VLR_HEADER_BYTES;
    if (
      userId === LASZIP_USER_ID &&
      recordId === LASZIP_RECORD_ID &&
      data + 16 <= buffer.byteLength
    )
      return {
        compressor: view.getUint16(data, true),
        chunkSize: view.getUint32(data + 12, true),
      };
    position = data + length;
  }
  throw fail(
    "LAZ_VLR_MISSING",
    "Fichier LAZ invalide : enregistrement LASzip absent."
  );
}

// → [{offset, byteLength, pointCount}] one entry per chunk, file order.
export default async function readLazChunkTable(file, header) {
  const { compressor, chunkSize } = await readLaszipVlr(file, header);
  if (compressor !== 2 && compressor !== 3)
    throw fail(
      "LAZ_NOT_CHUNKED",
      "Ce fichier LAZ n'est pas découpé en blocs : réexportez-le avec un outil récent."
    );
  const chunksStart = header.pointDataOffset + 8;
  const readInt64 = async (offset) =>
    Number(
      new DataView(
        await file.slice(offset, offset + 8).arrayBuffer()
      ).getBigInt64(0, true)
    );
  let tableOffset = await readInt64(header.pointDataOffset);
  // a writer that could not seek back leaves -1 and ends the file with it
  if (tableOffset === -1) tableOffset = await readInt64(file.size - 8);
  if (!(tableOffset >= chunksStart) || tableOffset + 8 > file.size)
    throw fail("LAZ_CHUNK_TABLE", "Table des blocs LAZ introuvable.");

  const head = new DataView(
    await file.slice(tableOffset, tableOffset + 8).arrayBuffer()
  );
  const chunkCount = head.getUint32(4, true);
  if (head.getUint32(0, true) !== 0 || chunkCount < 1)
    throw fail("LAZ_CHUNK_TABLE", "Table des blocs LAZ illisible.");

  const isVariable = chunkSize === VARIABLE_CHUNK_SIZE;
  const bytes = new Uint8Array(
    await file
      .slice(
        tableOffset + 8,
        // generous bound: the table is far smaller than 10 bytes per entry
        Math.min(file.size, tableOffset + 8 + chunkCount * 10 + 1024)
      )
      .arrayBuffer()
  );
  const decompress = createIntegerDecompressor(
    createArithmeticDecoder(bytes),
    2
  );
  const chunks = [];
  let offset = chunksStart;
  let remaining = header.pointCount;
  let previousCount = 0;
  let previousSize = 0;
  for (let i = 0; i < chunkCount; i++) {
    if (isVariable) previousCount = decompress(previousCount, 0);
    previousSize = decompress(previousSize, 1);
    const pointCount = isVariable
      ? previousCount
      : Math.min(chunkSize, remaining);
    chunks.push({ offset, byteLength: previousSize, pointCount });
    offset += previousSize;
    remaining -= pointCount;
  }
  // the chunks fill exactly the gap between the first one and the table
  if (offset !== tableOffset || remaining !== 0)
    throw fail("LAZ_CHUNK_TABLE", "Table des blocs LAZ incohérente.");
  return chunks;
}
