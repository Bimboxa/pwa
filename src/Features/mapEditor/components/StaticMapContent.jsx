import { memo, useEffect, useRef, useMemo } from "react";

import { useSelector, useDispatch } from "react-redux";
import {
  selectSelectedPointId,
  selectSelectedItems,
} from "Features/selection/selectionSlice";
import {
  setClippingPlan,
  setClippingPlanSign,
} from "Features/mapEditor/mapEditorSlice";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";
import useSelectedNodes from "Features/mapEditor/hooks/useSelectedNodes";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import NodeLegendStatic from "Features/mapEditorGeneric/components/NodeLegendStatic";
import NodeClippingPlanStatic from "Features/mapEditorGeneric/components/NodeClippingPlanStatic";
import NodeProxyRevolutionStatic from "Features/mapEditorGeneric/components/NodeProxyRevolutionStatic";
import MeshSelectionHighlight from "Features/mapEditor/components/MeshSelectionHighlight";

import { useInteraction } from "Features/mapEditor/context/InteractionContext";

function StaticMapContent({
  bgImageUrl,
  bgImageSize,
  showBgImage,
  bgPose = { x: 0, y: 0, k: 1 },
  basePose,
  baseMapImageUrl,
  baseMapImageSize,
  baseMapMeterByPx,
  baseMapImageScale = 1,
  annotations,
  labelOverridesById,
  legendItems,
  legendFormat,
  sizeVariant,
  isEditingBaseMap = false,
  opacity = 1,
  grayScale = false,
  grayLevelThreshold = 0,
  // multi-version (BASE_MAPS viewer only)
  versions,
  hiddenVersionIds,
  selectedVersionId,
  isBaseMapsViewer = false,
  isEditingVersion = false,
  // version compare
  versionCompareEnabled = false,
  versionCompareId,
}) {
  // data

  // [MODIF 1] Récupérer selectedPointId via Redux
  const {
    hoveredNode,
    hiddenAnnotationIds,
    getPendingMove,
    pendingMovesVersion,
    visibleViewBox,
  } = useInteraction();
  const selectedPointId = useSelector(selectSelectedPointId);
  const selectedItems = useSelector(selectSelectedItems);
  // Derive selectedNode/selectedNodes from new slice for compatibility
  const { node: selectedNode, nodes: selectedNodes } = useSelectedNodes();

  const spriteImage = useAnnotationSpriteImage();
  const anchorSourceAnnotationId = useSelector(
    (s) => s.mapEditor.anchorSourceAnnotationId
  );

  // clipping plane (2D-defined cut plane)
  const dispatch = useDispatch();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const clippingPlanEnabled = useSelector(
    (s) => s.mapEditor.clippingPlanEnabled
  );
  const clippingPlan = useSelector((s) => s.mapEditor.clippingPlan);

  // Derive selectMode from the active drawing tool
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const selectMode = useMemo(() => {
    if (["TECHNICAL_RETURN", "CUT_SEGMENT"].includes(enabledDrawingMode))
      return "SEGMENT";
    // Future: add "VERTEX" for point-selection modes
    return null;
  }, [enabledDrawingMode]);

  // perf measurement: time from marker commit to render
  const prevAnnotationCountRef = useRef(annotations?.length ?? 0);
  useEffect(() => {
    const count = annotations?.length ?? 0;
    if (count > prevAnnotationCountRef.current) {
      if (performance.getEntriesByName("marker-commit-start").length > 0) {
        performance.mark("marker-render-end");
        const measure = performance.measure(
          "marker-commit-to-render",
          "marker-commit-start",
          "marker-render-end"
        );
        console.log(
          `[debug_perf] ⏱ marker commit → render: ${measure.duration.toFixed(0)}ms (${prevAnnotationCountRef.current} → ${count} annotations)`
        );
        performance.clearMarks("marker-commit-start");
        performance.clearMarks("marker-render-end");
        performance.clearMeasures("marker-commit-to-render");
      }
    }
    prevAnnotationCountRef.current = count;
  }, [annotations?.length]);

  // helpers

  const baseMapIsHovered = showBgImage && hoveredNode?.nodeType === "BASE_MAP";
  const baseMapIsSelected =
    showBgImage && selectedNode?.nodeType === "BASE_MAP";
  const legendIsHovered = showBgImage && hoveredNode?.nodeType === "LEGEND";
  const legendIsSelected = showBgImage && selectedNode?.nodeType === "LEGEND";

  // helpers - annotations

  const bgImageAnnotations = showBgImage
    ? annotations.filter(({ nodeType }) => nodeType === "BG_IMAGE_TEXT")
    : [];
  const baseMapAnnotations = useMemo(
    () =>
      annotations.filter(
        ({ baseMapId, hidden }) => Boolean(baseMapId) && !hidden
      ),
    [annotations]
  );

  // Viewport culling: only mount SVG nodes for annotations whose bbox
  // intersects the visible box (with margin, pushed by InteractionLayer).
  // null viewBox → no filtering (first render / unknown viewport). The
  // topology set (idsAffectedBySelectedPoint), MeshSelectionHighlight and
  // the BG layer intentionally keep the FULL annotations array.
  const visibleBaseMapAnnotations = useMemo(
    () => filterAnnotationsByViewBox(baseMapAnnotations, visibleViewBox),
    [baseMapAnnotations, visibleViewBox]
  );

  // [MODIF 2] Calculer les annotations touchées par le point sélectionné (Topologie)
  const idsAffectedBySelectedPoint = useMemo(() => {
    if (!selectedPointId) return new Set();
    const affectedIds = new Set();

    // On cherche dans TOUTES les annotations, pas seulement les filtrées
    annotations.forEach((ann) => {
      const inMain = ann.points?.some((pt) => pt.id === selectedPointId);
      const inCuts = ann.cuts?.some((cut) =>
        cut.points?.some((pt) => pt.id === selectedPointId)
      );

      if (inMain || inCuts) {
        affectedIds.add(ann.id);
      }
    });

    return affectedIds;
  }, [selectedPointId, annotations]);

  return (
    <>
      {/* --- BG LAYER  --- */}
      <g transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}>
        {showBgImage && (
          <NodeSvgImage
            src={bgImageUrl}
            dataNodeType="BG_IMAGE"
            dataNodeId={bgImageUrl}
            width={bgImageSize?.width}
            height={bgImageSize?.height}
          />
        )}

        {bgImageAnnotations.map((annotation) => {
          // Pour le texte BG, on garde la logique simple (ou on adapte si besoin)
          if (hiddenAnnotationIds?.includes(annotation.id)) return null;
          if (selectedNode?.nodeId === annotation.id) return null; // Masquer si édité

          // Optimistic overlay : rendre invisible (opacity:0) au lieu de démonter
          const hasPendingMove = !!getPendingMove(annotation.id);

          return (
            <g
              key={annotation.id}
              style={hasPendingMove ? { opacity: 0 } : undefined}
            >
              <NodeAnnotationStatic
                annotation={annotation}
                spriteImage={spriteImage}
                imageSize={bgImageSize}
                hovered={annotation.id === hoveredNode?.nodeId}
                selected={false}
                sizeVariant={sizeVariant}
                containerK={bgPose.k}
                baseMapMeterByPx={baseMapMeterByPx}
                context="BG_IMAGE"
                forceHideLabel={hiddenAnnotationIds?.includes(
                  "label::" + annotation.id
                )}
              />
            </g>
          );
        })}
      </g>

      {/* --- BASE MAP LAYER --- */}
      <g
        transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
        style={{ pointerEvents: "auto" }}
      >
        {/* Multi-version rendering for BASE_MAPS viewer */}
        {isBaseMapsViewer && versions?.length > 0 ? (
          <>
            {/* SVG clipPath definition for version compare */}
            {versionCompareEnabled && versionCompareId && (
              <defs>
                <clipPath id="version-compare-clip">
                  <rect
                    id="version-compare-clip-rect"
                    x={0}
                    y={0}
                    width={0}
                    height={0}
                  />
                </clipPath>
              </defs>
            )}

            {/* Compare mode: render compared version (bottom, full) then active (top, clipped) */}
            {versionCompareEnabled &&
              versionCompareId &&
              (() => {
                const comparedVersion = versions.find(
                  (v) => v.id === versionCompareId
                );
                const activeVersion =
                  versions.find((v) => v.isActive) || versions[0];
                if (!comparedVersion || !activeVersion) return null;

                const cUrl =
                  comparedVersion.image?.imageUrlClient ??
                  comparedVersion.image?.imageUrlRemote;
                const cSize = comparedVersion.image?.imageSize;
                const cT = comparedVersion.transform || {
                  x: 0,
                  y: 0,
                  rotation: 0,
                  scale: 1,
                };

                const aUrl =
                  activeVersion.image?.imageUrlClient ??
                  activeVersion.image?.imageUrlRemote;
                const aSize = activeVersion.image?.imageSize;
                const aT = activeVersion.transform || {
                  x: 0,
                  y: 0,
                  rotation: 0,
                  scale: 1,
                };

                return (
                  <>
                    {/* Compared version — bottom, full, no clip */}
                    {cUrl && cSize && (
                      <g
                        transform={`translate(${cT.x}, ${cT.y}) scale(${cT.scale}) rotate(${cT.rotation || 0})`}
                      >
                        <NodeSvgImage
                          src={cUrl}
                          dataNodeType="BASE_MAP_VERSION"
                          dataNodeId={comparedVersion.id}
                          width={cSize.width}
                          height={cSize.height}
                          opacity={opacity}
                          grayScale={grayScale}
                          grayLevelThreshold={grayLevelThreshold}
                        />
                      </g>
                    )}
                    {/* Active version — top, clipped via outer wrapper */}
                    {aUrl && aSize && (
                      <g clipPath="url(#version-compare-clip)">
                        {/* Opaque background to hide compared version underneath */}
                        <rect
                          x={-99999}
                          y={-99999}
                          width={199998}
                          height={199998}
                          fill="white"
                        />
                        <g
                          transform={`translate(${aT.x}, ${aT.y}) scale(${aT.scale}) rotate(${aT.rotation || 0})`}
                        >
                          <NodeSvgImage
                            src={aUrl}
                            dataNodeType="BASE_MAP_VERSION"
                            dataNodeId={activeVersion.id}
                            width={aSize.width}
                            height={aSize.height}
                            opacity={opacity}
                            grayScale={grayScale}
                            grayLevelThreshold={grayLevelThreshold}
                          />
                        </g>
                      </g>
                    )}
                  </>
                );
              })()}

            {/* Normal multi-version rendering (when compare is off) */}
            {!versionCompareEnabled &&
              versions
                .filter((v) => !hiddenVersionIds?.includes(v.id))
                .sort((a, b) =>
                  (b.fractionalIndex || "").localeCompare(
                    a.fractionalIndex || ""
                  )
                )
                .map((version) => {
                  if (isEditingVersion && selectedVersionId === version.id)
                    return null;
                  const vUrl =
                    version.image?.imageUrlClient ??
                    version.image?.imageUrlRemote;
                  const vSize = version.image?.imageSize;
                  if (!vUrl || !vSize) return null;
                  const t = version.transform || {
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scale: 1,
                  };
                  const isSelected = selectedVersionId === version.id;
                  return (
                    <g
                      key={version.id}
                      transform={`translate(${t.x}, ${t.y}) scale(${t.scale}) rotate(${t.rotation || 0})`}
                    >
                      <NodeSvgImage
                        src={vUrl}
                        dataNodeType="BASE_MAP_VERSION"
                        dataNodeId={version.id}
                        width={vSize.width}
                        height={vSize.height}
                        hovered={hoveredNode?.nodeId === version.id}
                        selected={isSelected}
                        opacity={version.isActive ? opacity : 0.5}
                        grayScale={grayScale}
                        grayLevelThreshold={grayLevelThreshold}
                      />
                    </g>
                  );
                })}
          </>
        ) : versions?.length > 0 ? (
          // MAP viewer with versions: render active version at actual size with transform
          (() => {
            const activeVersion =
              versions.find((v) => v.isActive) || versions[0];
            if (!activeVersion || isEditingBaseMap) return null;
            const vUrl =
              activeVersion.image?.imageUrlClient ??
              activeVersion.image?.imageUrlRemote;
            const vSize = activeVersion.image?.imageSize;
            if (!vUrl || !vSize) return null;
            const t = activeVersion.transform || {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
            };
            return (
              <g
                transform={`translate(${t.x}, ${t.y}) scale(${t.scale}) rotate(${t.rotation || 0})`}
              >
                <NodeSvgImage
                  src={vUrl}
                  dataNodeType="BASE_MAP"
                  dataNodeId={vUrl}
                  width={vSize.width}
                  height={vSize.height}
                  hovered={baseMapIsHovered}
                  selected={baseMapIsSelected}
                  opacity={opacity}
                  grayScale={grayScale}
                  grayLevelThreshold={grayLevelThreshold}
                />
              </g>
            );
          })()
        ) : (
          !isEditingBaseMap && (
            <NodeSvgImage
              src={baseMapImageUrl}
              dataNodeType="BASE_MAP"
              dataNodeId={baseMapImageUrl}
              width={baseMapImageSize?.width}
              height={baseMapImageSize?.height}
              hovered={baseMapIsHovered}
              selected={baseMapIsSelected}
              opacity={opacity}
              grayScale={grayScale}
              grayLevelThreshold={grayLevelThreshold}
            />
          )
        )}

        {visibleBaseMapAnnotations?.map((annotation) => {
          // A. Caché par le Drag topology (segment split) — toujours via hiddenAnnotationIds
          const isHiddenByDrag = hiddenAnnotationIds?.includes(annotation.id);

          // B. Caché par la Sélection Globale (EditedLayer mode Objet)
          // In anchor mode, the source stays visible (dimmed) in static layer
          const isAnchorSource = anchorSourceAnnotationId === annotation.id;
          const isSelectedGlobal =
            !isAnchorSource &&
            (selectedNode?.nodeId === annotation.id ||
              selectedNodes?.map((n) => n.nodeId)?.includes(annotation.id));

          // C. Caché par la Sélection de Point (EditedLayer mode Topologie)
          const isConnectedToPoint = idsAffectedBySelectedPoint.has(
            annotation.id
          );
          const hideDueToTopology = !selectedNode && isConnectedToPoint;

          if (isHiddenByDrag || isSelectedGlobal || hideDueToTopology) {
            return null;
          }

          // Optimistic overlay : rendre invisible (opacity:0) au lieu de démonter
          const hasPendingMove = !!getPendingMove(annotation.id);

          // Partial-revolution proxy: draw the sector (no handles when
          // not selected) instead of the full-ring polygon.
          const proxy2D = annotation.revolutionProxy2D;
          if (annotation.isProxy && proxy2D?.partial) {
            return (
              <g
                key={annotation.id}
                style={hasPendingMove ? { opacity: 0 } : undefined}
              >
                <NodeProxyRevolutionStatic
                  annotation={annotation}
                  center={proxy2D.center}
                  rOuter={proxy2D.rOuter}
                  rInner={proxy2D.rInner}
                  angleStart={proxy2D.angleStart}
                  angleEnd={proxy2D.angleEnd}
                  fillColor={annotation.fillColor}
                  selected={false}
                  containerK={basePose.k}
                  imageSize={baseMapImageSize}
                />
              </g>
            );
          }

          return (
            <g
              key={annotation.id}
              style={{
                ...(hasPendingMove && { opacity: 0 }),
                ...(isAnchorSource && { opacity: 0.3, filter: "grayscale(1)" }),
              }}
            >
              <NodeAnnotationStatic
                annotation={annotation}
                annotationOverride={labelOverridesById?.[annotation.id]}
                spriteImage={spriteImage}
                hovered={
                  !isAnchorSource && annotation.id === hoveredNode?.nodeId
                }
                selected={false}
                sizeVariant={sizeVariant}
                containerK={basePose.k}
                baseMapMeterByPx={baseMapMeterByPx}
                baseMapImageScale={baseMapImageScale}
                showBgImage={showBgImage}
                forceHideLabel={hiddenAnnotationIds?.includes(
                  "label::" + annotation.id
                )}
                selectMode={selectMode}
              />
            </g>
          );
        })}

        {/* maille group highlight when a maille is selected */}
        <MeshSelectionHighlight annotations={annotations} />

        {/* clipping plane segment (2D-defined cut plane) */}
        {clippingPlanEnabled &&
          clippingPlan?.pointA &&
          clippingPlan?.pointB &&
          clippingPlan?.baseMapId === selectedBaseMapId &&
          baseMapImageSize?.width > 0 && (
            <NodeClippingPlanStatic
              pointA={{
                x: clippingPlan.pointA.x * baseMapImageSize.width,
                y: clippingPlan.pointA.y * baseMapImageSize.height,
              }}
              pointB={{
                x: clippingPlan.pointB.x * baseMapImageSize.width,
                y: clippingPlan.pointB.y * baseMapImageSize.height,
              }}
              sign={clippingPlan.sign ?? 1}
              containerK={basePose.k}
              imageSize={baseMapImageSize}
              onSetSign={(s) => dispatch(setClippingPlanSign(s))}
              onDragEndpoint={(which, normPos) =>
                dispatch(
                  setClippingPlan({
                    [which]: normPos,
                    baseMapId: selectedBaseMapId,
                  })
                )
              }
            />
          )}
      </g>

      {/* --- LEGEND --- */}
      <g transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}>
        {legendItems && showBgImage && (
          <NodeLegendStatic
            selected={legendIsSelected}
            legendItems={legendItems}
            spriteImage={spriteImage}
            legendFormat={legendFormat}
            hovered={legendIsHovered}
            context="BG_IMAGE"
          />
        )}
      </g>
    </>
  );
}

export default memo(StaticMapContent);
