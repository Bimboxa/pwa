import EditAnnotationTools from "./EditAnnotationTools";
import IconButtonMoreAnnotationTools from "./IconButtonMoreAnnotationTools";

import getAnnotationColor from "../utils/getAnnotationColor";

// "Plus d'outils" button of the quick-action row rendered above the selected
// annotation (NodeSegmentLengthsStatic overlay, next to the angle padlock).
// `annotation` is the resolved (pixel-space) annotation of the host node —
// the same object useSelectedAnnotation would return for a single selection.
export default function OverlayButtonMoreAnnotationTools({
  annotation,
  overlayColor,
}) {
  const accentColor = getAnnotationColor(annotation) || "#6366F1";
  const isClosedShape =
    annotation?.type === "POLYGON" ||
    (annotation?.type === "POLYLINE" && Boolean(annotation?.closeLine));

  return (
    <IconButtonMoreAnnotationTools
      key={annotation?.id}
      accentColor={accentColor}
      variant="overlay"
      overlayColor={overlayColor}
    >
      <EditAnnotationTools
        selectedAnnotation={annotation}
        accentColor={accentColor}
        isClosedShape={isClosedShape}
      />
    </IconButtonMoreAnnotationTools>
  );
}
