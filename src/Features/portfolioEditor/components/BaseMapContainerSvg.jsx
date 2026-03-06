import { useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import computeDefaultViewBox from "../utils/computeDefaultViewBox";
import EmptyContainerPlaceholder from "./EmptyContainerPlaceholder";
import FramingOverlay from "./FramingOverlay";
import ContainerTransformOverlay from "./ContainerTransformOverlay";

export default function BaseMapContainerSvg({
  container,
  zoom,
  onPlaceholderHover,
  onPlaceholderLeave,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const framingContainerId = useSelector(
    (s) => s.portfolioBaseMapContainers.framingContainerId
  );
  const baseMap = useBaseMap({ id: container.baseMapId });
  const annotations = useAnnotationsV2({
    filterByBaseMapId: container.baseMapId,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: true,
    excludeBgAnnotations: true,
  });

  // refs

  const innerSvgRef = useRef(null);
  const labelSvgRef = useRef(null);
  const placeholderSvgRef = useRef(null);

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === container.id && i.type === "BASE_MAP_CONTAINER"
  );
  const hasBaseMap = container.baseMapId && baseMap;
  const isFraming = framingContainerId === container.id && hasBaseMap;

  const imageSize = hasBaseMap ? baseMap.getImageSize() : null;
  const meterByPx = hasBaseMap ? baseMap.getMeterByPx() : null;
  const viewBox =
    hasBaseMap && imageSize
      ? container.viewBox || computeDefaultViewBox(baseMap, container)
      : null;

  const nonLabelAnnotations = annotations?.filter((a) => a.type !== "LABEL");
  const labelAnnotations = viewBox
    ? filterAnnotationsByViewBox(
        annotations?.filter((a) => a.type === "LABEL"),
        viewBox
      )
    : [];

  const viewBoxStr = viewBox
    ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    : "";
  const containerK = viewBox ? container.width / viewBox.width : 1;
  const clipId = `clip-container-${container.id}`;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    if (framingContainerId) return;
    dispatch(
      setSelectedItem({ id: container.id, type: "BASE_MAP_CONTAINER" })
    );
  }

  function handlePlaceholderMouseEnter() {
    onPlaceholderHover?.({
      anchorEl: placeholderSvgRef.current,
      containerId: container.id,
    });
  }

  function handlePlaceholderMouseLeave() {
    onPlaceholderLeave?.();
  }

  // render

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      {!hasBaseMap && (
        <svg
          ref={placeholderSvgRef}
          x={container.x}
          y={container.y}
          width={container.width}
          height={container.height}
        >
          <EmptyContainerPlaceholder
            width={container.width}
            height={container.height}
            onMouseEnter={handlePlaceholderMouseEnter}
            onMouseLeave={handlePlaceholderMouseLeave}
          />
        </svg>
      )}

      {hasBaseMap && imageSize && (
        <svg
          ref={innerSvgRef}
          x={container.x}
          y={container.y}
          width={container.width}
          height={container.height}
          viewBox={viewBoxStr}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.width}
                height={viewBox.height}
              />
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <NodeSvgImage
              src={baseMap.getUrl()}
              dataNodeId={container.id}
              dataNodeType="BASE_MAP_CONTAINER"
              width={imageSize.width}
              height={imageSize.height}
              opacity={container.baseMapOpacity ?? 1}
            />
            {nonLabelAnnotations?.map((annotation) => (
              <NodeAnnotationStatic
                key={annotation.id}
                annotation={annotation}
                imageSize={imageSize}
                baseMapMeterByPx={meterByPx}
                printMode
              />
            ))}
          </g>
        </svg>
      )}

      {isFraming && (
        <FramingOverlay
          container={container}
          baseMap={baseMap}
          innerSvgRef={innerSvgRef}
          labelSvgRef={labelSvgRef}
        />
      )}

      {isSelected && (
        <ContainerTransformOverlay
          container={container}
          zoom={zoom}
          innerSvgRef={innerSvgRef}
          labelSvgRef={labelSvgRef}
          framing={isFraming}
        />
      )}

      {/* Labels rendered AFTER overlay so they appear on top */}
      {hasBaseMap && imageSize && labelAnnotations?.length > 0 && (
        <svg
          ref={labelSvgRef}
          x={container.x}
          y={container.y}
          width={container.width}
          height={container.height}
          viewBox={viewBoxStr}
          overflow="visible"
          style={{ pointerEvents: "none" }}
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
