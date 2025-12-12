import { memo } from "react";

import { useSelector } from "react-redux";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

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
    annotations,
    legendItems,
    legendFormat,
    selectedNode,
    sizeVariant,
    isEditingBaseMap = false
}) {

    // data

    const { hoveredNode, hiddenAnnotationIds } = useInteraction();
    const spriteImage = useAnnotationSpriteImage();
    const _showedFWC = useSelector(s => s.fwc.showedFWC);

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
    const baseMapAnnotations = annotations.filter(({ baseMapId, entity }) =>
        Boolean(baseMapId) &&
        (showedFWC.includes(entity?.fwc) || !fwcEnabled || (!entity?.fwc && showedFWC.length === activeFWC.length))
    );


    return (
        <>
            {/* --- BG LAYER  --- */}
            <g transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}>
                {showBgImage && <NodeSvgImage
                    src={bgImageUrl}
                    dataNodeType="BG_IMAGE"
                    dataNodeId={bgImageUrl}
                    width={bgImageSize?.width}
                    height={bgImageSize?.height} />}

                {bgImageAnnotations.map((annotation) => (
                    <NodeAnnotationStatic
                        key={annotation.id}
                        annotation={annotation}
                        spriteImage={spriteImage}
                        imageSize={bgImageSize}
                        hovered={annotation.id === hoveredNode?.nodeId}
                        selected={annotation.id === selectedNode?.id}
                        sizeVariant={sizeVariant}
                        containerK={bgPose.k}
                        baseMapMeterByPx={baseMapMeterByPx}
                    />
                ))}
            </g>

            {/* --- BASE MAP LAYER --- */}
            <g transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`} style={{ pointerEvents: 'auto' }}>
                {!isEditingBaseMap && <NodeSvgImage
                    src={baseMapImageUrl}
                    dataNodeType="BASE_MAP"
                    dataNodeId={baseMapImageUrl}
                    width={baseMapImageSize?.width}
                    height={baseMapImageSize?.height}
                    hovered={baseMapIsHovered}
                    selected={baseMapIsSelected}
                />}

                {baseMapAnnotations?.map(annotation => {

                    if (hiddenAnnotationIds?.includes(annotation.id)) {
                        return null;
                    }

                    return <NodeAnnotationStatic
                        key={annotation.id}
                        annotation={annotation}
                        spriteImage={spriteImage}
                        hovered={annotation.id === hoveredNode?.nodeId}
                        selected={annotation.id === selectedNode?.id}
                        sizeVariant={sizeVariant}
                        containerK={basePose.k}
                        baseMapMeterByPx={baseMapMeterByPx}
                        showBgImage={showBgImage}
                    />
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
                    />
                )}
            </g>
        </>
    );
}

export default memo(StaticMapContent);