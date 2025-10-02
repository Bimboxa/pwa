import MarkerIcon from "Features/markers/components/MarkerIcon";
import PolylineIcon from "Features/polylines/components/PolylineIcon";

export default function AnnotationIcon({ spriteImage, annotation, size }) {
  console.log("annotation", annotation);

  switch (annotation?.type) {
    case "MARKER":
      return (
        <MarkerIcon {...annotation} spriteImage={spriteImage} size={size} />
      );
    case "POLYLINE":
      return <PolylineIcon {...annotation} size={size} />;
    default:
      return <div>-</div>;
  }
}
