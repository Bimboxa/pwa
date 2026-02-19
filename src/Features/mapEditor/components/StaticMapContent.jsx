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
    baseMapImageEnhancedUrl,
    baseMapShowEnhanced,
    baseMapImageSize,
    baseMapMeterByPx,
    annotations,
    legendItems,
    legendFormat,
    // selectedNode, // Ignored, using Redux
    // selectedNodes, // Ignored
    sizeVariant,
    isEditingBaseMap = false,
    opacity = 1,
    opacityEnhanced = 1,
    grayScale = false,
    grayLevelThreshold = 0
}) {

    // data

    // [MODIF 1] Récupérer selectedPointId via Redux
    const { hoveredNode, hiddenAnnotationIds } = useInteraction();
    const selectedPointId = useSelector(selectSelectedPointId);
    const selectedItems = useSelector(selectSelectedItems);
    // Derive selectedNode/selectedNodes from new slice for compatibility
    const { node: selectedNode, nodes: selectedNodes } = useSelectedNodes();

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

                    return <NodeAnnotationStatic
                        key={annotation.id}
                        annotation={annotation}
                        spriteImage={spriteImage}
                        imageSize={bgImageSize}
                        hovered={annotation.id === hoveredNode?.nodeId}
                        selected={false} // Toujours false car c'est le statique
                        sizeVariant={sizeVariant}
                        containerK={bgPose.k}
                        baseMapMeterByPx={baseMapMeterByPx}
                        context="BG_IMAGE"
                        forceHideLabel={hiddenAnnotationIds?.includes("label::" + annotation.id)}
                    />
                })}
            </g>

            {/* --- BASE MAP LAYER --- */}
            <g transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`} style={{ pointerEvents: 'auto' }}>


                {baseMapShowEnhanced && <NodeSvgImage
                    src={baseMapImageEnhancedUrl}
                    //dataNodeType="BASE_MAP"
                    dataNodeId={baseMapImageEnhancedUrl}
                    width={baseMapImageSize?.width}
                    height={baseMapImageSize?.height}
                    //hovered={baseMapIsHovered}
                    //selected={baseMapIsSelected}
                    opacity={opacity}
                    grayScale={grayScale}
                    grayLevelThreshold={grayLevelThreshold}
                />}

                {!isEditingBaseMap && <NodeSvgImage
                    src={baseMapImageUrl}
                    dataNodeType="BASE_MAP"
                    dataNodeId={baseMapImageUrl}
                    width={baseMapImageSize?.width}
                    height={baseMapImageSize?.height}
                    hovered={baseMapIsHovered}
                    selected={baseMapIsSelected}
                    opacity={baseMapShowEnhanced ? opacityEnhanced * opacity : opacity}
                    grayScale={grayScale}
                    grayLevelThreshold={grayLevelThreshold}
                />}

                {baseMapAnnotations?.map(annotation => {

                    // [MODIF 3] Logique de masquage avancée pour éviter les doublons avec EditedLayer

                    // A. Caché par le Drag (TransientLayer)
                    const isHiddenByDrag = hiddenAnnotationIds?.includes(annotation.id);

                    // B. Caché par la Sélection Globale (EditedLayer mode Objet)
                    const isSelectedGlobal = selectedNode?.nodeId === annotation.id || selectedNodes?.map(n => n.nodeId)?.includes(annotation.id);

                    // C. Caché par la Sélection de Point (EditedLayer mode Topologie)
                    // On ne cache les voisins QUE si on n'a PAS de sélection globale.
                    // Si on a une sélection globale, les voisins restent statiques.
                    const isConnectedToPoint = idsAffectedBySelectedPoint.has(annotation.id);
                    const hideDueToTopology = !selectedNode && isConnectedToPoint;

                    if (isHiddenByDrag || isSelectedGlobal || hideDueToTopology) {
                        return null;
                    }

                    return <NodeAnnotationStatic
                        key={annotation.id}
                        annotation={annotation}
                        spriteImage={spriteImage}
                        hovered={annotation.id === hoveredNode?.nodeId}
                        // selected est toujours false ici, car si c'était true, on aurait return null au-dessus
                        selected={false}
                        sizeVariant={sizeVariant}
                        containerK={basePose.k}
                        baseMapMeterByPx={baseMapMeterByPx}
                        showBgImage={showBgImage}
                        forceHideLabel={hiddenAnnotationIds?.includes("label::" + annotation.id)}
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
                        context="BG_IMAGE"
                    />
                )}
            </g>
        </>
    );
}

export default memo(StaticMapContent);