import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import computeDefaultViewBox from "../utils/computeDefaultViewBox";
import EmptyContainerPlaceholder from "./EmptyContainerPlaceholder";

import theme from "Styles/theme";

function FilledContainerContent({ container, baseMap }) {
  // data

  const annotations = useAnnotationsV2({
    filterByBaseMapId: container.baseMapId,
  });

  // helpers

  const imageSize = baseMap.getImageSize();
  const viewBox =
    container.viewBox || computeDefaultViewBox(baseMap, container);

  if (!imageSize) return null;

  // render

  return (
    <svg
      x={container.x}
      y={container.y}
      width={container.width}
      height={container.height}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
    >
      <NodeSvgImage
        src={baseMap.getUrl()}
        dataNodeId={container.id}
        dataNodeType="BASE_MAP_CONTAINER"
        width={imageSize.width}
        height={imageSize.height}
      />
      {annotations?.map((annotation) => (
        <NodeAnnotationStatic
          key={annotation.id}
          annotation={annotation}
          imageSize={imageSize}
          printMode
        />
      ))}
    </svg>
  );
}

export default function BaseMapContainerSvg({ container }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const baseMap = useBaseMap({ id: container.baseMapId });

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === container.id && i.type === "BASE_MAP_CONTAINER"
  );
  const hasBaseMap = container.baseMapId && baseMap;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({ id: container.id, type: "BASE_MAP_CONTAINER" })
    );
  }

  // render

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      {!hasBaseMap && (
        <svg
          x={container.x}
          y={container.y}
          width={container.width}
          height={container.height}
        >
          <EmptyContainerPlaceholder
            width={container.width}
            height={container.height}
          />
        </svg>
      )}

      {hasBaseMap && (
        <FilledContainerContent container={container} baseMap={baseMap} />
      )}

      {isSelected && (
        <rect
          x={container.x}
          y={container.y}
          width={container.width}
          height={container.height}
          fill="none"
          stroke={theme.palette.viewers.portfolio}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </g>
  );
}
