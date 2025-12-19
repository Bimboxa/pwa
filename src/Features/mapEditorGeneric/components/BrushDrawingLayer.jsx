import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const BrushDrawingLayer = forwardRef(({
    width,
    height,
    brushPath = [], // Array of {x, y, r} <-- 'r' est maintenant stocké ici
    color = "rgba(255, 0, 0, 0.5)"
}, ref) => {
    const canvasRef = useRef(null);

    useImperativeHandle(ref, () => ({
        getSnapshotDataUrl: () => {
            if (!canvasRef.current) return null;
            return canvasRef.current.toDataURL('image/png');
        },
        clear: () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Reset du canvas
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = color;

        // Dessin des ronds avec leur rayon individuel
        brushPath.forEach(point => {
            // Sécurité si r n'existe pas (vieux state)
            const radius = point.r || 10;

            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
            ctx.fill();
        });

    }, [brushPath, width, height, color]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 100
            }}
        />
    );
});

export default BrushDrawingLayer;