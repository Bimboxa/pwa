import { getTextPageScale } from "Features/annotations/constants/freeTextConstants";

// Page-pt → image-px scale of a COTE / RULER annotation: their "ink" (text,
// ticks, PX strokes) is sized in PDF points of the base map's print zone, so
// it stays FIXED relative to the plan — same rule as FREE_TEXT.
// `pagePxPerPt` / `imageLongSidePx` are stamped by useAnnotationsV2; rows that
// were not stamped (template preview, drafts) fall back to 1 = plain image px.
export default function getCotePageScale(annotation) {
  const scale = getTextPageScale({
    pagePxPerPt: annotation?.pagePxPerPt,
    pageFormat: "A4",
    imageLongSidePx: annotation?.imageLongSidePx,
  });
  return scale > 0 ? scale : 1;
}
