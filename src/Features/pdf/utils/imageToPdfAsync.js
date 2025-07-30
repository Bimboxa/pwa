import { PDFDocument, PDFImage } from "pdf-lib";

export default async function imageToPdfAsync({ url }) {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();

  // Load and embed image
  const imageBytes = await fetch(url).then((res) => res.arrayBuffer());
  const image = await pdfDoc.embedPng(imageBytes); // This returns a PDFImage object

  // Add page
  const page = pdfDoc.addPage([842, 595]); // A4 size

  // Get image dimensions
  const { width, height } = image.scale(1);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 0;

  // Calculate scaling to fit page
  const scale = Math.min(
    (pageWidth - 2 * margin) / width,
    (pageHeight - 2 * margin) / height
  );

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const x = (pageWidth - scaledWidth) / 2;
  const y = (pageHeight - scaledHeight) / 2;

  // Draw the PDFImage object
  page.drawImage(image, {
    x,
    y,
    width: scaledWidth,
    height: scaledHeight,
  });

  // Save with compression
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return new File([pdfBytes], `plan.pdf`, {
    type: "application/pdf",
  });
}
