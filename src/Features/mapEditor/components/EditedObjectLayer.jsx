import { useMemo } from 'react';
import { useInteraction } from "Features/mapEditor/context/InteractionContext";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import theme from 'Styles/theme';

export default function EditedObjectLayer({
    basePose,
    annotations,
    spriteImage,
    selectedNode,
    baseMapMeterByPx,
    onTextValueChange,
}) {

    const { draggingAnnotationId, selectedPointId, hiddenAnnotationIds } = useInteraction();

    // 1. Identifier TOUTES les annotations concernées
    const activeAnnotations = useMemo(() => {
        if (!annotations) return [];

        // Cas A : Une annotation est explicitement sélectionnée (Click sur la forme)
        // Dans ce cas, on ne veut voir que celle-ci, même si elle partage des points
        if (selectedNode) {
            let target;
            if (selectedNode.nodeId?.startsWith("label::")) {
                const annotationId = selectedNode.nodeId.replace("label::", "");
                const found = annotations.find(a => a.id === annotationId);
                target = getAnnotationLabelPropsFromAnnotation(found);
            } else {
                target = annotations.find(a => a.id === selectedNode.nodeId);
            }
            return target ? [target] : [];
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
    }, [selectedNode, annotations, selectedPointId]);


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
    }, [selectedNode, activeAnnotations]);

    const finalPose = isBgContext ? { x: 0, y: 0, k: 1 } : basePose;

    // Si on drag une annotation entière, on ne l'affiche pas ici (géré par Transient)
    // On filtre celles qui sont en cours de drag
    const annotationsToRender = activeAnnotations.filter(a => a.id !== draggingAnnotationId && !hiddenAnnotationIds.includes(a.id));

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
                const isNodeSelected = selectedNode?.nodeId === annotation.id;

                // Est-ce qu'on est en mode "Point Seulement" ?
                const isPointSelectionMode = !isNodeSelected && !!selectedPointId;

                let overrideStyle = {};

                if (isNodeSelected) {
                    // MODE CLASSIQUE : Tout est sélectionné
                    const addFillColor = annotation.type !== "TEXT";
                    overrideStyle = {
                        strokeColor: theme.palette.annotation.selected,
                        strokeWidth: (annotation.strokeWidth || 0) + 1,
                        ...(addFillColor ? { fillColor: theme.palette.annotation.selected } : {}),
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

                return (
                    <g
                        key={annotation.id}
                        data-interaction={isDraggable ? "draggable" : undefined}
                        data-node-id={annotation.id}
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
                            highlightConnectedSegments={isPointSelectionMode}
                        />
                    </g>
                );
            })}
        </g>
    );
}