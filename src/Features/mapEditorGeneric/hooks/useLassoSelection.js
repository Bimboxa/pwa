// Features/interactions/hooks/useLassoSelection.js
import { useState, useRef, useCallback } from 'react';
import getAnnotationBBox from 'Features/annotations/utils/getAnnotationBbox';

export default function useLassoSelection({
    annotations,
    viewportRef,
    toLocalCoords,   // Fonction de conversion (Screen -> Local) passée par InteractionLayer
    onSelectionComplete // Callback qui reçoit les IDs sélectionnés (ex: (ids) => dispatch(...))
}) {
    // État visuel du rectangle (en pixels ÉCRAN pour l'affichage CSS)
    const [lassoRect, setLassoRect] = useState(null);

    // Refs pour le calcul
    const startScreenPosRef = useRef(null);

    // --- 1. START (MouseDown) ---
    const startLasso = useCallback((e) => {
        // Condition d'activation : SHIFT enfoncé + Clic Gauche
        if (e.shiftKey && e.button === 0) {
            startScreenPosRef.current = { x: e.clientX, y: e.clientY };
            setLassoRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
            return true; // "J'ai pris la main"
        }
        return false;
    }, []);

    // --- 2. UPDATE (MouseMove) ---
    const updateLasso = useCallback((e) => {
        if (!startScreenPosRef.current) return;

        const startX = startScreenPosRef.current.x;
        const startY = startScreenPosRef.current.y;
        const currentX = e.clientX;
        const currentY = e.clientY;

        // On calcule un rectangle toujours positif (X,Y = TopLeft)
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        setLassoRect({ x, y, width, height });
    }, []);

    // --- 3. END (MouseUp) ---
    const endLasso = useCallback(() => {
        if (!startScreenPosRef.current || !lassoRect) return;

        // A. Convertir le rectangle ÉCRAN en rectangle LOCAL (BaseMap)
        // On projette les deux coins opposés
        const p1_world = viewportRef.current.screenToWorld(lassoRect.x, lassoRect.y);
        const p2_world = viewportRef.current.screenToWorld(lassoRect.x + lassoRect.width, lassoRect.y + lassoRect.height);

        const p1_local = toLocalCoords(p1_world);
        const p2_local = toLocalCoords(p2_world);

        // Rectangle de sélection en coordonnées locales
        const selectionBox = {
            x: Math.min(p1_local.x, p2_local.x),
            y: Math.min(p1_local.y, p2_local.y),
            width: Math.abs(p2_local.x - p1_local.x),
            height: Math.abs(p2_local.y - p1_local.y)
        };

        // B. Trouver les intersections (Hit Test)
        const hitIds = [];

        annotations.forEach(ann => {
            const annBBox = getAnnotationBBox(ann);

            if (!annBBox) return;

            // Test simple d'intersection de rectangles (AABB)
            const isIntersecting = (
                selectionBox.x < annBBox.x + annBBox.width &&
                selectionBox.x + selectionBox.width > annBBox.x &&
                selectionBox.y < annBBox.y + annBBox.height &&
                selectionBox.y + selectionBox.height > annBBox.y
            );

            if (isIntersecting) {
                hitIds.push(ann.id);
            }
        });

        // C. Commit
        if (onSelectionComplete) {
            onSelectionComplete({ annotationIds: hitIds, selectionBox, anchorPosition: { x: lassoRect.x, y: lassoRect.y } });
        }

        // Reset
        startScreenPosRef.current = null;
        setLassoRect(null);

    }, [lassoRect, annotations, viewportRef, toLocalCoords, onSelectionComplete]);

    return {
        lassoRect,
        startLasso,
        updateLasso,
        endLasso
    };
}