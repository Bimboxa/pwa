import jsQR from "jsqr";
import {createCanvas} from "canvas";

export default function createQrCodeImageData(text) {
  const size = 256;
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");

  const qrCode = jsQR(text, size, size);
  if (!qrCode) {
    throw new Error("Failed to generate QR code");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, size, size);

  context.fillStyle = "black";
  qrCode.modules.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        context.fillRect(x * 4, y * 4, 4, 4);
      }
    });
  });

  return canvas.toDataURL();
}
