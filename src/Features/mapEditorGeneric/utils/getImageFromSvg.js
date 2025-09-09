import * as htmlToImage from "html-to-image";

export default async function getImageFromSvg(svgEl) {
  const blob = await htmlToImage.toBlob(svgEl);
  return blob;
}
