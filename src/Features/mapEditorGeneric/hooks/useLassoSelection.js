// Features/interactions/hooks/useLassoSelection.js
import { useState, useRef, useCallback } from 'react';
import getAnnotationVertices from 'Features/annotations/utils/getAnnotationVertices';

// Below this screen-pixel movement the gesture is a click, not a lasso drag.
// Kept a hair above the viewport's pan threshold (3px) so any drag too small
// to pan is also treated as a click.
const LASSO_MOVE_THRESHOLD = 4;

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
    // Returns { committed }. committed === false means the gesture was a click
    // (movement below threshold): the caller should fall back to click handling
    // instead of mutating the selection.
    const endLasso = useCallback(() => {
        if (!startScreenPosRef.current || !lassoRect) return { committed: false };

        // Click vs drag: a sub-threshold rectangle is a click, not a lasso.
        const moved =
            lassoRect.width > LASSO_MOVE_THRESHOLD ||
            lassoRect.height > LASSO_MOVE_THRESHOLD;
        if (!moved) {
            startScreenPosRef.current = null;
            setLassoRect(null);
            return { committed: false };
        }

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

        // B. Hit test based on annotation vertices: an annotation is selected
        // only if at least one of its vertices falls inside the lasso rectangle.
        // This avoids selecting a large concave shape when the lasso is drawn in
        // its "encoche" (notch), where the bbox would still intersect.
        const inBox = (pt) =>
            pt &&
            pt.x >= selectionBox.x &&
            pt.x <= selectionBox.x + selectionBox.width &&
            pt.y >= selectionBox.y &&
            pt.y <= selectionBox.y + selectionBox.height;

        const hitIds = [];

        annotations.forEach(ann => {
            const verts = getAnnotationVertices(ann);
            if (verts.some(inBox)) {
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

        return { committed: true };

    }, [lassoRect, annotations, viewportRef, toLocalCoords, onSelectionComplete]);

    return {
        lassoRect,
        startLasso,
        updateLasso,
        endLasso
    };
}