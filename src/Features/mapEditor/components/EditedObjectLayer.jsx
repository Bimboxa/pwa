import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useInteraction } from "Features/mapEditor/context/InteractionContext";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import theme from 'Styles/theme';
import { selectSelectedItems, selectSelectedPointId, selectSelectedPartId } from "Features/selection/selectionSlice";
import useSelectedNodes from '../hooks/useSelectedNodes';

export default function EditedObjectLayer({
    basePose,
    annotations,
    spriteImage,
    // selectedNode, // Ignored
    // selectedNodes, // Ignored
    baseMapMeterByPx,
    onTextValueChange,
}) {

    // Redux State
    const selectedItems = useSelector(selectSelectedItems);
    const selectedPointId = useSelector(selectSelectedPointId);
    const selectedPartId = useSelector(selectSelectedPartId);

    // Compat with existing logic
    const { node: selectedNode, nodes: selectedNodes } = useSelectedNodes();

    const { hiddenAnnotationIds, getPendingMove, pendingMovesVersion } = useInteraction();

    // 1. Identifier TOUTES les annotations concernées
    const activeAnnotations = useMemo(() => {
        if (!annotations) return [];

        // Cas A : Une annotation est explicitement sélectionnée (Click sur la forme)
        // Dans ce cas, on ne veut voir que celle-ci, même si elle partage des points
        if (selectedNode || selectedNodes?.length > 0) {
            let target = [];
            if (selectedNode && selectedNode.nodeId?.startsWith("label::")) {
                const annotationId = selectedNode.nodeId.replace("label::", "");
                const found = annotations.find(a => a.id === annotationId);
                target = [getAnnotationLabelPropsFromAnnotation(found)];
            } else {
                target = annotations.filter(a => a.id === selectedNode?.nodeId || selectedNodes?.map(n => n.nodeId)?.includes(a.id));
            }
            return target;
        }

        // Cas B : Sélection par Point (Click sur un sommet)
        // On veut TOUTES les annotations qui partagent ce point
        if (selectedPointId) {
            return annotations.filter(ann => {
                // Vérifier Main path
                if (ann.points?.some(pt => pt.id === selectedPointId)) return true;
                // Vérifier Cuts (trous)
                if (ann.cuts?.some(cut => cut.points?.some(pt => pt.id === selectedPointId))) return true;
                return false;
            });
        }

        return [];
    }, [selectedNode?.nodeId, annotations, selectedPointId]);


    // 2. Gestion de la Pose (On prend celle du premier élément trouvé ou défaut)
    // Note : On suppose ici que des annotations connectées partagent le même contexte (Map ou BgImage)
    const isBgContext = useMemo(() => {
        if (selectedNode) return selectedNode.nodeContext === "BG_IMAGE";
        if (activeAnnotations.length > 0) {
            // On regarde la première annotation trouvée pour déduire le contexte
            // (Ajoutez une logique plus robuste si vous mixez des contextes)
            return false;
        }
        return false;
    }, [selectedNode?.nodeId, activeAnnotations?.length]);

    console.log("isBgContext", isBgContext, selectedNode)

    const finalPose = isBgContext ? { x: 0, y: 0, k: 1 } : basePose;

    // On filtre celles qui sont cachées (topology/segment split)
    const annotationsToRender = activeAnnotations.filter(a => !hiddenAnnotationIds.includes(a.id));

    if (annotationsToRender.length === 0) return null;

    return (
        <g
            className="edited-layer"
            style={{ pointerEvents: 'auto' }}
            transform={`translate(${finalPose.x}, ${finalPose.y}) scale(${finalPose.k})`}
        >
            {annotationsToRender.map(annotation => {

                // Style spécifique pour chaque annotation
                const isDraggable = (annotation.type === "MARKER" || annotation.type === "LABEL") && selectedNode?.nodeId === annotation.id;

                // Est-ce que l'annotation entière est sélectionnée ?
                const isNodeSelected = selectedNode?.nodeId === annotation.id || selectedNodes?.map(n => n.nodeId)?.includes(annotation.id);

                // Est-ce qu'on est en mode "Point Seulement" ?
                const isPointSelectionMode = !isNodeSelected && !!selectedPointId;

                let overrideStyle = {};

                if (isNodeSelected) {
                    // MODE CLASSIQUE : Tout est sélectionné
                    const addFillColor = annotation.type !== "TEXT";
                    overrideStyle = {
                        //strokeColor: theme.palette.annotation.selected,
                        //strokeWidth: (annotation.strokeWidth || 0) + 1,
                        //...(addFillColor ? { fillColor: theme.palette.annotation.selected } : {}),
                        //fillOpacity: 0.5
                    };
                } else if (isPointSelectionMode) {
                    // MODE POINT SEUL : On ne change PAS le style global
                    // On laisse l'apparence "normale" (celle du StaticMapContent en dessous)
                    // Mais on va dire au composant de dessiner les traits connectés
                    // Optionnel : On peut vouloir cacher le fill normal pour ne pas le doubler avec le calque du dessous
                    // overrideStyle = { fillOpacity: 0, strokeOpacity: 0 }; 
                    // Mais le plus simple est de ne rien passer et laisser NodePolyline gérer
                }

                // Optimistic overlay : rendre invisible pendant le drag
                const hasPendingMove = !!getPendingMove(annotation.id);

                return (
                    <g
                        key={annotation.id}
                        data-interaction={isDraggable ? "draggable" : undefined}
                        data-node-id={annotation.id}
                        style={hasPendingMove ? { opacity: 0 } : undefined}
                    >
                        <NodeAnnotationStatic
                            annotation={annotation}
                            annotationOverride={overrideStyle}
                            spriteImage={spriteImage}
                            baseMapMeterByPx={baseMapMeterByPx}

                            // On active le mode "selected" pour voir les vertices
                            selected={isNodeSelected}

                            sizeVariant="FIXED_IN_SCREEN"
                            containerK={finalPose.k}
                            onTextValueChange={onTextValueChange}

                            // Le point rouge s'affichera sur toutes les annotations qui le contiennent
                            // (Elles vont se superposer au niveau du point rouge, ce qui est visuellement correct)
                            selectedPointId={selectedPointId}
                            selectedPartId={selectedPartId}
                            highlightConnectedSegments={isPointSelectionMode}
                        />
                    </g>
                );
            })}
        </g>
    );
}