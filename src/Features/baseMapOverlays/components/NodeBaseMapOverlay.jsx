import { memo, useMemo } from "react";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import NodeLabelStatic from "Features/mapEditorGeneric/components/NodeLabelStatic";

import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import resolveAnnotationDefaults from "Features/annotations/utils/resolveAnnotationDefaults";
import { sortOpeningsLast } from "Features/annotations/utils/isOpeningAnnotation";
import { getSourceBoxFromHostBox } from "Features/baseMaps/js/getBaseMapToBaseMapPxMatrix";

import { OVERLAY_CONTENT_ATTRIBUTE } from "../constants/baseMapOverlayConstants";

// One base map overlaid on the main one: its image (active version) and / or
// its annotations, drawn in ITS OWN reference frame inside a group carrying
// the source px -> host px matrix. Read-only (the wrapper of
// OverlayBaseMapsLayer disables the pointer events).
//
// The group's `transform` is also written imperatively by
// OverlayBaseMapsTransformLayer during a move / rotate gesture: React only
// rewrites it when `matrixStr` changes, i.e. when the committed pose comes
// back from the db.
//
// Memoized: props must stay referentially stable (see useBaseMapOverlays) so
// neither a hover nor a pan re-renders the overlaid annotations.
export default memo(function NodeBaseMapOverlay({
  baseMap,
  matrix,
  matrixStr,
  showImage,
  annotations,
  // scale of the host group (basePose.k)
  hostContainerK = 1,
  // editor's visible box in HOST px (null = no culling)
  visibleViewBox,
  spriteImage,
  sizeVariant,
}) {
  // helpers

  const imageSize = baseMap.getImageSize?.();
  const meterByPx = baseMap.getMeterByPx?.() ?? null;
  const imageScale = baseMap.getImageScale?.() ?? 1;
  const version = baseMap.getActiveVersion?.();
  const containerK = hostContainerK * matrix.scale;
  const imageNodeId = `overlay-${baseMap.id}`;

  // Viewport culling, in this base map's frame. Openings last: their white
  // gap must cover the host wall.
  const visibleAnnotations = useMemo(() => {
    const shown = annotations?.filter((a) => !a.hidden) ?? [];
    const box = visibleViewBox
      ? getSourceBoxFromHostBox(matrix, visibleViewBox)
      : null;
    return sortOpeningsLast(filterAnnotationsByViewBox(shown, box));
  }, [annotations, visibleViewBox, matrix]);

  // render

  return (
    <g {...{ [OVERLAY_CONTENT_ATTRIBUTE]: baseMap.id }} transform={matrixStr}>
      {showImage && version?.image?.imageSize && (
        <g
          transform={`translate(${version.transform?.x ?? 0}, ${
            version.transform?.y ?? 0
          }) scale(${version.transform?.scale ?? 1}) rotate(${
            version.transform?.rotation ?? 0
          })`}
        >
          <NodeSvgImage
            src={version.image.imageUrlClient ?? version.image.imageUrlRemote}
            dataNodeId={imageNodeId}
            width={version.image.imageSize.width}
            height={version.image.imageSize.height}
          />
        </g>
      )}
      {showImage && !version && imageSize && (
        <NodeSvgImage
          src={baseMap.getUrl()}
          dataNodeId={imageNodeId}
          width={imageSize.width}
          height={imageSize.height}
        />
      )}

      {visibleAnnotations.map((annotation) => (
        <NodeAnnotationStatic
          key={annotation.id}
          annotation={annotation}
          spriteImage={spriteImage}
          sizeVariant={sizeVariant}
          imageSize={imageSize}
          containerK={containerK}
          baseMapMeterByPx={meterByPx}
          baseMapImageScale={imageScale}
          // labels: hoisted pass below, above every shape
          forceHideLabel={true}
        />
      ))}

      {visibleAnnotations.map((annotation) => {
        let labelProps = null;
        if (annotation.type === "LABEL") {
          labelProps = annotation;
        } else if (annotation.showLabel) {
          labelProps = getAnnotationLabelPropsFromAnnotation(
            resolveAnnotationDefaults(annotation)
          );
        }
        if (!labelProps) return null;
        return (
          <NodeLabelStatic
            key={"label::" + annotation.id}
            annotation={labelProps}
            containerK={containerK}
            hidden={labelProps.hidden}
          />
        );
      })}
    </g>
  );
});
