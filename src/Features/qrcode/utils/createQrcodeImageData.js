import QRCode from "qrcode";

export default async function createQrcodeImageData(text, options = {}) {
  const size = options.size ?? 256;
  const margin = options.margin ?? 4;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? "M";

  try {
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: margin,
      errorCorrectionLevel: errorCorrectionLevel,
      color: {
        dark: options.darkColor ?? "#000000",
        light: options.lightColor ?? "#FFFFFF",
      },
    });

    return dataUrl;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}
