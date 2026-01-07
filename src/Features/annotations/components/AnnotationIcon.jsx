import MarkerIcon from "Features/markers/components/MarkerIcon";
import PolylineIcon from "Features/polylines/components/PolylineIcon";
import PolygonIcon from "Features/polygons/components/PolygonIcon";
import RectangleIcon from "Features/rectangles/components/RectangleIcon";
import ImageAnnotationIcon from "Features/imageAnnotations/components/ImageAnnotationIcon";
import PointAnnotationIcon from "Features/pointAnnotations/components/PointAnnotationIcon";
import StripAnnotationIcon from "Features/stripAnnotations/components/StripAnnotationIcon";

export default function AnnotationIcon({ spriteImage, annotation, size }) {
  switch (annotation?.type) {
    case "MARKER":
      return (
        <MarkerIcon {...annotation} spriteImage={spriteImage} size={size} />
      );
    case "POINT":
      return (
        <PointAnnotationIcon {...annotation} size={size} />
      );
    case "POLYLINE":
      return <PolylineIcon {...annotation} size={size} />;

    case "STRIP":
      return <StripAnnotationIcon {...annotation} size={size} />;

    case "POLYGON":
      return <PolygonIcon {...annotation} size={size} />;

    case "RECTANGLE":
      return <RectangleIcon {...annotation} size={size} />;

    case "IMAGE":
      return <ImageAnnotationIcon {...annotation} size={size} />;

    default:
      return <div>-</div>;
  }
}
