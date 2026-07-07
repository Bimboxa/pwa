import React, { createContext, useContext, useState, useMemo, useRef, useCallback } from 'react';

const InteractionContext = createContext(null);

export function InteractionProvider({ children }) {
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hiddenAnnotationIds, setHiddenAnnotationIds] = useState([]); // <= pour masquer les annotations en cours de modification (topology/segment split)
    const [basePose, setBasePose] = useState(null);
    const [selectedPointId, setSelectedPointId] = useState(null);
    const [selectedPartId, setSelectedPartId] = useState(null);

    // Pending moves — optimistic overlay pour le drag d'annotations
    // La Map est mutée directement pendant le mousemove (pas de re-render à 60fps)
    // pendingMovesVersion est incrémenté au start et au clear pour déclencher les re-renders
    const pendingMovesRef = useRef(new Map()); // Map<annotationId, { deltaPos, partType }>
    const [pendingMovesVersion, setPendingMovesVersion] = useState(0);

    const getPendingMove = useCallback((annotationId) => {
        return pendingMovesRef.current.get(annotationId) || null;
    }, []);

    // Visible view box (base-map local px, with margin) used by
    // StaticMapContent to cull off-screen annotations. Updated by
    // InteractionLayer on camera changes (debounced + hysteresis).
    // null → no culling (first render / unknown viewport).
    const [visibleViewBox, setVisibleViewBox] = useState(null);

    const value = useMemo(() => ({
        hoveredNode,
        setHoveredNode,
        hiddenAnnotationIds,
        setHiddenAnnotationIds,
        basePose,
        setBasePose,
        selectedPointId,
        setSelectedPointId,
        selectedPartId,
        setSelectedPartId,
        // Pending moves
        pendingMovesRef,
        pendingMovesVersion,
        setPendingMovesVersion,
        getPendingMove,
        // Viewport culling
        visibleViewBox,
        setVisibleViewBox,
    }), [hoveredNode, hiddenAnnotationIds, basePose, selectedPointId, selectedPartId, pendingMovesVersion, visibleViewBox]);

    return (
        <InteractionContext.Provider value={value}>
            {children}
        </InteractionContext.Provider>
    );
}

export const useInteraction = () => useContext(InteractionContext);
