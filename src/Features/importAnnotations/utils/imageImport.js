// Inline PNG assets are self-contained. Never persist session-only blob URLs.
export function decodeImageAsset(asset) {
  if (
    !asset ||
    asset.mime !== "image/png" ||
    typeof asset.id !== "string" ||
    !asset.id ||
    asset.id.length > 100 ||
    typeof asset.base64 !== "string" ||
    !asset.base64.length ||
    asset.base64.length % 4 !== 0 ||
    asset.base64.length > 6666668 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.base64)
  )
    throw new Error("Invalid PNG asset");
  const bytes = Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0));
  const v = new DataView(bytes.buffer);
  if (
    bytes.length < 45 ||
    bytes.length > 5000000 ||
    v.getUint32(0) !== 0x89504e47 ||
    v.getUint32(4) !== 0x0d0a1a0a ||
    v.getUint32(8) !== 13 ||
    v.getUint32(12) !== 0x49484452 ||
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.width < 1 ||
    asset.height < 1 ||
    asset.width > 16384 ||
    asset.height > 16384 ||
    asset.width * asset.height > 40000000 ||
    v.getUint32(16) !== asset.width ||
    v.getUint32(20) !== asset.height ||
    v.getUint32(bytes.length - 8) !== 0x49454e44
  )
    throw new Error("Invalid PNG header, dimensions or size");
  return bytes;
}

export function imagePlacement(points, frame) {
  if (
    !Array.isArray(points) ||
    points.length !== 3 ||
    points.some(
      (p) =>
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.type === "circle"
    )
  )
    throw new Error(
      "IMAGE requires top-left, top-right and bottom-left corners"
    );
  const [o, x, y] = points;
  const ux = x.x - o.x,
    uy = x.y - o.y,
    vx = y.x - o.x,
    vy = y.y - o.y;
  const w = Math.hypot(ux, uy),
    h = Math.hypot(vx, vy);
  if (!(w * h > 1e-12) || Math.abs(ux * vx + uy * vy) > w * h * 1e-5)
    throw new Error(
      "IMAGE corners must form a rectangle; bake shear into the PNG first"
    );
  const cx = o.x + (ux + vx) / 2,
    cy = o.y + (uy + vy) / 2;
  return {
    bbox: {
      x: (cx - w / 2) / frame.width,
      y: (cy - h / 2) / frame.height,
      width: w / frame.width,
      height: h / frame.height,
    },
    rotation: (Math.atan2(uy, ux) * 180) / Math.PI,
    imageFlipY: ux * vy - uy * vx < 0,
  };
}

export function validateImageImport(doc) {
  try {
    const assets = doc.imageAssets ?? [];
    if (!Array.isArray(assets) || assets.length > 200)
      throw new Error("Invalid image assets");
    const ids = new Set();
    let total = 0;
    for (const asset of assets) {
      if (ids.has(asset.id)) throw new Error("Duplicate image asset id");
      ids.add(asset.id);
      total += decodeImageAsset(asset).length;
    }
    if (total > 6000000) throw new Error("Image assets exceed 6 MB");
    for (const a of doc.annotations ?? []) {
      if (
        a.sourceOrder !== undefined &&
        (!Number.isInteger(a.sourceOrder) || a.sourceOrder < 0)
      )
        throw new Error("Invalid sourceOrder");
      if (a.type !== "IMAGE") {
        if (a.imageAssetId)
          throw new Error("imageAssetId is only supported on IMAGE");
        continue;
      }
      if (!ids.has(a.imageAssetId))
        throw new Error("IMAGE references a missing image asset");
      imagePlacement(
        (a.points ?? []).map((p) => ({
          ...p,
          x: p.x * doc.image.width,
          y: p.y * doc.image.height,
        })),
        doc.image
      );
      const [o, x, y] = a.points;
      if (
        [o, x, y, { x: x.x + y.x - o.x, y: x.y + y.y - o.y }].some(
          (p) => p.x < -1e-9 || p.y < -1e-9 || p.x > 1 + 1e-9 || p.y > 1 + 1e-9
        )
      )
        throw new Error("IMAGE must fit in the frame; crop the PNG first");
      if (
        a.opacity !== undefined &&
        (!Number.isFinite(a.opacity) || a.opacity < 0 || a.opacity > 1)
      )
        throw new Error("Invalid IMAGE opacity");
      if (
        a.closeLine ||
        a.cuts?.length ||
        a.openings?.length ||
        a.guideLines?.length ||
        a.labelPoint ||
        a.targetPoint ||
        a.textContent
      )
        throw new Error("Invalid IMAGE geometry fields");
    }
    return null;
  } catch (e) {
    return e.message;
  }
}

// Called before any templates/files/annotations are written. Browser decoding
// catches corrupt image data beyond the cheap transport/header validation.
export async function verifyImageAssets(assets = []) {
  for (const asset of assets) {
    const bytes = decodeImageAsset(asset);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (
        image.naturalWidth !== asset.width ||
        image.naturalHeight !== asset.height
      )
        throw new Error("PNG dimensions mismatch");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function imageFileRecord(asset, annotation) {
  const fileName = `${annotation.id}_image.png`;
  const now = new Date().toISOString();
  const imageSize = { width: asset.width, height: asset.height };
  return {
    image: { isImage: true, fileName, imageSize, fileUpdatedAt: now },
    file: {
      fileName,
      fileMime: "image/png",
      fileType: "IMAGE",
      srcFileName: `${asset.id}.png`,
      fileArrayBuffer: decodeImageAsset(asset).buffer,
      entityId: annotation.id,
      projectId: annotation.projectId,
      listingId: annotation.listingId,
      listingTable: "annotations",
      createdAt: now,
      updatedAt: now,
    },
  };
}
