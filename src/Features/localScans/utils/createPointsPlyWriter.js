const BLOCK_VERTICES = 65536;
const STRIDE = 15; // x y z float32 + red green blue uint8

// Streaming writer of the binary PLY the scan decoder reads (readLocalPly):
// x y z float + red green blue uchar, little endian. Points are pushed one
// by one, already in the local frame; the count is only known at the end.
//   push(x, y, z, r, g, b)
//   finish({origin}) → File   origin: what the caller subtracted from the
//                             source coordinates, recorded in the header
//                             (`comment source_origin x y z`)
export default function createPointsPlyWriter({
  name = "scan.ply",
  comments = [],
} = {}) {
  const blocks = [];
  let view = null;
  let inBlock = 0;
  let count = 0;

  return {
    get count() {
      return count;
    },
    push(x, y, z, r, g, b) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
        throw new Error("Coordonnées invalides dans le nuage de points.");
      if (!view) view = new DataView(new ArrayBuffer(BLOCK_VERTICES * STRIDE));
      const byte = inBlock * STRIDE;
      view.setFloat32(byte, x, true);
      view.setFloat32(byte + 4, y, true);
      view.setFloat32(byte + 8, z, true);
      view.setUint8(byte + 12, r);
      view.setUint8(byte + 13, g);
      view.setUint8(byte + 14, b);
      count++;
      if (++inBlock === BLOCK_VERTICES) {
        blocks.push(view.buffer);
        view = null;
        inBlock = 0;
      }
    },
    finish({ origin = [0, 0, 0] } = {}) {
      if (!count) throw new Error("Aucun point à écrire.");
      if (inBlock) blocks.push(view.buffer.slice(0, inBlock * STRIDE));
      const header = [
        "ply",
        "format binary_little_endian 1.0",
        ...comments.map((comment) => `comment ${comment}`),
        `comment source_origin ${origin.join(" ")}`,
        `element vertex ${count}`,
        "property float x",
        "property float y",
        "property float z",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
        "end_header",
        "",
      ].join("\n");
      return new File([header, ...blocks], name, {
        type: "application/octet-stream",
      });
    },
  };
}
