import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useLegendItemsByBaseMapId from "Features/legend/hooks/useLegendItemsByBaseMapId";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplateQtiesByIdForBaseMap from "Features/annotations/hooks/useAnnotationTemplateQtiesByIdForBaseMap";

import NodeLegendStatic from "Features/mapEditorGeneric/components/NodeLegendStatic";
import LegendTransformOverlay from "./LegendTransformOverlay";

import db from "App/db/db";

const DEFAULT_WIDTH = 140;
const DEFAULT_FONT_SIZE = 12;
const PADDING = 16;

export default function LegendBlockSvg({ container, zoom }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const viewBox = container.viewBox;
  const legendItems = useLegendItemsByBaseMapId(container.baseMapId, {
    viewBox,
    disabledAnnotationTemplates: container.disabledAnnotationTemplates,
  });
  const spriteImage = useAnnotationSpriteImage();
  const qtiesById = useAnnotationTemplateQtiesByIdForBaseMap(container.baseMapId, { viewBox });

  // refs

  const wrapperRef = useRef(null);
  const [measuredHeight, setMeasuredHeight] = useState(100);

  // helpers

  const legendFormat = container.legendFormat ?? {
    x: container.x + container.width - DEFAULT_WIDTH - PADDING,
    y: container.y + PADDING,
    width: DEFAULT_WIDTH,
    fontSize: DEFAULT_FONT_SIZE,
    showQty: false,
  };
  // Ensure fontSize has a default even for persisted records without it
  if (!legendFormat.fontSize) legendFormat.fontSize = DEFAULT_FONT_SIZE;

  const isSelected = selectedItems.some(
    (i) => i.id === container.id && i.type === "LEGEND_BLOCK"
  );

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({ id: container.id, type: "LEGEND_BLOCK" })
    );
  }

  const handleSizeChange = useCallback(({ height }) => {
    setMeasuredHeight(height);
  }, []);

  function handleCommit({ x, y, width }) {
    const updatedFormat = { ...legendFormat, x, y, width };
    db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: updatedFormat,
    });
  }

  // render

  if (!legendItems?.length) return null;

  const overlayRect = {
    x: legendFormat.x,
    y: legendFormat.y,
    width: legendFormat.width,
    height: measuredHeight,
  };

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      <g ref={wrapperRef}>
        <NodeLegendStatic
          id={`legend-${container.id}`}
          legendItems={legendItems}
          spriteImage={spriteImage}
          legendFormat={legendFormat}
          showQty={legendFormat.showQty}
          qtiesById={qtiesById}
          onSizeChange={handleSizeChange}
        />
      </g>

      {isSelected && (
        <LegendTransformOverlay
          rect={overlayRect}
          zoom={zoom}
          onCommit={handleCommit}
          legendRef={wrapperRef}
        />
      )}
    </g>
  );
}
