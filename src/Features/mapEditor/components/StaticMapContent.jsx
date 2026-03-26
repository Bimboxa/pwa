import { memo, useMemo } from "react"; // Assurez-vous d'avoir useMemo

import { useSelector } from "react-redux";
import { selectSelectedPointId, selectSelectedItems } from "Features/selection/selectionSlice";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useSelectedNodes from "Features/mapEditor/hooks/useSelectedNodes";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import NodeLegendStatic from "Features/mapEditorGeneric/components/NodeLegendStatic";

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
    const { hoveredNode, hiddenAnnotationIds, getPendingMove, pendingMovesVersion } = useInteraction();
    const selectedPointId = useSelector(selectSelectedPointId);
    const selectedItems = useSelector(selectSelectedItems);
    // Derive selectedNode/selectedNodes from new slice for compatibility
    const { node: selectedNode, nodes: selectedNodes } = useSelectedNodes();

    const spriteImage = useAnnotationSpriteImage();
    const _showedFWC = useSelector(s => s.fwc.showedFWC);
    const anchorSourceAnnotationId = useSelector(s => s.mapEditor.anchorSourceAnnotationId);

    // Derive selectMode from the active drawing tool
    const enabledDrawingMode = useSelector(s => s.mapEditor.enabledDrawingMode);
    const selectMode = useMemo(() => {
        if (["TECHNICAL_RETURN", "CUT_SEGMENT"].includes(enabledDrawingMode)) return "SEGMENT";
        // Future: add "VERTEX" for point-selection modes
        return null;
    }, [enabledDrawingMode]);

    // helpers

    const fwcCountMap = annotations.reduce((acc, { entity }) => {
        if (entity?.fwc) {
            acc[entity.fwc] = (acc[entity.fwc] || 0) + 1;
        }
        return acc;
    }, {});
    const activeFWC = Object.keys(fwcCountMap).filter(fwc => fwcCountMap[fwc] > 0);
    const showedFWC = _showedFWC.filter(fwc => fwcCountMap[fwc] > 0);
    const fwcEnabled = annotations.filter(({ entity }) => Boolean(entity?.fwc)).length > 0;

    // helpers

    const baseMapIsHovered = showBgImage && hoveredNode?.nodeType === "BASE_MAP";
    const baseMapIsSelected = showBgImage && selectedNode?.nodeType === "BASE_MAP";
    const legendIsHovered = showBgImage && hoveredNode?.nodeType === "LEGEND";
    const legendIsSelected = showBgImage && selectedNode?.nodeType === "LEGEND";

    // helpers - annotations

    const bgImageAnnotations = showBgImage
        ? annotations.filter(({ nodeType }) => nodeType === "BG_IMAGE_TEXT")
        : [];
    const baseMapAnnotations = annotations.filter(({ baseMapId, entity, hidden }) =>
        Boolean(baseMapId) &&
        !hidden &&
        (showedFWC.includes(entity?.fwc) || !fwcEnabled || (!entity?.fwc && showedFWC.length === activeFWC.length))
    );

    // [MODIF 2] Calculer les annotations touchées par le point sélectionné (Topologie)
    const idsAffectedBySelectedPoint = useMemo(() => {
        if (!selectedPointId) return new Set();
        const affectedIds = new Set();

        // On cherche dans TOUTES les annotations, pas seulement les filtrées
        annotations.forEach(ann => {
            const inMain = ann.points?.some(pt => pt.id === selectedPointId);
            const inCuts = ann.cuts?.some(cut => cut.points?.some(pt => pt.id === selectedPointId));

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
                {showBgImage && <NodeSvgImage
                    src={bgImageUrl}
                    dataNodeType="BG_IMAGE"
                    dataNodeId={bgImageUrl}
                    width={bgImageSize?.width}
                    height={bgImageSize?.height}
                />}

                {bgImageAnnotations.map((annotation) => {
                    // Pour le texte BG, on garde la logique simple (ou on adapte si besoin)
                    if (hiddenAnnotationIds?.includes(annotation.id)) return null;
                    if (selectedNode?.nodeId === annotation.id) return null; // Masquer si édité

                    // Optimistic overlay : rendre invisible (opacity:0) au lieu de démonter
                    const hasPendingMove = !!getPendingMove(annotation.id);

                    return <g key={annotation.id} style={hasPendingMove ? { opacity: 0 } : undefined}>
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
                            forceHideLabel={hiddenAnnotationIds?.includes("label::" + annotation.id)}
                        />
                    </g>
                })}
            </g>

            {/* --- BASE MAP LAYER --- */}
            <g transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`} style={{ pointerEvents: 'auto' }}>


                {/* Multi-version rendering for BASE_MAPS viewer */}
                {isBaseMapsViewer && versions?.length > 0 ? (
                    <>
                        {/* SVG clipPath definition for version compare */}
                        {versionCompareEnabled && versionCompareId && (
                            <defs>
                                <clipPath id="version-compare-clip">
                                    <rect id="version-compare-clip-rect" x={0} y={0} width={0} height={0} />
                                </clipPath>
                            </defs>
                        )}

                        {/* Compare mode: render compared version (bottom, full) then active (top, clipped) */}
                        {versionCompareEnabled && versionCompareId && (() => {
                            const comparedVersion = versions.find(v => v.id === versionCompareId);
                            const activeVersion = versions.find(v => v.isActive) || versions[0];
                            if (!comparedVersion || !activeVersion) return null;

                            const cUrl = comparedVersion.image?.imageUrlClient ?? comparedVersion.image?.imageUrlRemote;
                            const cSize = comparedVersion.image?.imageSize;
                            const cT = comparedVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };

                            const aUrl = activeVersion.image?.imageUrlClient ?? activeVersion.image?.imageUrlRemote;
                            const aSize = activeVersion.image?.imageSize;
                            const aT = activeVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };

                            return (
                                <>
                                    {/* Compared version — bottom, full, no clip */}
                                    {cUrl && cSize && (
                                        <g transform={`translate(${cT.x}, ${cT.y}) scale(${cT.scale}) rotate(${cT.rotation || 0})`}>
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
                                            <rect x={-99999} y={-99999} width={199998} height={199998} fill="white" />
                                            <g transform={`translate(${aT.x}, ${aT.y}) scale(${aT.scale}) rotate(${aT.rotation || 0})`}>
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
                        {!versionCompareEnabled && versions
                            .filter(v => !hiddenVersionIds?.includes(v.id))
                            .sort((a, b) => (b.fractionalIndex || "").localeCompare(a.fractionalIndex || ""))
                            .map(version => {
                                if (isEditingVersion && selectedVersionId === version.id) return null;
                                const vUrl = version.image?.imageUrlClient ?? version.image?.imageUrlRemote;
                                const vSize = version.image?.imageSize;
                                if (!vUrl || !vSize) return null;
                                const t = version.transform || { x: 0, y: 0, rotation: 0, scale: 1 };
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
                        const activeVersion = versions.find(v => v.isActive) || versions[0];
                        if (!activeVersion || isEditingBaseMap) return null;
                        const vUrl = activeVersion.image?.imageUrlClient ?? activeVersion.image?.imageUrlRemote;
                        const vSize = activeVersion.image?.imageSize;
                        if (!vUrl || !vSize) return null;
                        const t = activeVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };
                        return (
                            <g transform={`translate(${t.x}, ${t.y}) scale(${t.scale}) rotate(${t.rotation || 0})`}>
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
                    !isEditingBaseMap && <NodeSvgImage
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
                )}

                {baseMapAnnotations?.map(annotation => {

                    // A. Caché par le Drag topology (segment split) — toujours via hiddenAnnotationIds
                    const isHiddenByDrag = hiddenAnnotationIds?.includes(annotation.id);

                    // B. Caché par la Sélection Globale (EditedLayer mode Objet)
                    // In anchor mode, the source stays visible (dimmed) in static layer
                    const isAnchorSource = anchorSourceAnnotationId === annotation.id;
                    const isSelectedGlobal = !isAnchorSource && (selectedNode?.nodeId === annotation.id || selectedNodes?.map(n => n.nodeId)?.includes(annotation.id));

                    // C. Caché par la Sélection de Point (EditedLayer mode Topologie)
                    const isConnectedToPoint = idsAffectedBySelectedPoint.has(annotation.id);
                    const hideDueToTopology = !selectedNode && isConnectedToPoint;

                    if (isHiddenByDrag || isSelectedGlobal || hideDueToTopology) {
                        return null;
                    }

                    // Optimistic overlay : rendre invisible (opacity:0) au lieu de démonter
                    const hasPendingMove = !!getPendingMove(annotation.id);

                    return <g
                        key={annotation.id}
                        style={{
                            ...(hasPendingMove && { opacity: 0 }),
                            ...(isAnchorSource && { opacity: 0.3, filter: "grayscale(1)" }),
                        }}
                    >
                        <NodeAnnotationStatic
                            annotation={annotation}
                            spriteImage={spriteImage}
                            hovered={!isAnchorSource && annotation.id === hoveredNode?.nodeId}
                            selected={false}
                            sizeVariant={sizeVariant}
                            containerK={basePose.k}
                            baseMapMeterByPx={baseMapMeterByPx}
                            baseMapImageScale={baseMapImageScale}
                            showBgImage={showBgImage}
                            forceHideLabel={hiddenAnnotationIds?.includes("label::" + annotation.id)}
                            selectMode={selectMode}
                        />
                    </g>
                })}

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