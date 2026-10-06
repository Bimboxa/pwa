const ORIENTATION_LABELS = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carré",
};

// label of a configuration baseMap item ("A3 paysage · 1/50", "Image",
// "PDF p.2 · A3 paysage · 1/50")
export default function getPageLabel(item) {
  if (item?.type === "ASSET") return "Image";
  const scale = item?.scale ? ` · 1/${item.scale}` : "";
  if (item?.type === "PDF_PAGE") {
    // sheet format only when the configuration declares it
    const sheet =
      item.pageFormat || item.pageOrientation
        ? ` · ${item.pageFormat ?? "A3"} ${
            ORIENTATION_LABELS[item.pageOrientation] ?? "paysage"
          }`
        : "";
    return `PDF p.${item.pageNumber ?? 1}${sheet}${scale}`;
  }
  const orientation = ORIENTATION_LABELS[item?.pageOrientation] ?? "paysage";
  const format = item?.pageFormat ?? "A3";
  return `${format} ${orientation}${scale}`;
}
