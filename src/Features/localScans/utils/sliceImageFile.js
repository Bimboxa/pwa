export default async function sliceImageFile(
  result,
  mode,
  name = "scan-projection.png"
) {
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(result[mode], result.width, result.height),
      0,
      0
    );
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Impossible de générer l’image de projection.");
  return new File([blob], name, { type: "image/png" });
}
