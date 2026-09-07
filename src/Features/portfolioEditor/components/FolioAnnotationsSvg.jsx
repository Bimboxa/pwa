import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import { sortOpeningsLast } from "Features/annotations/utils/isOpeningAnnotation";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

// Annotations drawn on the detail baseMap of a FOLIO_PAGE, overlaid on the
// PDF page at the rect covered by the detail image (getFolioAnnotationsRect).
// Mirrors BaseMapContainerSvg: shapes clipped to the image rect, labels in a
// second overflow-visible svg so they stay on top. The whole group is tagged
// data-folio-annotations: the PDF export captures it alone (transparent PNG)
// and stamps it on the vector copy of the page.
export default function FolioAnnotationsSvg({ baseMap, rect }) {
  // data

  const spriteImage = useAnnotationSpriteImage();
  const annotations = useAnnotationsV2({
    caller: "FolioAnnotationsSvg",
    filterByBaseMapId: baseMap?.id,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: true,
    sortByOrderIndex: true,
    enabled: !!baseMap?.id,
  });

  // helpers

  const imageSize = baseMap?.image?.imageSize;
  const meterByPx = baseMap?.meterByPx ?? null;
  if (!baseMap?.id || !imageSize?.width || !imageSize?.height || !rect)
    return null;
  if (!annotations?.length) return null;

  const viewBoxStr = `0 0 ${imageSize.width} ${imageSize.height}`;
  const containerK = rect.width / imageSize.width;

  // Openings last: their white gap must cover the host wall.
  const nonLabelAnnotations = sortOpeningsLast(
    annotations.filter((a) => a.type !== "LABEL")
  );
  const labelAnnotations = annotations.filter((a) => a.type === "LABEL");

  // render

  return (
    <g data-folio-annotations style={{ pointerEvents: "none" }}>
      <svg
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        viewBox={viewBoxStr}
      >
        {nonLabelAnnotations.map((annotation) => (
          <NodeAnnotationStatic
            key={annotation.id}
            annotation={annotation}
            imageSize={imageSize}
            baseMapMeterByPx={meterByPx}
            containerK={containerK}
            spriteImage={spriteImage}
            printMode
          />
        ))}
      </svg>
      {labelAnnotations.length > 0 && (
        <svg
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          viewBox={viewBoxStr}
          overflow="visible"
        >
          {labelAnnotations.map((annotation) => (
            <NodeAnnotationStatic
              key={annotation.id}
              annotation={annotation}
              imageSize={imageSize}
              baseMapMeterByPx={meterByPx}
              containerK={containerK}
              printMode
            />
          ))}
        </svg>
      )}
    </g>
  );
}
