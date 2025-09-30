import { useSelector } from "react-redux";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useNewAnnotationColor() {
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const { value: listing } = useSelectedListing();

  let color = listing?.color;

  if (!newAnnotation) return color;

  if (newAnnotation.type === "MARKER") {
    color = newAnnotation.fillColor;
  } else if (newAnnotation.type === "POLYLINE") {
    if (newAnnotation.closeLine) {
      color = newAnnotation.fillColor;
    } else {
      color = newAnnotation.strokeColor;
    }
  }

  return color;
}
