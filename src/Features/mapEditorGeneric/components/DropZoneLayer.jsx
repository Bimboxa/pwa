// Features/mapEditorGeneric/components/DropZoneLayer.jsx
import { useDroppable, useDndMonitor } from '@dnd-kit/core';
import { Box } from '@mui/material';

const DropZoneLayer = ({
    viewportRef,
    toLocalCoords,
    onDrop,
    baseMapImageSize,
}) => {

    const { setNodeRef, isOver } = useDroppable({
        id: 'map-editor-drop-zone',
    });

    useDndMonitor({
        onDragEnd(event) {
            const { active, over, delta } = event; // 1. On récupère le DELTA

            if (over && over.id === 'map-editor-drop-zone') {
                if (active.data.current?.type === 'EXTERNAL_IMAGE') {
                    const imageUrl = active.data.current.imageUrl;
                    const idMaster = active.data.current.idMaster;

                    // 2. On récupère le point de départ
                    const { clientX: startX, clientY: startY } = event.activatorEvent;

                    // 3. Calcul de la position de DROP réelle (Client Coordinates)
                    // C'est ici que se situait l'erreur
                    const dropClientX = startX + delta.x;
                    const dropClientY = startY + delta.y;

                    if (Number.isFinite(dropClientX) && Number.isFinite(dropClientY)) {

                        // 4. Conversion en coordonnées Monde
                        // screenToWorld attend bien des coordonnées "Client" (0,0 en haut à gauche fenêtre)
                        const worldPos = viewportRef.current?.screenToWorld(dropClientX, dropClientY);

                        if (worldPos) {
                            const localPos = toLocalCoords(worldPos);

                            onDrop({
                                imageUrl,
                                idMaster,
                                x: localPos.x,
                                y: localPos.y,
                            });
                        }
                    }
                }
            }
        },
    });

    return (
        <Box
            ref={setNodeRef}
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                pointerEvents: 'none',
                border: isOver ? '1px dashed #2196f3' : 'none',
            }}
        />
    );
};

export default DropZoneLayer;