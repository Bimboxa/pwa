import db from "App/db/db";

// Minimal EXIF reader for ONE tag: FocalLengthIn35mmFilm (0xA405), as written
// by phones. JPEG (APP1 Exif segment) and bare TIFF buffers only — PNG, WebP
// and HEIC return null. Never throws: any malformed structure -> null.

const TAG_EXIF_IFD = 0x8769;
const TAG_FOCAL_35 = 0xa405;
const TAG_FOCAL_MM = 0x920a;

function findTiffOffset(view) {
  // JPEG: SOI then segments; the Exif APP1 payload starts with "Exif\0\0".
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      if (
        marker === 0xd8 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        offset += 2; // standalone markers
        continue;
      }
      if (marker === 0xda || marker === 0xd9) return null; // image data / EOI
      const length = view.getUint16(offset + 2);
      if (marker === 0xe1 && offset + 10 <= view.byteLength) {
        if (
          view.getUint32(offset + 4) === 0x45786966 && // "Exif"
          view.getUint16(offset + 8) === 0
        ) {
          return offset + 10;
        }
      }
      offset += 2 + length;
    }
    return null;
  }
  // Bare TIFF.
  const bo = view.byteLength >= 2 ? view.getUint16(0) : 0;
  return bo === 0x4949 || bo === 0x4d4d ? 0 : null;
}

export function readExifFocal35FromBuffer(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    const tiff = findTiffOffset(view);
    if (tiff == null || tiff + 8 > view.byteLength) return null;
    const bo = view.getUint16(tiff);
    const le = bo === 0x4949;
    if (!le && bo !== 0x4d4d) return null;
    const u16 = (o) => view.getUint16(o, le);
    const u32 = (o) => view.getUint32(o, le);
    if (u16(tiff + 2) !== 0x2a) return null;

    const readIfd = (ifdOffset) => {
      const base = tiff + ifdOffset;
      if (base + 2 > view.byteLength) return null;
      const count = u16(base);
      const entries = {};
      for (let i = 0; i < count; i++) {
        const e = base + 2 + 12 * i;
        if (e + 12 > view.byteLength) break;
        entries[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
      }
      return entries;
    };

    const ifd0 = readIfd(u32(tiff + 4));
    const exifPtr = ifd0?.[TAG_EXIF_IFD];
    if (!exifPtr) return null;
    const exif = readIfd(u32(exifPtr.at));
    if (!exif) return null;

    const f35 = exif[TAG_FOCAL_35];
    if (f35 && f35.type === 3 && f35.count >= 1) {
      const v = u16(f35.at);
      if (v > 0) return v;
    }
    // FocalLength (mm) alone is not convertible without the sensor size.
    void TAG_FOCAL_MM;
    return null;
  } catch {
    return null;
  }
}

// The original upload of a photo baseMap lives in db.files (fileArrayBuffer)
// — versions created later (white background, merged annotations…) are
// re-encoded and lose their EXIF, so always read the ORIGINAL file.
export async function getPhotoBaseMapExifFocal35(baseMap) {
  try {
    const fileName =
      baseMap?.image?.fileName ??
      baseMap?.versions?.find((v) => v.image?.fileName)?.image?.fileName;
    if (!fileName) return null;
    const record = await db.files.get(fileName);
    if (!record?.fileArrayBuffer) return null;
    return readExifFocal35FromBuffer(record.fileArrayBuffer);
  } catch {
    return null;
  }
}
