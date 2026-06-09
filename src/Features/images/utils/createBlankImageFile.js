export default async function createBlankImageFile({
  width,
  height,
  color = "#FFFFFF",
  fileName = "page-blanche.png",
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob], fileName, { type: "image/png" })),
      "image/png"
    );
  });
}
