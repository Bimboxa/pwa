import * as htmlToImage from "html-to-image";

export default async function getImageFromSvg(svgEl, options = {}) {
  const blob = await htmlToImage.toBlob(svgEl, {
    pixelRatio: options.pixelRatio,
  });
  return blob;
}
