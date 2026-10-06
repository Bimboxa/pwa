const ORIENTATION_LABELS = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carré",
};

// label of a configuration baseMap item ("A3 paysage · 1/50", "Image")
export default function getPageLabel(item) {
  if (item?.type === "ASSET") return "Image";
  const orientation = ORIENTATION_LABELS[item?.pageOrientation] ?? "paysage";
  const format = item?.pageFormat ?? "A3";
  const scale = item?.scale ? ` · 1/${item.scale}` : "";
  return `${format} ${orientation}${scale}`;
}
