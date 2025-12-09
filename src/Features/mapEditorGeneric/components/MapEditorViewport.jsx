// components/MapEditorViewport.jsx
import { useRef, useImperativeHandle, forwardRef, useCallback, useLayoutEffect } from 'react';
import screenToWorld from '../utils/screenToWorld';

// Zoom sensitivity constant (same as MapEditorGeneric.jsx)
const ZOOM_SENSITIVITY = 1.0015;

const MapEditorViewport = forwardRef(({ children, onWorldMouseMove, onWorldClick, onCameraChange, staticOverlay, htmlOverlay }, ref) => {
    const svgRef = useRef(null);
    const cameraGroupRef = useRef(null);

    // 1. ÉTAT DE LA CAMÉRA (Stocké dans une Ref pour la performance)
    const cameraMatrix = useRef({ x: 0, y: 0, k: 1 });

    // 2. ÉTAT DU DRAG (Pour différencier un CLIC d'un GLISSÉ)
    const dragRef = useRef({
        isDown: false,      // Le bouton est enfoncé
        isPanning: false,   // On est officiellement en train de bouger
        startX: 0,
        startY: 0,
        startMatrixX: 0,
        startMatrixY: 0
    });

    // Fonction interne pour appliquer la matrice au DOM via CSS Transform
    const updateTransform = () => {
        if (cameraGroupRef.current) {
            const { x, y, k } = cameraMatrix.current;
            cameraGroupRef.current.setAttribute('transform', `matrix(${k}, 0, 0, ${k}, ${x}, ${y})`);

            if (onCameraChange) {
                onCameraChange(cameraMatrix.current);
            }
        }
    };

    // Fonctions exposées au parent via ref
    useImperativeHandle(ref, () => ({
        panBy: (dx, dy) => {
            cameraMatrix.current.x += dx;
            cameraMatrix.current.y += dy;
            updateTransform();
        },
        setCameraMatrix: (_cameraMatrix = { x: 0, y: 0, k: 1 }) => {
            cameraMatrix.current = { ..._cameraMatrix };
            console.log("[VIEWPORT]setCameraMatrix", cameraMatrix.current);
            updateTransform();
        },
        screenToWorld: (screenX, screenY) => {
            return screenToWorld(screenX, screenY, svgRef.current, cameraMatrix.current);
        },
        worldToViewport: (wx, wy) => {
            const { x, y, k } = cameraMatrix.current;
            return {
                x: wx * k + x,
                y: wy * k + y
            };
        },
        getZoom: () => {
            return cameraMatrix.current.k;
        }
    }));

    const _screenToWorld = useCallback((screenX, screenY) => {
        return screenToWorld(screenX, screenY, svgRef.current, cameraMatrix.current);
    }, []);

    const _screenToViewport = useCallback((screenX, screenY) => {
        const rect = svgRef.current.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;
        return { x, y };
    }, []);

    // --- A. GESTION DU ZOOM (Reste inchangé, car performant) ---
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const { x, y, k } = cameraMatrix.current;

        // Use the same zoom sensitivity as MapEditorGeneric.jsx
        const scaleFactor = Math.pow(ZOOM_SENSITIVITY, -e.deltaY);
        const newK = k * scaleFactor;

        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - x) * scaleFactor;
        const newY = mouseY - (mouseY - y) * scaleFactor;

        cameraMatrix.current = { x: newX, y: newY, k: newK };
        updateTransform();

        if (onWorldMouseMove) {
            const worldPos = _screenToWorld(e.clientX, e.clientY); // Recalculate world pos
            const viewportPos = _screenToViewport(e.clientX, e.clientY);

            onWorldMouseMove({
                worldPos,
                viewportPos,
                event: e // We can reuse the wheel event as it has clientX/Y
            });
        }
    }, [_screenToWorld, _screenToViewport, onWorldMouseMove]);

    useLayoutEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);


    // --- B. GESTION DU PANNING (CLIC GAUCHE) ---

    // 1. Début du clic
    const handleMouseDown = (e) => {
        console.log("[VIEWPORT] _DOWN_", e);
        // On n'accepte que le Clic Gauche (button 0) pour le Pan ici
        if (e.button !== 0) return;

        dragRef.current = {
            isDown: true,
            isPanning: false, // On ne sait pas encore si c'est un Pan ou un Clic
            startX: e.clientX,
            startY: e.clientY,
            startMatrixX: cameraMatrix.current.x,
            startMatrixY: cameraMatrix.current.y
        };

        // On écoute sur WINDOW pour ne pas perdre le focus si la souris sort du SVG
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    // 2. Mouvement (Appliqué à la window)
    const handleWindowMouseMove = (e) => {
        if (!dragRef.current.isDown) return;

        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        // Seuil de tolérance (3 pixels) pour distinguer un Clic maladroit d'un vrai Pan
        if (!dragRef.current.isPanning) {
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                dragRef.current.isPanning = true;
                // Optionnel : Changer le curseur globalement via le body
                document.body.style.cursor = 'grabbing';
            }
        }

        if (dragRef.current.isPanning) {
            e.preventDefault(); // Empêcher la sélection de texte native
            cameraMatrix.current.x = dragRef.current.startMatrixX + dx;
            cameraMatrix.current.y = dragRef.current.startMatrixY + dy;
            updateTransform();
            if (onWorldMouseMove) {
                const worldPos = _screenToWorld(e.clientX, e.clientY);
                const viewportPos = _screenToViewport(e.clientX, e.clientY);

                onWorldMouseMove({
                    worldPos,
                    viewportPos,
                    event: e,
                    isPanning: true
                });
            }
        }
    };

    // 3. Relâchement (Fin du Pan ou Validation du Clic)
    const handleWindowMouseUp = (e) => {
        // Nettoyage des événements globaux
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
        document.body.style.cursor = ''; // Reset curseur

        // LOGIQUE CRITIQUE : Clic vs Pan
        if (dragRef.current.isPanning) {
            // C'était un Pan, on ne fait rien d'autre (la caméra a bougé)
            console.log("Fin du Pan");
        } else {
            // On n'a pas assez bougé -> C'est un CLIC "propre"
            // On appelle le callback du parent pour gérer la sélection d'objet
            if (onWorldClick) {
                const worldPos = _screenToWorld(e.clientX, e.clientY);
                const viewportPos = _screenToViewport(e.clientX, e.clientY);
                onWorldClick({ event: e, worldPos, viewportPos });
            }
        }

        // Reset state
        dragRef.current.isDown = false;
        dragRef.current.isPanning = false;
    };


    // --- C. GESTION DU HOVER ---
    const handleMouseMove = (e) => {
        // Si on est en train de déplacer la caméra, on ignore le calcul de hover (optimisation)
        if (dragRef.current.isDown) return;

        const worldPos = _screenToWorld(e.clientX, e.clientY);
        const viewportPos = _screenToViewport(e.clientX, e.clientY);

        if (onWorldMouseMove) {
            onWorldMouseMove({ worldPos, viewportPos, event: e, isPanning: false });
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                onMouseMove={handleMouseMove} // Hover (calcul coordonnées)
                onMouseDown={handleMouseDown} // Début interaction (Pan ou Clic)
                style={{
                    cursor: dragRef.current.isPanning ? 'grabbing' : 'default',
                    touchAction: 'none' // Empêche le zoom/scroll natif sur tactile
                }}
            >
                <g ref={cameraGroupRef}>
                    {children}
                </g>

                {staticOverlay}
            </svg>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {htmlOverlay}
            </div>
        </div>
    );
});

export default MapEditorViewport;