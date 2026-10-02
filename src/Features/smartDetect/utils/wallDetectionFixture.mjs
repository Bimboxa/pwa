export default function fixture(
  fill = "hatch",
  angle = 0,
  targetFill = fill,
  options = {}
) {
  const image = {
    width: 420,
    height: 380,
    data: new Uint8ClampedArray(420 * 380 * 4).fill(255),
  };
  const draw = (cx, cy, length, width, degrees, material) => {
    const a = (degrees * Math.PI) / 180,
      ux = Math.cos(a),
      uy = Math.sin(a);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        const along = dx * ux + dy * uy,
          across = -dx * uy + dy * ux;
        if (Math.abs(along) > length / 2 || Math.abs(across) > width / 2)
          continue;
        let value = material === "black" ? 0 : material === "gray" ? 155 : 255;
        if (material === "hatch")
          value =
            (x + y + (options.phase ?? 0)) % 8 < 2
              ? (options.hatchInk ?? 40)
              : 255;
        if (material === "grid") value = x % 8 < 2 || y % 8 < 2 ? 40 : 255;
        if (material !== "blank" && Math.abs(across) > width / 2 - 1) value = 0;
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      }
  };
  draw(50, 120, 160, options.sourceWidth ?? 20, 90, fill);
  draw(260, 210, options.length ?? 180, options.width ?? 20, angle, targetFill);
  const clipboard = {
    sourceCenter: { x: 50, y: 120 },
    items: [
      {
        annotation: {
          type: "POLYLINE",
          strokeWidth: options.sourceWidth ?? 20,
          baseMapId: "plan",
        },
        basePoints: [
          { x: 50, y: 40, type: "square" },
          { x: 50, y: 200, type: "square" },
        ],
      },
    ],
  };
  return {
    imageData: image,
    clipboard,
    cursorImgPx: { x: 261, y: 211 },
    baseMapId: "plan",
    pasteTransform: { rotationDeg: angle - 90 },
  };
}
