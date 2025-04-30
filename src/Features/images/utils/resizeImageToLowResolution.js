export default async function resizeImageToLowResolution(
  file,
  maxSize = 100 * 1024
) {
  if (!file || !(file instanceof File)) {
    console.warn(
      "[resizeImageToLowResolution] input is not a valid File:",
      file
    );
    return null;
  }

  // Load the image from the file
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let width = image.width;
  let height = image.height;
  let quality = 0.9;
  const isJpeg = file.type === "image/jpeg";
  const outputType = isJpeg ? "image/jpeg" : file.type;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, isJpeg ? quality : undefined)
    );

    if (!blob) {
      console.warn("[resizeImageToLowResolution] failed to generate blob");
      return null;
    }

    if (blob.size <= maxSize || (width < 50 && height < 50)) {
      return new File([blob], file.name, {type: file.type});
    }

    // Reduce dimensions, and if JPEG, reduce quality too
    width = Math.floor(width * 0.9);
    height = Math.floor(height * 0.9);
    if (isJpeg) quality *= 0.9;
  }
}
