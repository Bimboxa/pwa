import { useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import usePov from "Features/pov/hooks/usePov";
import usePovImageUrl from "Features/pov/hooks/usePovImageUrl";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";

import ContainerTransformOverlay from "./ContainerTransformOverlay";

export default function PovContainerSvg({ container, zoom }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const pov = usePov(container.povId);
  const isLoading = pov === "loading";
  const isDeleted = !isLoading && !pov;
  const fileName =
    !isLoading && pov
      ? pov.transformedImage?.fileName ?? pov.image?.fileName
      : null;
  const imageUrl = usePovImageUrl(fileName);

  // refs

  const innerSvgRef = useRef(null);

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === container.id && i.type === "BASE_MAP_CONTAINER"
  );

  const viewBox = container.viewBox;
  const viewBoxStr = viewBox
    ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    : undefined;
  const imageWidth = viewBox?.width ?? container.width;
  const imageHeight = viewBox?.height ?? container.height;
  const clipId = `clip-container-${container.id}`;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({
        id: container.id,
        type: "BASE_MAP_CONTAINER",
        portfolioPageId: container.portfolioPageId,
      })
    );
  }

  // render

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      <svg
        ref={innerSvgRef}
        x={container.x}
        y={container.y}
        width={container.width}
        height={container.height}
        viewBox={viewBoxStr}
      >
        {isDeleted ? (
          <g>
            <rect
              x="0.5%"
              y="0.5%"
              width="99%"
              height="99%"
              fill="none"
              stroke="#bbb"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#999"
              fontSize={12}
            >
              Point de vue supprimé
            </text>
          </g>
        ) : (
          imageUrl && (
            <>
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={viewBox?.x ?? 0}
                    y={viewBox?.y ?? 0}
                    width={imageWidth}
                    height={imageHeight}
                  />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                <NodeSvgImage
                  src={imageUrl}
                  dataNodeId={container.id}
                  dataNodeType="BASE_MAP_CONTAINER"
                  width={imageWidth}
                  height={imageHeight}
                  opacity={container.baseMapOpacity ?? 1}
                />
              </g>
            </>
          )
        )}
      </svg>

      {isSelected && (
        <ContainerTransformOverlay
          container={container}
          zoom={zoom}
          innerSvgRef={innerSvgRef}
        />
      )}
    </g>
  );
}
