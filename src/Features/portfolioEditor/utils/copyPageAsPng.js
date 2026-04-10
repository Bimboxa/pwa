import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default async function copyPageAsPng(
  pageId,
  { includeCartouche = true } = {}
) {
  const svgEl = document.querySelector(
    `svg[data-portfolio-page-id="${pageId}"]`
  );
  if (!svgEl) return;

  const headerEl = svgEl.querySelector("[data-portfolio-header]");

  if (!includeCartouche && headerEl) {
    headerEl.style.visibility = "hidden";
  }

  try {
    const blob = await getImageFromSvg(svgEl, { pixelRatio: 2 });
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
  } finally {
    if (headerEl) headerEl.style.visibility = "";
  }
}
