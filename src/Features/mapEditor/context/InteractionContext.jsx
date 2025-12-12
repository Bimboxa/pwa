import React, { createContext, useContext, useState, useMemo } from 'react';

const InteractionContext = createContext(null);

export function InteractionProvider({ children }) {
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hiddenAnnotationIds, setHiddenAnnotationIds] = useState([]); // <= pour masquer les annotations en cours de modification
    const [draggingAnnotationId, setDraggingAnnotationId] = useState(null);
    const [basePose, setBasePose] = useState(null);

    // On peut ajouter d'autres états UI volatiles ici (ex: coordonnées curseur écran)
    // const [cursorPos, setCursorPos] = useState({x:0, y:0});

    const value = useMemo(() => ({
        hoveredNode,
        setHoveredNode,
        hiddenAnnotationIds,
        setHiddenAnnotationIds,
        draggingAnnotationId,
        setDraggingAnnotationId,
        basePose,
        setBasePose,
    }), [hoveredNode, hiddenAnnotationIds, draggingAnnotationId, basePose]);

    return (
        <InteractionContext.Provider value={value}>
            {children}
        </InteractionContext.Provider>
    );
}

export const useInteraction = () => useContext(InteractionContext);