import { memo } from "react";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodePolylineStatic from "Features/mapEditorGeneric/components/NodePolylineStatic";

import { useInteraction } from "Features/mapEditor/context/InteractionContext";

function StaticMapContent({
    bgImageUrl,
    bgImageSize,
    showBgImage,
    bgPose = { x: 0, y: 0, k: 1 },
    basePose,
    baseMapImageUrl,
    baseMapImageSize,
    annotations,
    selectedNode,
}) {


    // data

    const { hoveredNode, hiddenAnnotationIds } = useInteraction();

    // helpers

    const baseMapIsHovered = showBgImage && hoveredNode?.nodeType === "BASE_MAP";
    const baseMapIsSelected = showBgImage && selectedNode?.nodeType === "BASE_MAP";

    return (
        <>
            {/* --- BG LAYER --- */}
            <g transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}>
                {showBgImage && <NodeSvgImage
                    src={bgImageUrl}
                    dataNodeType="BG_IMAGE"
                    dataNodeId={bgImageUrl}
                    width={bgImageSize?.width}
                    height={bgImageSize?.height} />}
            </g>

            {/* --- BASE MAP LAYER --- */}
            <g transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}>
                <NodeSvgImage
                    src={baseMapImageUrl}
                    dataNodeType="BASE_MAP"
                    dataNodeId={baseMapImageUrl}
                    width={baseMapImageSize?.width}
                    height={baseMapImageSize?.height}
                    hovered={baseMapIsHovered}
                    selected={baseMapIsSelected}
                />

                {annotations?.map(annotation => {

                    if (hiddenAnnotationIds?.includes(annotation.id)) {
                        return null;
                    }

                    if (annotation.type === "POLYLINE" || annotation.type === "POLYGON") {
                        return <NodePolylineStatic
                            key={annotation.id}
                            annotation={annotation}
                            hovered={annotation.id === hoveredNode?.nodeId}
                            selected={annotation.id === selectedNode?.id}
                        />
                    }
                })}




            </g>
        </>
    );
}

export default memo(StaticMapContent);