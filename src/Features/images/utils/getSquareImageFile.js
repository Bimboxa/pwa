export default async function getSquareImageFile(imageFile, size = 1024) {
  if (!imageFile || !(imageFile instanceof File)) {
    console.warn("[getSquareImageFile] invalid file:", imageFile);
    return null;
  }

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / image.width, size / image.height, 1);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, imageFile.type || "image/png")
  );

  if (!blob) {
    console.warn("[getSquareImageFile] failed to create blob");
    return null;
  }

  return new File([blob], imageFile.name, {
    type: imageFile.type || blob.type,
  });
}
