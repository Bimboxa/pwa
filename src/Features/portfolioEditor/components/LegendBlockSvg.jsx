import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import usePhaseHiddenAnnotationIdSetOfPhase from "Features/phasing/hooks/usePhaseHiddenAnnotationIdSetOfPhase";
import useLegendItemsByBaseMapId from "Features/legend/hooks/useLegendItemsByBaseMapId";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplateQtiesByIdForBaseMap from "Features/annotations/hooks/useAnnotationTemplateQtiesByIdForBaseMap";

import NodeLegendStatic from "Features/mapEditorGeneric/components/NodeLegendStatic";
import LegendTransformOverlay from "./LegendTransformOverlay";

import applyHardCodedQties from "Features/legend/utils/applyHardCodedQties";
import { resolveLegendFormat } from "../utils/getDefaultLegendFormat";

import db from "App/db/db";

export default function LegendBlockSvg({
  container,
  zoom,
  pageDims,
  pageFrame,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const viewBox = container.viewBox;
  // « Journal des phases »: legend and quantities of the container's phase
  const phaseHiddenIdSet = usePhaseHiddenAnnotationIdSetOfPhase(
    container.phaseId
  );
  const legendItems = useLegendItemsByBaseMapId(container.baseMapId, {
    viewBox,
    hiddenAnnotationIdSet: phaseHiddenIdSet,
    disabledAnnotationTemplates: container.disabledAnnotationTemplates,
    disabledLayerIds: container.disabledLayerIds,
    hideHeight: container.legendFormat?.hideHeight,
  });
  const spriteImage = useAnnotationSpriteImage();
  const qtiesById = useAnnotationTemplateQtiesByIdForBaseMap(
    container.baseMapId,
    {
      viewBox,
      hiddenAnnotationIdSet: phaseHiddenIdSet,
      disabledAnnotationTemplates: container.disabledAnnotationTemplates,
      disabledLayerIds: container.disabledLayerIds,
    }
  );

  // refs

  const wrapperRef = useRef(null);
  const [measuredHeight, setMeasuredHeight] = useState(100);

  // helpers

  const legendFormat = resolveLegendFormat(container, { pageDims, pageFrame });

  const isSelected = selectedItems.some(
    (i) => i.id === container.id && i.type === "LEGEND_BLOCK"
  );

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(setSelectedItem({ id: container.id, type: "LEGEND_BLOCK" }));
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
    // data-legend-*: rendered height read by the "align legends" action
    // (the height is content-driven, not stored)
    <g
      onClick={handleClick}
      style={{ cursor: "pointer" }}
      data-legend-container-id={container.id}
      data-legend-height={measuredHeight}
    >
      <g ref={wrapperRef}>
        <NodeLegendStatic
          id={`legend-${container.id}`}
          legendItems={legendItems}
          spriteImage={spriteImage}
          legendFormat={legendFormat}
          showQty={legendFormat.showQty}
          qtiesById={applyHardCodedQties(
            qtiesById,
            container.legendFormat?.hardCodedQtiesById
          )}
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
